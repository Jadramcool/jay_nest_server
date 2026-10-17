/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { SettingsService } from './settings.service';
import { PrismaService } from '@/prisma/prisma.service';

/**
 * 内存版 Prisma 假实现:只覆盖本模块用到的方法,但走真实业务分支,
 * 便于验证"默认值/覆盖值/乐观锁/历史/回滚/缓存"这些真实行为。
 */
function createFakePrisma() {
  const overrides = new Map<
    string,
    {
      key: string;
      value: string | null;
      version: number;
      updatedBy: number | null;
      updatedName: string | null;
      updatedTime: Date;
    }
  >();
  const history: Record<string, unknown>[] = [];
  let revision = 1n;
  let historyId = 0;
  let overrideReads = 0;

  const api: Record<string, any> = {
    settingOverride: {
      findUnique: ({ where }: any) => {
        overrideReads += 1;
        return overrides.get(where.key) ?? null;
      },
      findMany: (args: any = {}) => {
        const all = [...overrides.values()];
        const keys = args.where?.key?.in as string[] | undefined;
        return keys ? all.filter((row) => keys.includes(row.key)) : all;
      },
      upsert: ({ where, create, update }: any) => {
        const existing = overrides.get(where.key);
        const row = {
          ...(existing ?? create),
          ...update,
          key: where.key,
          updatedTime: new Date(),
        };
        overrides.set(where.key, row);
        return row;
      },
      delete: ({ where }: any) => {
        const row = overrides.get(where.key);
        overrides.delete(where.key);
        return row;
      },
    },
    settingHistory: {
      create: ({ data }: any) => {
        const row = { id: ++historyId, changedTime: new Date(), ...data };
        history.push(row);
        return row;
      },
      findMany: ({ where, skip, take }: any) =>
        history
          .filter((row) => row.key === where.key)
          .slice(skip ?? 0, (skip ?? 0) + (take ?? 20)),
      count: ({ where }: any) =>
        history.filter((row) => row.key === where.key).length,
      findFirst: ({ where }: any) =>
        history.find(
          (row) => row.key === where.key && row.version === where.version,
        ) ?? null,
      aggregate: ({ where }: any) => ({
        _max: {
          version: history
            .filter((row) => row.key === where.key)
            .reduce<
              number | null
            >((max, row) => (max === null || (row.version as number) > max ? (row.version as number) : max), null),
        },
      }),
    },
    settingRevision: {
      findUnique: () => ({ id: 1, revision }),
      upsert: () => {
        revision += 1n;
        return { id: 1, revision };
      },
    },
    dictItem: { findMany: () => [] },
    $transaction: (fn: any) => fn(api),
  };

  return {
    api: api as unknown as PrismaService,
    overrides,
    history,
    overrideReads: () => overrideReads,
  };
}

describe('SettingsService', () => {
  let service: SettingsService;
  let fake: ReturnType<typeof createFakePrisma>;

  beforeEach(() => {
    fake = createFakePrisma();
    service = new SettingsService(fake.api);
  });

  describe('读取', () => {
    it('没有覆盖值时返回注册表默认值', async () => {
      expect(await service.get('site.name')).toBe('Jay Admin');
      expect(await service.get('security.login.maxRetry')).toBe(5);
    });

    it('有覆盖值时按声明类型解析', async () => {
      fake.overrides.set('security.login.maxRetry', {
        key: 'security.login.maxRetry',
        value: '3',
        version: 1,
        updatedBy: null,
        updatedName: null,
        updatedTime: new Date(),
      });
      expect(await service.get('security.login.maxRetry')).toBe(3);
    });

    it('覆盖值不合法时回退默认值', async () => {
      fake.overrides.set('site.primaryColor', {
        key: 'site.primaryColor',
        value: 'not-a-color',
        version: 1,
        updatedBy: null,
        updatedName: null,
        updatedTime: new Date(),
      });
      expect(await service.get('site.primaryColor')).toBe('#1890ff');
    });

    it('getMany 只查一次库并命中缓存', async () => {
      await service.getMany(['site.name', 'site.description']);
      const readsAfterFirst = fake.overrideReads();
      await service.getMany(['site.name', 'site.description']);
      expect(fake.overrideReads()).toBe(readsAfterFirst);
    });
  });

  describe('写入', () => {
    it('写入覆盖值并落历史 + 递增修订号', async () => {
      const view = await service.set('site.name', '新站点名', {
        actor: { userId: 1, username: 'admin' },
        reason: '测试',
      });

      expect(view.value).toBe('新站点名');
      expect(view.source).toBe('db');
      expect(view.version).toBe(1);
      expect(fake.history).toHaveLength(1);
      expect(fake.history[0]).toMatchObject({
        key: 'site.name',
        oldValue: null,
        newValue: '新站点名',
        source: 'api',
        reason: '测试',
        changedName: 'admin',
      });
      // 缓存已失效 → 读到新值
      expect(await service.get('site.name')).toBe('新站点名');
    });

    it('类型不合法时拒绝(颜色格式)', async () => {
      await expect(service.set('site.primaryColor', 'red')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('数字超出 min/max 时拒绝', async () => {
      await expect(service.set('security.login.maxRetry', 999)).rejects.toThrow(
        '不能大于 20',
      );
    });

    it('乐观锁:版本不一致返回 409', async () => {
      await service.set('site.name', 'A');
      await expect(
        service.set('site.name', 'B', { expectedVersion: 99 }),
      ).rejects.toThrow(ConflictException);
    });

    it('未在注册表声明的 key 返回 404', async () => {
      await expect(service.set('site.unknown', 'x')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('重置删除覆盖值并留痕', async () => {
      await service.set('site.name', '临时值');
      const view = await service.reset('site.name', {
        actor: { userId: 1, username: 'admin' },
      });

      expect(view.source).toBe('default');
      expect(view.value).toBe('Jay Admin');
      expect(fake.history).toHaveLength(2);
      expect(fake.history[1]).toMatchObject({ source: 'api', newValue: null });
    });
  });

  describe('历史与回滚', () => {
    it('版本号跨重置保持单调递增(否则回滚会命中重复版本)', async () => {
      const first = await service.set('site.name', 'A');
      expect(first.version).toBe(1);

      await service.reset('site.name');
      const afterReset = await service.set('site.name', 'B');
      expect(afterReset.version).toBe(3);

      // 历史里每个版本号唯一 → 回滚按版本定位不会歧义
      const versions = fake.history.map((row) => row.version as number);
      expect(new Set(versions).size).toBe(versions.length);
    });

    it('回滚某版本 = 恢复到该版本变更前的值', async () => {
      await service.set('security.login.maxRetry', 3);
      await service.set('security.login.maxRetry', 8);

      // 回滚 v2(8) → 回到 v2 变更前的 3
      const rolled = await service.rollback('security.login.maxRetry', 2, {
        actor: { userId: 1, username: 'admin' },
      });

      expect(rolled.value).toBe(3);
      expect(fake.history.at(-1)).toMatchObject({ source: 'rollback' });
    });

    it('第一次修改后回滚 → 回到注册表默认值', async () => {
      await service.set('site.name', '第一次改的值');

      const rolled = await service.rollback('site.name', 1, {
        actor: { userId: 1, username: 'admin' },
      });

      expect(rolled.value).toBe('Jay Admin');
      expect(rolled.source).toBe('default');
      expect(rolled.overridden).toBe(false);
    });

    it('版本不存在返回 404', async () => {
      await expect(service.rollback('site.name', 42)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('历史分页返回总数', async () => {
      await service.set('site.name', 'A');
      await service.set('site.name', 'B');

      const page = await service.history('site.name', 1, 1);
      expect(page.total).toBe(2);
      expect(page.items).toHaveLength(1);
    });
  });

  describe('视图与白名单', () => {
    it('listViews 标出来源/覆盖/版本', async () => {
      await service.set('site.name', 'A');
      const views = await service.listViews();

      const siteName = views.find((view) => view.key === 'site.name');
      expect(siteName).toMatchObject({
        source: 'db',
        overridden: true,
        version: 1,
      });

      const security = views.find(
        (view) => view.key === 'security.login.maxRetry',
      );
      expect(security).toMatchObject({ source: 'default', overridden: false });
    });

    it('listViews 支持按分组过滤', async () => {
      const views = await service.listViews('安全');
      expect(views.every((view) => view.group === '安全')).toBe(true);
      expect(views.length).toBeGreaterThan(0);
    });

    it('publicView 只返回 public 白名单', async () => {
      const result = await service.publicView();
      expect(Object.keys(result)).toContain('site.name');
      expect(Object.keys(result)).not.toContain('security.login.maxRetry');
    });

    it('schema 按分组返回渲染元数据', () => {
      const schema = service.schema();
      expect(schema.groups[0].group).toBe('站点');
      const item = schema.groups
        .flatMap((group) => group.items)
        .find((entry) => entry.key === 'security.login.maxRetry');
      expect(item).toMatchObject({ type: 'number', min: 1, max: 20 });
    });
  });
});
