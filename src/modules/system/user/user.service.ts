import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { Prisma, Sex } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { CreateUserDto, UpdateUserDto, QueryUserDto } from './dto';
import { buildQueryWhere } from '@/common/utils/query-where.util';
import { paginate } from '@/common/utils/pagination.util';
import { parseUserImport } from './excel.util';
import { SessionService } from '@/modules/session/session.service';

/** 调用方上下文(取自 JWT 策略附加到请求的 user 对象) */
interface CallerContext {
  permissions?: string[];
}

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionService: SessionService,
  ) {}

  /**
   * create/update 直接携带 roleIds 属于角色分配操作,
   * 必须持有 assign-role 权限;否则持有 user:create/update 的
   * 账号可绕过独立授权直接授予任意角色(含 ADMIN)
   */
  private assertCanAssignRoles(caller: CallerContext | undefined): void {
    if (!caller?.permissions?.includes('system:user:assign-role')) {
      throw new ForbiddenException(
        '缺少角色分配权限，请在角色分配接口中操作，或联系管理员',
      );
    }
  }

  private async findSystemAdminRoleId(): Promise<number | null> {
    const role = await this.prisma.role.findFirst({
      where: { code: 'ADMIN', isDeleted: false },
      select: { id: true },
    });
    return role?.id ?? null;
  }

  private async isAdminHolder(
    userId: number,
    adminRoleId: number,
  ): Promise<boolean> {
    const record = await this.prisma.userRole.findUnique({
      where: { userId_roleId: { userId, roleId: adminRoleId } },
    });
    return !!record;
  }

  private async assertSystemAdminRemains(
    adminRoleId: number,
    excludeUserId: number,
    message = '系统中必须至少保留一个系统管理员',
  ): Promise<void> {
    const count = await this.prisma.userRole.count({
      where: {
        roleId: adminRoleId,
        userId: { not: excludeUserId },
        user: { isDeleted: false, status: 1 },
      },
    });
    if (count === 0) {
      throw new BadRequestException(message);
    }
  }

  async create(createUserDto: CreateUserDto, caller?: CallerContext) {
    const { username, password, phone, email } = createUserDto;

    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { username },
          ...(phone ? [{ phone }] : []),
          ...(email ? [{ email }] : []),
        ],
      },
    });

    if (existingUser) {
      throw new BadRequestException('用户名、手机号或邮箱已存在');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const { roleIds, ...userData } = createUserDto;
    if (Array.isArray(roleIds) && roleIds.length > 0) {
      this.assertCanAssignRoles(caller);
    }
    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          ...userData,
          password: hashedPassword,
        },
      });

      // 创建用户时分配角色(与 update 的 roleIds 语义一致)
      if (Array.isArray(roleIds) && roleIds.length > 0) {
        await tx.userRole.createMany({
          data: roleIds.map((roleId: number) => ({
            userId: created.id,
            roleId,
          })),
        });
      }

      return created;
    });

    return {
      id: user.id,
      username: user.username,
      name: user.name,
      phone: user.phone,
      email: user.email,
    };
  }

  async findAll(queryUserDto: QueryUserDto) {
    const { page = 1, pageSize = 20 } = queryUserDto;
    const where = this.buildUserWhere(queryUserDto);

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdTime: 'desc' },
        include: {
          department: {
            select: { id: true, name: true },
          },
          roles: {
            include: {
              role: {
                select: { id: true, name: true, code: true },
              },
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    const formattedUsers = users.map((user) => ({
      id: user.id,
      username: user.username,
      name: user.name,
      phone: user.phone,
      email: user.email,
      sex: user.sex,
      avatar: user.avatar,
      birthday: user.birthday,
      city: user.city,
      address: user.address,
      addressDetail: user.addressDetail,
      status: user.status,
      roleType: user.roleType,
      position: user.position,
      joinedAt: user.joinedAt,
      departmentId: user.departmentId,
      departmentName: user.department?.name,
      roles: user.roles.map((ur) => ({
        id: ur.role.id,
        name: ur.role.name,
        code: ur.role.code,
      })),
      createdTime: user.createdTime,
      updatedTime: user.updatedTime,
    }));

    return paginate(formattedUsers, { page, pageSize, total });
  }

  /** 构建列表/导出的统一查询条件(排除已删除) */
  private buildUserWhere(queryUserDto: QueryUserDto): Prisma.UserWhereInput {
    const { includeDeleted } = queryUserDto;
    const where: Prisma.UserWhereInput = {
      ...buildQueryWhere(queryUserDto, {
        username: 'contains',
        name: 'contains',
        phone: 'eq',
        email: 'contains',
        departmentId: 'eq',
        status: 'eq',
        sex: 'eq',
        roleType: 'eq',
        role: {
          relation: 'roles',
          relationField: 'roleId',
          operator: 'in',
        },
      }),
    };
    if (!includeDeleted) {
      where.isDeleted = false;
    }
    return where;
  }

  /** 导出:按当前筛选条件查询全量用户(不分页) */
  async exportUsers(queryUserDto: QueryUserDto) {
    const where = this.buildUserWhere(queryUserDto);
    const users = await this.prisma.user.findMany({
      where,
      orderBy: { createdTime: 'desc' },
      include: {
        department: { select: { name: true } },
        roles: { include: { role: { select: { name: true } } } },
      },
    });

    return users.map((user) => ({
      username: user.username,
      name: user.name,
      phone: user.phone,
      email: user.email,
      sex: user.sex,
      status: user.status,
      roles: user.roles.map((ur) => ur.role.name),
      departmentName: user.department?.name ?? null,
      position: user.position,
      createdTime: user.createdTime,
    }));
  }

  /** 导入:解析 Excel 并逐行校验创建,返回成功/失败统计(部分成功) */
  async importUsers(buffer: Buffer) {
    const rows = await parseUserImport(buffer);
    const result = {
      total: rows.length,
      success: 0,
      failed: [] as { row: number; errors: string[] }[],
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const errors: string[] = [];

      if (row.username.length < 3 || row.username.length > 50) {
        errors.push('用户名长度需为 3-50 位');
      }

      const password = row.password || '123456';
      if (password.length < 6 || password.length > 20) {
        errors.push('密码长度需为 6-20 位');
      }
      if (row.phone && !/^1\d{10}$/.test(row.phone)) {
        errors.push('手机号格式不正确');
      }
      if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
        errors.push('邮箱格式不正确');
      }

      let departmentId: number | null = null;
      if (row.departmentName) {
        const department = await this.prisma.department.findFirst({
          where: { name: row.departmentName, isDeleted: false },
          select: { id: true },
        });
        if (department) {
          departmentId = department.id;
        } else {
          errors.push(`部门「${row.departmentName}」不存在`);
        }
      }

      if (errors.length === 0) {
        const existing = await this.prisma.user.findFirst({
          where: {
            OR: [
              { username: row.username },
              ...(row.phone ? [{ phone: row.phone }] : []),
              ...(row.email ? [{ email: row.email }] : []),
            ],
          },
        });
        if (existing) {
          errors.push('用户名、手机号或邮箱已存在');
        }
      }

      if (errors.length > 0) {
        result.failed.push({ row: i + 2, errors });
        continue;
      }

      await this.create({
        username: row.username,
        password,
        name: row.name,
        phone: row.phone,
        email: row.email,
        sex: row.sex as Sex,
        position: row.position,
        departmentId: departmentId ?? undefined,
      });
      result.success++;
    }

    return result;
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        department: {
          select: { id: true, name: true },
        },
        roles: {
          include: {
            role: {
              select: { id: true, name: true, code: true },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`用户 ID ${id} 不存在`);
    }

    return {
      id: user.id,
      username: user.username,
      name: user.name,
      phone: user.phone,
      email: user.email,
      sex: user.sex,
      avatar: user.avatar,
      birthday: user.birthday,
      city: user.city,
      address: user.address,
      addressDetail: user.addressDetail,
      status: user.status,
      roleType: user.roleType,
      position: user.position,
      joinedAt: user.joinedAt,
      departmentId: user.departmentId,
      departmentName: user.department?.name,
      roles: user.roles.map((ur) => ({
        id: ur.role.id,
        name: ur.role.name,
        code: ur.role.code,
      })),
      createdTime: user.createdTime,
      updatedTime: user.updatedTime,
    };
  }

  async update(
    id: number,
    updateUserDto: UpdateUserDto,
    caller?: CallerContext,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`用户 ID ${id} 不存在`);
    }

    if (updateUserDto.username || updateUserDto.phone || updateUserDto.email) {
      const existingUser = await this.prisma.user.findFirst({
        where: {
          id: { not: id },
          OR: [
            ...(updateUserDto.username
              ? [{ username: updateUserDto.username }]
              : []),
            ...(updateUserDto.phone ? [{ phone: updateUserDto.phone }] : []),
            ...(updateUserDto.email ? [{ email: updateUserDto.email }] : []),
          ],
        },
      });

      if (existingUser) {
        throw new BadRequestException('用户名、手机号或邮箱已存在');
      }
    }

    const { roleIds, ...userData } = updateUserDto;
    // update 携带 roleIds(含空数组=清空角色)都属于角色分配操作
    if (roleIds !== undefined) {
      this.assertCanAssignRoles(caller);
    }
    const data: Prisma.UserUpdateInput = { ...userData };

    if (updateUserDto.password) {
      data.password = await bcrypt.hash(updateUserDto.password, 10);
    }

    const adminRoleId = await this.findSystemAdminRoleId();
    if (adminRoleId !== null) {
      const removingAdminRole =
        roleIds !== undefined &&
        (await this.isAdminHolder(id, adminRoleId)) &&
        !roleIds.includes(adminRoleId);
      const disablingAdmin =
        updateUserDto.status === 0 &&
        (await this.isAdminHolder(id, adminRoleId));
      if (
        (removingAdminRole || disablingAdmin) &&
        user.status === 1 &&
        !user.isDeleted
      ) {
        await this.assertSystemAdminRemains(adminRoleId, id);
      }
    }

    const updatedUser = await this.prisma.$transaction(async (tx) => {
      // 更新用户基本信息
      const user = await tx.user.update({
        where: { id },
        data,
      });

      // 更新角色关联
      if (roleIds !== undefined) {
        await tx.userRole.deleteMany({ where: { userId: id } });
        if (Array.isArray(roleIds) && roleIds.length > 0) {
          await tx.userRole.createMany({
            data: roleIds.map((roleId: number) => ({ userId: id, roleId })),
          });
        }
      }

      return user;
    });

    return {
      id: updatedUser.id,
      username: updatedUser.username,
      name: updatedUser.name,
      phone: updatedUser.phone,
      email: updatedUser.email,
    };
  }

  async remove(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`用户 ID ${id} 不存在`);
    }

    const adminRoleId = await this.findSystemAdminRoleId();
    if (
      adminRoleId !== null &&
      user.status === 1 &&
      !user.isDeleted &&
      (await this.isAdminHolder(id, adminRoleId))
    ) {
      await this.assertSystemAdminRemains(
        adminRoleId,
        id,
        '不能删除最后一个系统管理员',
      );
    }

    await this.prisma.user.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedTime: new Date(),
      },
    });

    return { id };
  }

  async batchRemove(ids: number[]) {
    const adminRoleId = await this.findSystemAdminRoleId();
    if (adminRoleId !== null) {
      const adminHolders = await this.prisma.userRole.findMany({
        where: { roleId: adminRoleId, userId: { in: ids } },
        select: { userId: true },
      });

      if (adminHolders.length > 0) {
        const [activeInBatch, remainingOutside] = await Promise.all([
          this.prisma.userRole.count({
            where: {
              roleId: adminRoleId,
              userId: { in: ids },
              user: { isDeleted: false, status: 1 },
            },
          }),
          this.prisma.userRole.count({
            where: {
              roleId: adminRoleId,
              userId: { notIn: ids },
              user: { isDeleted: false, status: 1 },
            },
          }),
        ]);

        if (activeInBatch > 0 && remainingOutside === 0) {
          throw new BadRequestException('不能删除最后一个系统管理员');
        }
      }
    }

    await this.prisma.user.updateMany({
      where: { id: { in: ids } },
      data: {
        isDeleted: true,
        deletedTime: new Date(),
      },
    });
    return { ids };
  }

  async updateStatus(id: number, status: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`用户 ID ${id} 不存在`);
    }

    const adminRoleId = await this.findSystemAdminRoleId();
    if (
      status === 0 &&
      adminRoleId !== null &&
      user.status === 1 &&
      !user.isDeleted &&
      (await this.isAdminHolder(id, adminRoleId))
    ) {
      await this.assertSystemAdminRemains(
        adminRoleId,
        id,
        '不能禁用最后一个系统管理员',
      );
    }

    await this.prisma.user.update({
      where: { id },
      data: { status },
    });

    return { id, status };
  }

  async assignRoles(userId: number, roleIds: number[]) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`用户 ID ${userId} 不存在`);
    }

    const adminRoleId = await this.findSystemAdminRoleId();
    if (
      adminRoleId !== null &&
      user.status === 1 &&
      !user.isDeleted &&
      (await this.isAdminHolder(userId, adminRoleId)) &&
      !roleIds.includes(adminRoleId)
    ) {
      await this.assertSystemAdminRemains(adminRoleId, userId);
    }

    // 先删后建必须同事务：createMany 失败(FK 等)时不能把用户已有角色清空
    await this.prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({
        where: { userId },
      });

      if (roleIds.length > 0) {
        await tx.userRole.createMany({
          data: roleIds.map((roleId) => ({
            userId,
            roleId,
          })),
        });
      }
    });

    return { userId, roleIds };
  }

  async resetPassword(id: number, newPassword: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`用户 ID ${id} 不存在`);
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id },
      data: { password: hashedPassword },
    });

    // 管理员重置密码后强制该用户全部会话下线,被盗会话立即止损
    await this.sessionService.kickByUser(id);

    return { id };
  }
}
