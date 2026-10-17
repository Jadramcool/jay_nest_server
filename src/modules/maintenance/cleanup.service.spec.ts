import { CleanupService } from './cleanup.service';
import { PrismaService } from '@/prisma/prisma.service';
import { SettingsService } from '@/modules/settings/settings.service';

/**
 * 保留期清理的单测:重点是"阈值由设置决定"和"应急开关"。
 * 用假的 Prisma / SettingsService 断言 where 条件与是否落库。
 * （业务自有的临时产物由业务模块自己的周期任务处理，不在本模块内）
 */
function createHarness(settings: Record<string, unknown>) {
  const calls: {
    noticeUpdate?: { where: Record<string, unknown>; data: unknown };
    noticeCount?: Record<string, unknown>;
    logDelete?: Record<string, unknown>;
    logCount?: Record<string, unknown>;
  } = {};

  const prisma = {
    notice: {
      count: ({ where }: { where: Record<string, unknown> }) => {
        calls.noticeCount = where;
        return 7;
      },
      updateMany: ({
        where,
        data,
      }: {
        where: Record<string, unknown>;
        data: unknown;
      }) => {
        calls.noticeUpdate = { where, data };
        return { count: 7 };
      },
    },
    operationLog: {
      count: ({ where }: { where: Record<string, unknown> }) => {
        calls.logCount = where;
        return 3;
      },
      deleteMany: ({ where }: { where: Record<string, unknown> }) => {
        calls.logDelete = where;
        return { count: 3 };
      },
    },
  } as unknown as PrismaService;

  const settingsService = {
    get: (key: string) => settings[key],
  } as unknown as SettingsService;

  return { service: new CleanupService(prisma, settingsService), calls };
}

const DEFAULT_SETTINGS = {
  'system.cleanupEnabled': true,
  'notice.retentionDays': 180,
  'operationLog.retentionDays': 365,
};

describe('CleanupService', () => {
  it('两项都按各自设置执行', async () => {
    const { service, calls } = createHarness(DEFAULT_SETTINGS);

    const result = await service.runAll();

    expect(result).toEqual({ skipped: false, notices: 7, operationLogs: 3 });
    // 公告:只清理"已发布 + 未置顶 + 未删除"
    expect(calls.noticeUpdate?.where).toMatchObject({
      isDeleted: false,
      isPinned: false,
      status: 1,
    });
    expect(calls.noticeUpdate?.data).toMatchObject({ isDeleted: true });
    expect(calls.logDelete).toHaveProperty('createdTime');
  });

  it('保留期设置变化后阈值随之变化(公告 30 天 / 日志 90 天)', async () => {
    const { service, calls } = createHarness({
      ...DEFAULT_SETTINGS,
      'notice.retentionDays': 30,
      'operationLog.retentionDays': 90,
    });

    await service.runAll();

    // 保留期以"发布后"起算:where.OR = [publishedAt < cutoff, publishedAt 为空则 createdTime < cutoff]
    const noticeOr = calls.noticeUpdate?.where.OR as Array<{
      publishedAt?: { lt: Date } | null;
      createdTime?: { lt: Date };
    }>;
    const noticeCutoff = noticeOr[0].publishedAt!.lt;
    const logCutoff = (calls.logDelete?.createdTime as { lt: Date }).lt;
    const days = (date: Date) => (Date.now() - date.getTime()) / 86_400_000;

    expect(days(noticeCutoff)).toBeGreaterThan(29.9);
    expect(days(noticeCutoff)).toBeLessThan(30.1);
    // publishedAt 缺失时退回 createdTime,阈值一致
    expect(days(noticeOr[1].createdTime!.lt)).toBeGreaterThan(29.9);
    expect(days(logCutoff)).toBeGreaterThan(89.9);
    expect(days(logCutoff)).toBeLessThan(90.1);
  });

  it('应急开关关闭时两项都不执行', async () => {
    const { service, calls } = createHarness({
      ...DEFAULT_SETTINGS,
      'system.cleanupEnabled': false,
    });

    const result = await service.runAll();

    expect(result).toEqual({ skipped: true, notices: 0, operationLogs: 0 });
    expect(calls.noticeUpdate).toBeUndefined();
    expect(calls.logDelete).toBeUndefined();
  });

  it('dry-run 只统计不落库', async () => {
    const { service, calls } = createHarness(DEFAULT_SETTINGS);

    const result = await service.runAll({ dryRun: true });

    expect(result).toMatchObject({
      skipped: false,
      notices: 7,
      operationLogs: 3,
    });
    expect(calls.noticeUpdate).toBeUndefined();
    expect(calls.logDelete).toBeUndefined();
    expect(calls.noticeCount).toMatchObject({ status: 1, isPinned: false });
    expect(calls.logCount).toHaveProperty('createdTime');
  });
});
