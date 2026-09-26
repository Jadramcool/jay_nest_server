import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { MenuService } from './menu.service';
import { PrismaService } from '@/prisma/prisma.service';

interface MenuRow {
  id: number;
  name: string;
  code: string;
  permission: string | null;
  type: string;
  pid: number | null;
  [key: string]: unknown;
}

/**
 * 菜单树结构约束验证。
 *
 * 同一棵树承载导航层（目录/菜单）与权限层（按钮），本文件锁定四条不变量：
 * 1. 父子类型约束：目录/菜单的父级只能是目录；按钮必须挂在菜单下
 * 2. 防环：节点不能挂到自己或自己的后代下
 * 3. 类型变更：改类型后已有子节点必须仍然合法
 * 4. 权限码归属：只声明在按钮行，目录/菜单行的 permission 一律落库为 null
 */
describe('MenuService 菜单树结构约束', () => {
  let service: MenuService;
  let rows: MenuRow[];
  let nextId: number;

  /** 构造一行菜单（补齐 formatMenu 需要的字段） */
  function buildRow(over: Partial<MenuRow> = {}): MenuRow {
    return {
      id: 1,
      name: '节点',
      code: 'Node',
      permission: null,
      type: 'MENU',
      platform: 'admin',
      pid: null,
      path: null,
      redirect: null,
      icon: null,
      component: null,
      layout: 'normal',
      keepAlive: false,
      method: null,
      description: null,
      show: true,
      enable: true,
      order: 0,
      isFrame: false,
      frameSrc: null,
      target: '_self',
      affix: false,
      alwaysShow: null,
      badge: null,
      badgeType: null,
      needLogin: true,
      extraData: null,
      createdTime: new Date('2026-01-01'),
      updatedTime: null,
      ...over,
    };
  }

  /** 极简 where 匹配，覆盖本服务用到的 eq / in / not 三种形态 */
  function matches(row: MenuRow, where: Record<string, unknown>): boolean {
    return Object.entries(where).every(([key, value]) => {
      if (value !== null && typeof value === 'object') {
        const condition = value as { not?: unknown; in?: unknown[] };
        if ('not' in condition) return row[key] !== condition.not;
        if ('in' in condition) return (condition.in ?? []).includes(row[key]);
      }
      return row[key] === value;
    });
  }

  const prismaMock = {
    menu: {
      findUnique: jest.fn((args: { where: { id?: number; code?: string } }) =>
        Promise.resolve(
          args.where.id !== undefined
            ? (rows.find((row) => row.id === args.where.id) ?? null)
            : (rows.find((row) => row.code === args.where.code) ?? null),
        ),
      ),
      findFirst: jest.fn((args: { where: Record<string, unknown> }) =>
        Promise.resolve(rows.find((row) => matches(row, args.where)) ?? null),
      ),
      findMany: jest.fn((args: { where: Record<string, unknown> }) =>
        Promise.resolve(rows.filter((row) => matches(row, args.where))),
      ),
      create: jest.fn((args: { data: Record<string, unknown> }) => {
        const row = buildRow({ id: nextId++, ...args.data });
        rows.push(row);
        return Promise.resolve(row);
      }),
      update: jest.fn(
        (args: { where: { id: number }; data: Record<string, unknown> }) => {
          const row = rows.find((item) => item.id === args.where.id);
          if (!row) throw new Error(`菜单 ID ${args.where.id} 不存在`);
          Object.assign(row, args.data);
          return Promise.resolve(row);
        },
      ),
    },
    roleMenu: {
      upsert: jest.fn(() => Promise.resolve({})),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    nextId = 100;
    // 目录(1) → 菜单(2) → 按钮(3)，另有一个同级菜单(4)
    rows = [
      buildRow({ id: 1, name: '系统管理', code: 'System', type: 'DIRECTORY' }),
      buildRow({
        id: 2,
        name: '用户列表',
        code: 'UserList',
        type: 'MENU',
        pid: 1,
      }),
      buildRow({
        id: 3,
        name: '新增用户',
        code: 'system:user:create',
        permission: 'system:user:create',
        type: 'BUTTON',
        pid: 2,
      }),
      buildRow({ id: 4, name: '角色管理', code: 'Role', type: 'MENU', pid: 1 }),
    ];

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MenuService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get(MenuService);
  });

  describe('父子类型约束', () => {
    it('按钮可以挂在目录下（模块级操作，与现有数据约定一致）', async () => {
      const created = await service.create({
        name: '新增角色',
        code: 'system:role:create',
        permission: 'system:role:create',
        type: 'BUTTON',
        pid: 1, // 目录
      });

      expect(created.pid).toBe(1);
    });

    it('按钮不能挂在按钮下', async () => {
      await expect(
        service.create({
          name: '嵌套按钮',
          code: 'nested:button',
          permission: 'nested:button',
          type: 'BUTTON',
          pid: 3, // 按钮
        }),
      ).rejects.toThrow(
        new BadRequestException(
          '按钮的父级只能是目录、菜单，当前选择的是按钮「新增用户」',
        ),
      );
    });

    it('按钮不允许作为根节点', async () => {
      await expect(
        service.create({
          name: '游离按钮',
          code: 'loose:button',
          permission: 'loose:button',
          type: 'BUTTON',
        }),
      ).rejects.toThrow('按钮必须挂在目录、菜单下');
    });

    it('菜单的父级只能是目录：挂到菜单下应被拒绝', async () => {
      await expect(
        service.create({
          name: '二级页面',
          code: 'Nested',
          type: 'MENU',
          pid: 2, // 菜单
        }),
      ).rejects.toThrow(
        '菜单的父级只能是根节点或目录，当前选择的是菜单「用户列表」',
      );
    });

    it('父级不存在时给出明确提示', async () => {
      await expect(
        service.create({
          name: '孤儿菜单',
          code: 'Orphan',
          type: 'MENU',
          pid: 999,
        }),
      ).rejects.toThrow('父级菜单 ID 999 不存在');
    });
  });

  describe('防环', () => {
    // 类型约束下只有「目录 → 目录」能形成祖先链（菜单的子节点只能是按钮、
    // 按钮是叶子），所以环只可能出现在目录嵌套里
    beforeEach(() => {
      rows.push(
        buildRow({
          id: 7,
          name: '监控中心',
          code: 'Monitor',
          type: 'DIRECTORY',
          pid: 1,
        }),
        buildRow({
          id: 8,
          name: '监控子目录',
          code: 'MonitorSub',
          type: 'DIRECTORY',
          pid: 7,
        }),
      );
    });

    it('不能把节点挂到它自己下面', async () => {
      await expect(service.update(7, { pid: 7 })).rejects.toThrow(
        '不能把节点挂到它自己下面',
      );
    });

    it('不能把节点移动到它自己的子节点下', async () => {
      await expect(service.update(7, { pid: 8 })).rejects.toThrow(
        '不能把节点移动到它自己的子节点下',
      );
    });

    it('沿父链回溯时遇到自身即判定成环（更深层级）', async () => {
      await expect(service.update(1, { pid: 8 })).rejects.toThrow(
        '不能把节点移动到它自己的子节点下',
      );
    });

    it('合法移动（换个目录当父级）不受影响', async () => {
      const moved = await service.update(4, { pid: 7 });
      expect(moved.pid).toBe(7);
    });
  });

  describe('类型变更与子节点兼容', () => {
    it('有页面子节点的目录不能改成按钮（子节点会失去合法父级）', async () => {
      rows.push(
        buildRow({
          id: 9,
          name: '监控模块',
          code: 'MonitorModule',
          type: 'DIRECTORY',
          pid: 1,
        }),
        buildRow({
          id: 10,
          name: '监控页',
          code: 'MonitorPage',
          type: 'MENU',
          pid: 9,
        }),
      );

      await expect(service.update(9, { type: 'BUTTON' })).rejects.toThrow(
        '该节点下存在菜单「监控页」，不能改为按钮',
      );
    });

    it('页面可以改成目录：按钮挂目录下同样合法', async () => {
      const updated = await service.update(2, { type: 'DIRECTORY' });
      expect(updated.type).toBe('DIRECTORY');
    });

    it('无子节点时允许改类型', async () => {
      const updated = await service.update(4, { type: 'DIRECTORY' });
      expect(updated.type).toBe('DIRECTORY');
    });
  });

  describe('权限码归属（权限码只声明在按钮行）', () => {
    it('按钮未填写权限标识应被拒绝', async () => {
      await expect(
        service.create({
          name: '无码按钮',
          code: 'NoPermission',
          type: 'BUTTON',
          pid: 2,
        }),
      ).rejects.toThrow('按钮权限必须填写权限标识');
    });

    it('权限标识被其他按钮占用应被拒绝', async () => {
      await expect(
        service.create({
          name: '重复按钮',
          code: 'Duplicate',
          permission: 'system:user:create',
          type: 'BUTTON',
          pid: 2,
        }),
      ).rejects.toThrow('权限标识 system:user:create 已被按钮「新增用户」占用');
    });

    it('目录/菜单行携带的 permission 一律落库为 null', async () => {
      const created = await service.create({
        name: '用户编辑',
        code: 'UserEdit',
        permission: 'system:user:update', // 历史写法：页面行也带权限码
        type: 'MENU',
        pid: 1,
      });

      expect(created.permission).toBeNull();
    });

    it('编辑时顺带清理目录/菜单行的历史 permission', async () => {
      rows.push(
        buildRow({
          id: 6,
          name: '遗留页面',
          code: 'Legacy',
          type: 'MENU',
          pid: 1,
          permission: 'system:user:list',
        }),
      );

      const updated = await service.update(6, { name: '遗留页面改名' });

      expect(updated.permission).toBeNull();
    });

    it('按钮保持自身权限码不被清空', async () => {
      const updated = await service.update(3, { name: '新增用户(改名)' });

      expect(updated.permission).toBe('system:user:create');
    });
  });
});
