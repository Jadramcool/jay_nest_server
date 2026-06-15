import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { CreateUserDto, UpdateUserDto, QueryUserDto } from './dto';
import { buildQueryWhere } from '@/common/utils/query-where.util';
import { paginate } from '@/common/utils/pagination.util';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
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

    const user = await this.prisma.user.create({
      data: {
        ...createUserDto,
        password: hashedPassword,
      },
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
    const { page = 1, pageSize = 10, includeDeleted } = queryUserDto;

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

  async update(id: number, updateUserDto: UpdateUserDto) {
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
    const data: Prisma.UserUpdateInput = { ...userData };

    if (updateUserDto.password) {
      data.password = await bcrypt.hash(updateUserDto.password, 10);
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

    await this.prisma.userRole.deleteMany({
      where: { userId },
    });

    if (roleIds.length > 0) {
      await this.prisma.userRole.createMany({
        data: roleIds.map((roleId) => ({
          userId,
          roleId,
        })),
      });
    }

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

    return { id };
  }
}
