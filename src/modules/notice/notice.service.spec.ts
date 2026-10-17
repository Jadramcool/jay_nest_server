import { BadRequestException, NotFoundException } from '@nestjs/common';
import { NoticeService } from './notice.service';
import { PrismaService } from '@/prisma/prisma.service';
import { NoticeGateway } from './notice.gateway';

/**
 * 公告「已清理」列表与恢复的单测。
 *
 * 背景:保留期清理会把公告软删(`isDeleted=true`),管理端需要能筛出来并恢复,
 * 所以这里锁两件事:列表的 isDeleted 过滤(默认只看未清理)与 restore 的前置校验。
 */
function createHarness(notice: Record<string, unknown> | null) {
  const calls: {
    findManyWhere?: Record<string, unknown>;
    countWhere?: Record<string, unknown>;
    update?: Record<string, unknown>;
  } = {};

  const prisma = {
    notice: {
      findMany: ({ where }: { where: Record<string, unknown> }) => {
        calls.findManyWhere = where;
        return [];
      },
      count: ({ where }: { where: Record<string, unknown> }) => {
        calls.countWhere = where;
        return 0;
      },
      findUnique: () => notice,
      update: ({
        where,
        data,
      }: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      }) => {
        calls.update = { where, data };
        return { ...notice, ...data };
      },
    },
    userNotice: { groupBy: () => [] },
  } as unknown as PrismaService;

  const gateway = { emitToUser: () => {} } as unknown as NoticeGateway;

  return { service: new NoticeService(prisma, gateway), calls };
}

describe('NoticeService 清理与恢复', () => {
  it('默认只查未清理的公告', async () => {
    const { service, calls } = createHarness(null);

    await service.findAll({ page: 1, pageSize: 10 });

    expect(calls.findManyWhere).toMatchObject({ isDeleted: false });
    expect(calls.countWhere).toMatchObject({ isDeleted: false });
  });

  it('isDeleted=true 时查询已清理的公告', async () => {
    const { service, calls } = createHarness(null);

    await service.findAll({ page: 1, pageSize: 10, isDeleted: true });

    expect(calls.findManyWhere).toMatchObject({ isDeleted: true });
  });

  it('恢复已清理的公告:清空软删标记', async () => {
    const { service, calls } = createHarness({
      id: 7,
      title: '旧公告',
      isDeleted: true,
    });

    const result = await service.restore(7);

    expect(result).toMatchObject({ id: 7, isDeleted: false });
    expect(calls.update).toMatchObject({
      where: { id: 7 },
      data: { isDeleted: false, deletedTime: null },
    });
  });

  it('公告不存在 → 404', async () => {
    const { service } = createHarness(null);

    await expect(service.restore(999)).rejects.toThrow(NotFoundException);
  });

  it('未被清理的公告无需恢复 → 400', async () => {
    const { service } = createHarness({
      id: 8,
      title: '正常公告',
      isDeleted: false,
    });

    await expect(service.restore(8)).rejects.toThrow(BadRequestException);
  });
});
