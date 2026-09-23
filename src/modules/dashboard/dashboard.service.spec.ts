/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '@/prisma/prisma.service';
import { SessionService } from '@/modules/session/session.service';

describe('DashboardService', () => {
  let service: DashboardService;
  let prisma: jest.Mocked<PrismaService>;
  let sessionService: jest.Mocked<SessionService>;

  /** 本地时区 YYYY-MM-DD(与服务端 formatDay 对齐) */
  const dayKey = (daysAgo: number) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - daysAgo);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${month}-${day}`;
  };

  const logRow = (overrides: Record<string, unknown> = {}) => ({
    id: 1,
    username: 'admin',
    description: '登录系统',
    url: '/api/auth/login',
    module: '认证模块',
    operationType: 'LOGIN',
    status: 'SUCCESS',
    createdTime: new Date('2026-01-01T00:00:00Z'),
    user: { id: 1, username: 'admin', name: '管理员' },
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        {
          provide: PrismaService,
          useValue: {
            user: { count: jest.fn() },
            role: { count: jest.fn() },
            menu: { count: jest.fn() },
            department: { count: jest.fn() },
            operationLog: { count: jest.fn(), findMany: jest.fn() },
            todo: { count: jest.fn(), findMany: jest.fn() },
            userNotice: { count: jest.fn(), findMany: jest.fn() },
            $queryRaw: jest.fn(),
          },
        },
        {
          provide: SessionService,
          useValue: { getStats: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
    prisma = module.get(PrismaService);
    sessionService = module.get(SessionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getStats', () => {
    it('onlineCount should come from SessionService instead of hardcode', async () => {
      (prisma.user.count as jest.Mock).mockResolvedValue(0);
      (prisma.role.count as jest.Mock).mockResolvedValue(0);
      (prisma.menu.count as jest.Mock).mockResolvedValue(0);
      (prisma.department.count as jest.Mock).mockResolvedValue(0);
      (prisma.operationLog.count as jest.Mock).mockResolvedValue(0);
      sessionService.getStats.mockResolvedValue({ online: 3, total: 9 });

      const stats = await service.getStats();

      expect(stats.onlineCount).toBe(3);
      expect(sessionService.getStats).toHaveBeenCalled();
    });
  });

  describe('getTrends', () => {
    it('should aggregate via parameterized SQL and fill missing days with 0', async () => {
      // Promise.all 中的调用顺序:visits(ClientEvent) → operations → newUsers
      (prisma.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([{ day: dayKey(0), cnt: 3n }])
        .mockResolvedValueOnce([{ day: dayKey(4), cnt: 2n }])
        .mockResolvedValueOnce([{ day: dayKey(6), cnt: 1n }]);

      const trends = await service.getTrends(7);

      expect(trends.dates).toHaveLength(7);
      expect(trends.dates[0]).toBe(dayKey(6));
      expect(trends.dates[6]).toBe(dayKey(0));
      // visits: 仅最后一天有 3 次 pageview,其余补 0
      expect(trends.visits).toEqual([0, 0, 0, 0, 0, 0, 3]);
      // operations: dayKey(4) 对应下标 2
      expect(trends.operations).toEqual([0, 0, 2, 0, 0, 0, 0]);
      // newUsers: dayKey(6) 对应下标 0
      expect(trends.newUsers).toEqual([1, 0, 0, 0, 0, 0, 0]);

      // 参数化:每条 SQL 的日期阈值都应是绑定参数(Date),而非拼接字符串
      const calls = (prisma.$queryRaw as jest.Mock).mock.calls;
      expect(calls).toHaveLength(3);
      for (const call of calls) {
        const sql = call[0] as { values: unknown[] };
        expect(sql.values).toHaveLength(1);
        expect(sql.values[0]).toBeInstanceOf(Date);
      }
    });

    it('should query pageview events and operation logs from distinct sources', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);
      (prisma.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await service.getTrends(7);

      const queries = (prisma.$queryRaw as jest.Mock).mock.calls.map((call) =>
        String((call[0] as { text?: string }).text ?? ''),
      );
      expect(queries.some((q) => q.includes('client_event'))).toBe(true);
      expect(queries.some((q) => q.includes('operation_log'))).toBe(true);
      expect(queries.some((q) => q.includes("'pageview'"))).toBe(true);
    });
  });

  describe('getMine', () => {
    it('should return todo/notice/myActivities blocks in parallel', async () => {
      (prisma.todo.count as jest.Mock)
        .mockResolvedValueOnce(5) // openCount
        .mockResolvedValueOnce(12); // doneCount
      (prisma.todo.findMany as jest.Mock).mockResolvedValue([
        { id: 2, title: '整理周报', isDone: false, createdTime: new Date() },
      ]);
      (prisma.userNotice.count as jest.Mock).mockResolvedValue(2);
      (prisma.userNotice.findMany as jest.Mock).mockResolvedValue([
        {
          id: 10,
          noticeId: 3,
          readTime: null,
          assignedTime: new Date(),
          notice: {
            title: '系统维护通知',
            publishedAt: new Date(),
            type: 'NOTICE',
            isPinned: true,
            isMandatory: false,
          },
        },
      ]);
      (prisma.operationLog.findMany as jest.Mock).mockResolvedValue([logRow()]);

      const mine = await service.getMine(7);

      expect(mine.todo).toEqual({
        openCount: 5,
        doneCount: 12,
        recent: [
          {
            id: 2,
            title: '整理周报',
            isDone: false,
            createdTime: expect.any(Date),
          },
        ],
      });
      expect(mine.notice.unreadCount).toBe(2);
      expect(mine.notice.recent[0]).toMatchObject({
        noticeId: 3,
        title: '系统维护通知',
        type: 'NOTICE',
        isPinned: true,
        isMandatory: false,
        readTime: null,
      });
      expect(mine.myActivities[0]).toMatchObject({
        username: 'admin',
        action: '登录系统',
        status: 'SUCCESS',
      });

      // 查询限定在当前用户
      expect(prisma.todo.count.mock.calls[0][0]).toEqual({
        where: { userId: 7, isDone: false },
      });
      expect(prisma.operationLog.findMany.mock.calls[0][0].where).toEqual({
        userId: 7,
      });
    });

    it('should degrade single failed block to empty value without throwing', async () => {
      (prisma.todo.count as jest.Mock).mockRejectedValue(
        new Error('todo db down'),
      );
      (prisma.todo.findMany as jest.Mock).mockRejectedValue(
        new Error('todo db down'),
      );
      (prisma.userNotice.count as jest.Mock).mockResolvedValue(1);
      (prisma.userNotice.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.operationLog.findMany as jest.Mock).mockResolvedValue([logRow()]);

      const mine = await service.getMine(7);

      expect(mine.todo).toEqual({ openCount: 0, doneCount: 0, recent: [] });
      expect(mine.notice.unreadCount).toBe(1);
      expect(mine.myActivities).toHaveLength(1);
    });
  });

  describe('getActivities', () => {
    it('should return all logs when caller holds audit permission', async () => {
      (prisma.operationLog.findMany as jest.Mock).mockResolvedValue([logRow()]);

      await service.getActivities(8, {
        userId: 1,
        permissions: ['system:operation-log:list'],
      });

      expect(prisma.operationLog.findMany.mock.calls[0][0].where).toEqual({});
    });

    it('should force userId filter when caller lacks audit permission', async () => {
      (prisma.operationLog.findMany as jest.Mock).mockResolvedValue([]);

      await service.getActivities(8, { userId: 7, permissions: [] });

      expect(prisma.operationLog.findMany.mock.calls[0][0].where).toEqual({
        userId: 7,
      });
    });

    it('should return empty without caller', async () => {
      await expect(service.getActivities(8)).resolves.toEqual([]);
      expect(prisma.operationLog.findMany).not.toHaveBeenCalled();
    });

    it('should map username/action fallbacks like before', async () => {
      (prisma.operationLog.findMany as jest.Mock).mockResolvedValue([
        logRow({
          username: null,
          description: null,
          url: '/api/system/user/list',
        }),
      ]);

      const activities = await service.getActivities(8, { userId: 7 });

      expect(activities[0]).toEqual({
        id: 1,
        username: 'admin',
        action: '/api/system/user/list',
        module: '认证模块',
        operationType: 'LOGIN',
        time: expect.any(Date),
        status: 'SUCCESS',
      });
    });
  });
});
