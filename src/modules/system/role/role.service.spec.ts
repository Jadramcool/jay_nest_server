import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RoleService } from './role.service';

interface MenuRow {
  id: number;
  name: string;
  platform: string;
}

interface MockOptions {
  role?: Record<string, unknown> | null;
  menus?: MenuRow[];
  assignedMenus?: { menu: { name: string; platform: string } }[];
  allRoles?: Record<string, unknown>[];
}

function createService(options: MockOptions = {}) {
  const role =
    options.role === undefined
      ? { id: 1, name: '测试角色', platform: 'admin', isSystem: false }
      : options.role;

  const tx = {
    roleMenu: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    rolePermission: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  };

  const prisma = {
    role: {
      findUnique: jest.fn().mockResolvedValue(role),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue(options.allRoles ?? []),
      update: jest.fn().mockResolvedValue(role),
    },
    menu: {
      findMany: jest.fn().mockResolvedValue(options.menus ?? []),
    },
    roleMenu: {
      // 按 where.menu.platform.notIn 过滤，模拟 Prisma 的 notIn 语义
      findMany: jest.fn(
        ({
          where,
        }: {
          where?: { menu?: { platform?: { notIn?: string[] } } };
        }) => {
          const notIn = where?.menu?.platform?.notIn ?? [];
          return (options.assignedMenus ?? []).filter(
            (item) => !notIn.includes(item.menu.platform),
          );
        },
      ),
    },
    $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
      callback(tx),
    ),
  };

  return {
    service: new RoleService(prisma as never),
    prisma,
    tx,
  };
}

describe('RoleService 端约束', () => {
  it('普通角色可以同时分配本端与通用端菜单', async () => {
    const { service, tx } = createService({
      role: { id: 1, name: '管理员', platform: 'admin', isSystem: false },
      menus: [
        { id: 1, name: '用户管理', platform: 'admin' },
        { id: 2, name: '个人中心', platform: 'common' },
      ],
    });

    await expect(service.assignMenus(1, [1, 2])).resolves.toEqual({
      roleId: 1,
      menuIds: [1, 2],
    });
    expect(tx.roleMenu.createMany).toHaveBeenCalledWith({
      data: [
        { roleId: 1, menuId: 1 },
        { roleId: 1, menuId: 2 },
      ],
    });
  });

  it('普通角色分配其他端菜单时被拒绝', async () => {
    const { service, tx } = createService({
      role: { id: 1, name: '管理员', platform: 'admin', isSystem: false },
      menus: [{ id: 9, name: '体检报告生成', platform: 'app' }],
    });

    await expect(service.assignMenus(1, [9])).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.assignMenus(1, [9])).rejects.toThrow(
      '仅能分配管理端、通用的菜单：体检报告生成',
    );
    expect(tx.roleMenu.deleteMany).not.toHaveBeenCalled();
  });

  it('通用角色可以分配所有端的菜单', async () => {
    const { service } = createService({
      role: { id: 3, name: '运营', platform: 'common', isSystem: false },
      menus: [
        { id: 1, name: '用户管理', platform: 'admin' },
        { id: 9, name: '体检报告生成', platform: 'app' },
        { id: 20, name: '个人中心', platform: 'common' },
      ],
    });

    await expect(service.assignMenus(3, [1, 9, 20])).resolves.toEqual({
      roleId: 3,
      menuIds: [1, 9, 20],
    });
  });

  it('切换端时若已分配新端之外的菜单则要求先清空', async () => {
    const { service } = createService({
      role: { id: 1, name: '管理员', platform: 'admin', isSystem: false },
      assignedMenus: [{ menu: { name: '用户管理', platform: 'admin' } }],
    });

    await expect(service.update(1, { platform: 'app' })).rejects.toThrow(
      '该角色已分配其他端的菜单（用户管理），请先清空权限再切换端',
    );
  });

  it('切换为通用端时不再要求清空权限', async () => {
    const { service, prisma } = createService({
      role: { id: 1, name: '管理员', platform: 'admin', isSystem: false },
      // 管理端菜单在「切到通用端」后仍然合法，不该被判定为跨端授权
      assignedMenus: [{ menu: { name: '用户管理', platform: 'admin' } }],
    });

    await expect(
      service.update(1, { platform: 'common' }),
    ).resolves.toBeDefined();
    expect(prisma.roleMenu.findMany).toHaveBeenCalledWith({
      where: {
        roleId: 1,
        menu: { platform: { notIn: ['admin', 'app', 'mp', 'common'] } },
      },
      select: { menu: { select: { name: true } } },
    });
  });

  it('角色下拉数据带所属端与数量', async () => {
    const { service } = createService({
      allRoles: [
        {
          id: 3,
          code: 'APP',
          name: 'App 用户',
          description: '默认 App 角色',
          isSystem: false,
          platform: 'app',
          createdTime: new Date('2026-01-02T03:04:05.000Z'),
          _count: { menus: 9, users: 1 },
        },
      ],
    });

    await expect(service.findAllSimple()).resolves.toEqual([
      {
        id: 3,
        code: 'APP',
        name: 'App 用户',
        description: '默认 App 角色',
        isSystem: false,
        platform: 'app',
        menuCount: 9,
        userCount: 1,
        createdTime: new Date('2026-01-02T03:04:05.000Z'),
      },
    ]);
  });

  it('角色不存在时抛 NotFound', async () => {
    const { service } = createService({ role: null });

    await expect(service.assignMenus(99, [1])).rejects.toThrow(
      NotFoundException,
    );
  });
});
