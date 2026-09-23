import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

export interface GroupedPermission {
  module: string;
  permissions: {
    id: number;
    code: string;
    name: string;
    menuId: number | null;
    enable: boolean;
  }[];
}

@Injectable()
export class PermissionService {
  constructor(private readonly prisma: PrismaService) {}

  /** 获取全部功能权限（按模块分组），供角色分配等场景使用 */
  async findAllGrouped(): Promise<GroupedPermission[]> {
    const permissions = await this.prisma.permission.findMany({
      where: { enable: true },
      select: {
        id: true,
        code: true,
        name: true,
        module: true,
        menuId: true,
        enable: true,
      },
      orderBy: [{ module: 'asc' }, { code: 'asc' }],
    });

    const grouped = new Map<string, GroupedPermission>();
    for (const permission of permissions) {
      let group = grouped.get(permission.module);
      if (!group) {
        group = { module: permission.module, permissions: [] };
        grouped.set(permission.module, group);
      }
      group.permissions.push({
        id: permission.id,
        code: permission.code,
        name: permission.name,
        menuId: permission.menuId,
        enable: permission.enable,
      });
    }

    return [...grouped.values()];
  }

  /** 获取角色已分配的权限ID列表 */
  async findPermissionIdsByRole(roleId: number): Promise<number[]> {
    const rows = await this.prisma.rolePermission.findMany({
      where: { roleId },
      select: { permissionId: true },
    });
    return rows.map((row) => row.permissionId);
  }

  async findRawPermission(id: number) {
    const permission = await this.prisma.permission.findUnique({
      where: { id },
    });
    if (!permission) {
      throw new NotFoundException(`权限 ID ${id} 不存在`);
    }
    return permission;
  }
}
