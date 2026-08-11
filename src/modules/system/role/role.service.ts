import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CreateRoleDto, UpdateRoleDto, QueryRoleDto } from './dto';
import { paginate } from '@/common/utils/pagination.util';
import { buildQueryWhere } from '@/common/utils/query-where.util';

@Injectable()
export class RoleService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createRoleDto: CreateRoleDto) {
    const { code, name } = createRoleDto;

    const existingRole = await this.prisma.role.findFirst({
      where: {
        OR: [{ code }, { name }],
      },
    });

    if (existingRole) {
      throw new BadRequestException('角色编码或角色名称已存在');
    }

    const role = await this.prisma.role.create({
      data: createRoleDto,
    });

    return {
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description,
    };
  }

  async findAll(queryRoleDto: QueryRoleDto) {
    const { page = 1, pageSize = 20, includeDeleted } = queryRoleDto;

    const where: Prisma.RoleWhereInput = {
      ...buildQueryWhere(queryRoleDto, {
        code: 'contains',
        name: 'contains',
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
        throw new BadRequestException('角色编码或角色名称已存在');
      }
    }

    const updatedRole = await this.prisma.role.update({
      where: { id },
      data: updateRoleDto,
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

  async assignMenus(roleId: number, menuIds: number[]) {
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!role) {
      throw new NotFoundException(`角色 ID ${roleId} 不存在`);
    }

    if (role.isSystem) {
      throw new BadRequestException('系统内置角色的菜单权限不可调整');
    }

    await this.prisma.roleMenu.deleteMany({
      where: { roleId },
    });

    if (menuIds.length > 0) {
      await this.prisma.roleMenu.createMany({
        data: menuIds.map((menuId) => ({
          roleId,
          menuId,
        })),
      });
    }

    return { roleId, menuIds };
  }
}
