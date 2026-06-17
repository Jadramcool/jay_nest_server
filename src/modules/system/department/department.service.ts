import { paginate } from '@/common/utils/pagination.util';
import { buildQueryWhere } from '@/common/utils/query-where.util';
import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { Department, Prisma } from '@prisma/client';
import {
  CreateDepartmentDto,
  UpdateDepartmentDto,
  QueryDepartmentDto,
} from './dto';

export interface DepartmentTreeNode {
  id: number;
  name: string;
  code: string;
  description: string | null;
  level: number | null;
  sortOrder: number;
  status: number;
  managerId: number | null;
  managerName?: string | null;
  parentId: number | null;
  children?: DepartmentTreeNode[];
}

@Injectable()
export class DepartmentService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createDepartmentDto: CreateDepartmentDto) {
    const { code, parentId } = createDepartmentDto;

    const existingDept = await this.prisma.department.findUnique({
      where: { code },
    });

    if (existingDept) {
      throw new BadRequestException('部门编码已存在');
    }

    const level = await this.calcLevel(parentId ?? null);

    const department = await this.prisma.department.create({
      data: { ...createDepartmentDto, level },
    });

    return this.formatDepartment(department);
  }

  async findAll(queryDepartmentDto: QueryDepartmentDto) {
    const { page = 1, pageSize = 10, includeDeleted } = queryDepartmentDto;

    const where: Prisma.DepartmentWhereInput = {
      ...buildQueryWhere(queryDepartmentDto, {
        name: 'contains',
        code: 'contains',
        status: 'eq',
        parentId: 'eq',
      }),
    };

    if (!includeDeleted) {
      where.isDeleted = false;
    }

    const [departments, total] = await Promise.all([
      this.prisma.department.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { sortOrder: 'asc' },
        include: {
          manager: {
            select: { id: true, username: true, name: true },
          },
          parent: {
            select: { id: true, name: true },
          },
        },
      }),
      this.prisma.department.count({ where }),
    ]);

    const formattedDepartments = departments.map((dept) => ({
      id: dept.id,
      name: dept.name,
      code: dept.code,
      description: dept.description,
      level: dept.level,
      sortOrder: dept.sortOrder,
      status: dept.status,
      managerId: dept.managerId,
      managerName: dept.manager?.name,
      parentId: dept.parentId,
      parentName: dept.parent?.name,
      createdTime: dept.createdTime,
      updatedTime: dept.updatedTime,
    }));

    return paginate(formattedDepartments, { page, pageSize, total });
  }

  async findOne(id: number) {
    const department = await this.prisma.department.findUnique({
      where: { id },
      include: {
        manager: {
          select: { id: true, username: true, name: true },
        },
        parent: {
          select: { id: true, name: true },
        },
        children: {
          where: { isDeleted: false },
          orderBy: { sortOrder: 'asc' },
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

    if (!department) {
      throw new NotFoundException(`部门 ID ${id} 不存在`);
    }

    return {
      id: department.id,
      name: department.name,
      code: department.code,
      description: department.description,
      level: department.level,
      sortOrder: department.sortOrder,
      status: department.status,
      managerId: department.managerId,
      managerName: department.manager?.name,
      parentId: department.parentId,
      parentName: department.parent?.name,
      children: department.children.map((child) => ({
        id: child.id,
        name: child.name,
        code: child.code,
      })),
      roles: department.roles.map((rd) => rd.role),
      createdTime: department.createdTime,
      updatedTime: department.updatedTime,
    };
  }

  async findTree() {
    const departments = await this.prisma.department.findMany({
      where: { isDeleted: false },
      orderBy: { sortOrder: 'asc' },
      include: {
        manager: {
          select: { id: true, username: true, name: true },
        },
      },
    });

    return this.buildTree(departments);
  }

  async update(id: number, updateDepartmentDto: UpdateDepartmentDto) {
    const department = await this.prisma.department.findUnique({
      where: { id },
    });

    if (!department) {
      throw new NotFoundException(`部门 ID ${id} 不存在`);
    }

    if (updateDepartmentDto.code) {
      const existingDept = await this.prisma.department.findFirst({
        where: {
          id: { not: id },
          code: updateDepartmentDto.code,
        },
      });

      if (existingDept) {
        throw new BadRequestException('部门编码已存在');
      }
    }

    const data: Prisma.DepartmentUpdateInput = { ...updateDepartmentDto };
    if (updateDepartmentDto.parentId !== undefined) {
      data.level = await this.calcLevel(updateDepartmentDto.parentId ?? null);
    }

    const updatedDepartment = await this.prisma.department.update({
      where: { id },
      data,
    });

    return this.formatDepartment(updatedDepartment);
  }

  async remove(id: number) {
    const department = await this.prisma.department.findUnique({
      where: { id },
    });

    if (!department) {
      throw new NotFoundException(`部门 ID ${id} 不存在`);
    }

    const childDepts = await this.prisma.department.findMany({
      where: { parentId: id, isDeleted: false },
    });

    if (childDepts.length > 0) {
      throw new BadRequestException('该部门存在子部门，无法删除');
    }

    const usersInDept = await this.prisma.user.count({
      where: { departmentId: id, isDeleted: false },
    });

    if (usersInDept > 0) {
      throw new BadRequestException('该部门下存在用户，无法删除');
    }

    await this.prisma.department.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedTime: new Date(),
      },
    });

    return { id };
  }

  async search(keyword: string) {
    const departments = await this.prisma.department.findMany({
      where: {
        isDeleted: false,
        OR: [
          { name: { contains: keyword } },
          { code: { contains: keyword } },
          { description: { contains: keyword } },
        ],
      },
      orderBy: { sortOrder: 'asc' },
      include: {
        manager: {
          select: { id: true, username: true, name: true },
        },
      },
    });
    return departments.map((dept) => this.formatDepartment(dept));
  }

  async getStats(id?: number) {
    if (id) {
      const department = await this.prisma.department.findUnique({
        where: { id },
      });
      if (!department) {
        throw new NotFoundException(`部门 ID ${id} 不存在`);
      }
      const userCount = await this.prisma.user.count({
        where: { departmentId: id, isDeleted: false },
      });
      const childCount = await this.prisma.department.count({
        where: { parentId: id, isDeleted: false },
      });
      return {
        departmentId: id,
        departmentName: department.name,
        userCount,
        childCount,
      };
    }
    const totalDepartments = await this.prisma.department.count({
      where: { isDeleted: false },
    });
    const totalUsers = await this.prisma.user.count({
      where: { isDeleted: false },
    });
    const activeDepartments = await this.prisma.department.count({
      where: { isDeleted: false, status: 1 },
    });
    return {
      totalDepartments,
      activeDepartments,
      totalUsers,
    };
  }

  async getMembers(id: number, query?: Record<string, unknown>) {
    const page = Number(query?.page) || 1;
    const pageSize = Number(query?.pageSize) || 10;
    const includeChildren = query?.includeChildren === 'true' || query?.includeChildren === true;

    // 收集目标部门 ID 列表
    let deptIds = [id];
    if (includeChildren) {
      const allDepts = await this.prisma.department.findMany({
        where: { isDeleted: false },
        select: { id: true, parentId: true },
      });
      const childrenIds = this.collectChildIds(allDepts, id);
      deptIds = [id, ...childrenIds];
    }

    const where = { departmentId: { in: deptIds }, isDeleted: false };
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          username: true,
          name: true,
          phone: true,
          email: true,
          status: true,
          position: true,
          roles: {
            include: {
              role: { select: { id: true, name: true, code: true } },
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);
    return paginate(
      users.map((user) => ({
        id: user.id,
        username: user.username,
        name: user.name,
        phone: user.phone,
        email: user.email,
        status: user.status,
        position: user.position,
        roles: user.roles.map((ur) => ur.role),
      })),
      { page, pageSize, total },
    );
  }

  private collectChildIds(allDepts: { id: number; parentId: number | null }[], parentId: number): number[] {
    const ids: number[] = [];
    for (const d of allDepts) {
      if (d.parentId === parentId) {
        ids.push(d.id, ...this.collectChildIds(allDepts, d.id));
      }
    }
    return ids;
  }

  private async calcLevel(parentId: number | null): Promise<number> {
    if (parentId === null) return 1;
    const parent = await this.prisma.department.findUnique({
      where: { id: parentId },
      select: { level: true },
    });
    return (parent?.level ?? 0) + 1;
  }

  async assignUser(userId: number, departmentId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`用户 ID ${userId} 不存在`);
    }
    const dept = await this.prisma.department.findUnique({
      where: { id: departmentId },
    });
    if (!dept) {
      throw new NotFoundException(`部门 ID ${departmentId} 不存在`);
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { departmentId },
    });
    return { userId, departmentId };
  }

  async batchAssignUsers(userIds: number[], departmentId: number) {
    const dept = await this.prisma.department.findUnique({
      where: { id: departmentId },
    });
    if (!dept) {
      throw new NotFoundException(`部门 ID ${departmentId} 不存在`);
    }
    await this.prisma.user.updateMany({
      where: { id: { in: userIds } },
      data: { departmentId },
    });
    return { userIds, departmentId };
  }

  async removeUser(userId: number, departmentId: number) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { departmentId: null },
    });
    return { userId, departmentId };
  }

  async assignRole(roleId: number, departmentId: number) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) {
      throw new NotFoundException(`角色 ID ${roleId} 不存在`);
    }
    const dept = await this.prisma.department.findUnique({
      where: { id: departmentId },
    });
    if (!dept) {
      throw new NotFoundException(`部门 ID ${departmentId} 不存在`);
    }
    await this.prisma.roleDepartment.upsert({
      where: {
        roleId_departmentId: { roleId, departmentId },
      },
      create: { roleId, departmentId },
      update: {},
    });
    return { roleId, departmentId };
  }

  async removeRole(roleId: number, departmentId: number) {
    await this.prisma.roleDepartment.deleteMany({
      where: { roleId, departmentId },
    });
    return { roleId, departmentId };
  }

  async updateStatus(id: number, status: number) {
    const department = await this.prisma.department.findUnique({
      where: { id },
    });
    if (!department) {
      throw new NotFoundException(`部门 ID ${id} 不存在`);
    }
    await this.prisma.department.update({
      where: { id },
      data: { status },
    });
    return { id, status };
  }

  private formatDepartment(department: Department) {
    return {
      id: department.id,
      name: department.name,
      code: department.code,
      description: department.description,
      level: department.level,
      sortOrder: department.sortOrder,
      status: department.status,
      managerId: department.managerId,
      parentId: department.parentId,
      createdTime: department.createdTime,
      updatedTime: department.updatedTime,
    };
  }

  private buildTree(
    departments: Array<
      Department & { manager?: { name: string | null } | null }
    >,
    parentId: number | null = null,
  ): DepartmentTreeNode[] {
    return departments
      .filter((dept) => dept.parentId === parentId)
      .map((dept): DepartmentTreeNode => {
        const formatted: DepartmentTreeNode = {
          id: dept.id,
          name: dept.name,
          code: dept.code,
          description: dept.description,
          level: dept.level,
          sortOrder: dept.sortOrder,
          status: dept.status,
          managerId: dept.managerId,
          managerName: dept.manager?.name,
          parentId: dept.parentId,
        };
        const children: DepartmentTreeNode[] = this.buildTree(
          departments,
          dept.id,
        );
        if (children.length > 0) {
          return { ...formatted, children };
        }
        return formatted;
      });
  }
}
