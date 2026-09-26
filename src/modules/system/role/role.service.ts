import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import {
  PLATFORMS,
  PLATFORM_LABELS,
  type PlatformCode,
  configurablePlatforms,
  isPlatformCode,
} from '@/common/constants/platform';
import { PrismaService } from '@/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CreateRoleDto, UpdateRoleDto, QueryRoleDto } from './dto';
import { paginate } from '@/common/utils/pagination.util';
import { buildQueryWhere } from '@/common/utils/query-where.util';

@Injectable()
export class RoleService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 归一化端标识：非法值直接拒绝
   */
  private resolvePlatform(value?: string | null): PlatformCode {
    if (value === undefined || value === null || value === '') {
      return PLATFORMS.ADMIN;
    }
    if (!isPlatformCode(value)) {
      throw new BadRequestException(`不支持的端: ${value}`);
    }
    return value;
  }

  async create(createRoleDto: CreateRoleDto) {
    const { code, name } = createRoleDto;
    const platform = this.resolvePlatform(createRoleDto.platform);

    const existingRole = await this.prisma.role.findFirst({
      where: {
        OR: [{ code }, { name }],
      },
    });

    if (existingRole) {
      throw new BadRequestException(
        existingRole.isDeleted
          ? '角色编码或角色名称已被已删除的角色占用，请更换或联系管理员清理'
          : '角色编码或角色名称已存在',
      );
    }

    const role = await this.prisma.role.create({
      data: { ...createRoleDto, platform },
    });

    return {
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description,
      platform: role.platform,
    };
  }

  async findAll(queryRoleDto: QueryRoleDto) {
    const { page = 1, pageSize = 20, includeDeleted } = queryRoleDto;

    const where: Prisma.RoleWhereInput = {
      ...buildQueryWhere(queryRoleDto, {
        code: 'contains',
        name: 'contains',
        platform: 'eq',
      }),
    };

    if (!includeDeleted) {
      where.isDeleted = false;
    }

    const [roles, total] = await Promise.all([
      this.prisma.role.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdTime: 'desc' },
        include: {
          menus: {
            include: {
              menu: {
                select: { id: true, name: true, code: true },
              },
            },
          },
          users: {
            include: {
              user: {
                select: { id: true, username: true, name: true },
              },
            },
          },
        },
      }),
      this.prisma.role.count({ where }),
    ]);

    const formattedRoles = roles.map((role) => ({
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      platform: role.platform,
      menuCount: role.menus.length,
      userCount: role.users.length,
      menus: role.menus.map((rm) => rm.menu),
      users: role.users.map((ur) => ur.user),
      createdTime: role.createdTime,
      updatedTime: role.updatedTime,
    }));

    return paginate(formattedRoles, { page, pageSize, total });
  }

  async findAllSimple() {
    const roles = await this.prisma.role.findMany({
      where: { isDeleted: false },
      orderBy: { createdTime: 'desc' },
    });
    return roles.map((role) => ({
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      createdTime: role.createdTime,
    }));
  }

  async findOne(id: number) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: {
        menus: {
          include: {
            menu: true,
          },
        },
        permissions: {
          include: {
            permission: true,
          },
        },
        users: {
          include: {
            user: {
              select: { id: true, username: true, name: true },
            },
          },
        },
      },
    });

    if (!role) {
      throw new NotFoundException(`角色 ID ${id} 不存在`);
    }

    return {
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      menus: role.menus.map((rm) => rm.menu),
      permissionIds: role.permissions.map((rp) => rp.permissionId),
      users: role.users.map((ur) => ur.user),
      createdTime: role.createdTime,
      updatedTime: role.updatedTime,
    };
  }

  async update(id: number, updateRoleDto: UpdateRoleDto) {
    const role = await this.prisma.role.findUnique({
      where: { id },
    });

    if (!role) {
      throw new NotFoundException(`角色 ID ${id} 不存在`);
    }

    if (role.isSystem) {
      throw new BadRequestException('系统内置角色不可修改');
    }

    if (updateRoleDto.code || updateRoleDto.name) {
      const existingRole = await this.prisma.role.findFirst({
        where: {
          id: { not: id },
          OR: [
            ...(updateRoleDto.code ? [{ code: updateRoleDto.code }] : []),
            ...(updateRoleDto.name ? [{ name: updateRoleDto.name }] : []),
          ],
        },
      });

      if (existingRole) {
        throw new BadRequestException(
          existingRole.isDeleted
            ? '角色编码或角色名称已被已删除的角色占用，请更换或联系管理员清理'
            : '角色编码或角色名称已存在',
        );
      }
    }

    const nextPlatform =
      updateRoleDto.platform !== undefined
        ? this.resolvePlatform(updateRoleDto.platform)
        : undefined;

    // 切换端时必须保证已分配菜单仍属于新端的可配置范围，否则会出现跨端授权
    if (nextPlatform && nextPlatform !== role.platform) {
      const foreignMenus = await this.prisma.roleMenu.findMany({
        where: {
          roleId: id,
          menu: { platform: { notIn: configurablePlatforms(nextPlatform) } },
        },
        select: { menu: { select: { name: true } } },
      });

      if (foreignMenus.length > 0) {
        throw new BadRequestException(
          `该角色已分配其他端的菜单（${foreignMenus
            .map((item) => item.menu.name)
            .join('、')}），请先清空权限再切换端`,
        );
      }
    }

    const updatedRole = await this.prisma.role.update({
      where: { id },
      data: {
        ...updateRoleDto,
        ...(nextPlatform !== undefined && { platform: nextPlatform }),
      },
    });

    return {
      id: updatedRole.id,
      code: updatedRole.code,
      name: updatedRole.name,
      description: updatedRole.description,
    };
  }

  async remove(id: number) {
    const role = await this.prisma.role.findUnique({
      where: { id },
    });

    if (!role) {
      throw new NotFoundException(`角色 ID ${id} 不存在`);
    }

    if (role.isSystem) {
      throw new BadRequestException('系统内置角色不可删除');
    }

    await this.prisma.role.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedTime: new Date(),
      },
    });

    return { id };
  }

  async assignMenus(
    roleId: number,
    menuIds: number[],
    permissionIds?: number[],
  ) {
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!role) {
      throw new NotFoundException(`角色 ID ${roleId} 不存在`);
    }

    if (role.isSystem) {
      throw new BadRequestException('系统内置角色的权限不可调整');
    }

    // 端约束：普通角色只能分配本端与通用端菜单；通用角色在所有端生效，可分配所有端
    if (menuIds.length > 0) {
      const allowedPlatforms = configurablePlatforms(role.platform);
      const menus = await this.prisma.menu.findMany({
        where: { id: { in: menuIds } },
        select: { id: true, name: true, platform: true },
      });
      const foreignMenus = menus.filter(
        (menu) => !allowedPlatforms.includes(menu.platform as PlatformCode),
      );
      if (foreignMenus.length > 0) {
        throw new BadRequestException(
          `角色「${role.name}」属于${
            PLATFORM_LABELS[role.platform as PlatformCode] ?? role.platform
          }，仅能分配${allowedPlatforms
            .map((platform) => PLATFORM_LABELS[platform])
            .join('、')}的菜单：${foreignMenus
            .map((menu) => menu.name)
            .join('、')}`,
        );
      }
    }

    // 先删后建必须同事务：createMany 失败(FK 等)时不能把角色已有权限清空
    await this.prisma.$transaction(async (tx) => {
      await tx.roleMenu.deleteMany({
        where: { roleId },
      });

      if (menuIds.length > 0) {
        await tx.roleMenu.createMany({
          data: menuIds.map((menuId) => ({
            roleId,
            menuId,
          })),
        });
      }

      // 功能权限与菜单同事务保存；未传时保持原有分配不变
      if (permissionIds !== undefined) {
        await tx.rolePermission.deleteMany({
          where: { roleId },
        });

        if (permissionIds.length > 0) {
          await tx.rolePermission.createMany({
            data: permissionIds.map((permissionId) => ({
              roleId,
              permissionId,
            })),
            skipDuplicates: true,
          });
        }
      }
    });

    return {
      roleId,
      menuIds,
      ...(permissionIds !== undefined ? { permissionIds } : {}),
    };
  }
}
