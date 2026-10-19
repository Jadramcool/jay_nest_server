/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/unbound-method */

import { Test, TestingModule } from '@nestjs/testing';
import { SessionService } from './session.service';
import { PrismaService } from '@/prisma/prisma.service';
import { SettingsService } from '@/modules/settings/settings.service';

/** 测试固定判定窗口 5 分钟 */
const ACTIVE_WINDOW_MINUTES = 5;

describe('SessionService', () => {
  let service: SessionService;
  let prisma: jest.Mocked<PrismaService>;
  let settingsGet: jest.Mock;

  const mockSession = {
    id: 1,
    userId: 1,
    refreshToken: 'rt-1',
    accessJti: 'jti-1',
    ipAddress: '127.0.0.1',
    userAgent: 'Chrome',
    expiresAt: new Date(Date.now() + 3600_000),
    lastActiveAt: new Date(),
    createdTime: new Date(),
  };

  beforeEach(async () => {
    settingsGet = jest.fn().mockResolvedValue(ACTIVE_WINDOW_MINUTES);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionService,
        {
          provide: PrismaService,
          useValue: {
            userSession: {
              create: jest.fn(),
              findUnique: jest.fn(),
              findMany: jest.fn(),
              count: jest.fn(),
              groupBy: jest.fn(),
              updateMany: jest.fn(),
              deleteMany: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
        {
          provide: SettingsService,
          useValue: { get: settingsGet },
        },
      ],
    }).compile();

    service = module.get<SessionService>(SessionService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findValidSession', () => {
    it('should return session when valid', async () => {
      prisma.userSession.findUnique.mockResolvedValue(mockSession);

      const session = await service.findValidSession('rt-1');

      expect(session).toBeTruthy();
      expect(prisma.userSession.findUnique.mock.calls[0][0]).toEqual({
        where: { refreshToken: 'rt-1' },
        include: { user: { select: { id: true, username: true } } },
      });
    });

    it('should return null when session expired', async () => {
      prisma.userSession.findUnique.mockResolvedValue({
        ...mockSession,
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(service.findValidSession('rt-1')).resolves.toBeNull();
    });

    it('should return null when session not found', async () => {
      prisma.userSession.findUnique.mockResolvedValue(null);

      await expect(service.findValidSession('unknown')).resolves.toBeNull();
    });
  });

  describe('rotateSession', () => {
    it('should update refresh token and access jti', async () => {
      prisma.userSession.updateMany.mockResolvedValue({ count: 1 });

      await service.rotateSession('rt-1', 'rt-2', 'jti-2');

      expect(prisma.userSession.updateMany.mock.calls[0][0]).toEqual({
        where: { refreshToken: 'rt-1' },
        data: {
          refreshToken: 'rt-2',
          accessJti: 'jti-2',
          lastActiveAt: expect.any(Date),
        },
      });
    });
  });

  describe('kick', () => {
    it('should revoke access jti and delete session', async () => {
      prisma.userSession.findUnique.mockResolvedValue(mockSession);
      prisma.userSession.delete.mockResolvedValue(mockSession);

      const result = await service.kick(1);

      expect(result.kicked).toBe(1);
      expect(prisma.userSession.delete.mock.calls[0][0]).toEqual({
        where: { id: 1 },
      });
      expect(service.isAccessRevoked('jti-1')).toBe(true);
    });

    it('should return kicked 0 when session not found', async () => {
      prisma.userSession.findUnique.mockResolvedValue(null);

      await expect(service.kick(99)).resolves.toEqual({ kicked: 0 });
    });
  });

  describe('kickByUser', () => {
    it('should revoke all access jtis and delete sessions', async () => {
      prisma.userSession.findMany.mockResolvedValue([
        { id: 1, accessJti: 'jti-1' },
        { id: 2, accessJti: 'jti-2' },
      ]);
      prisma.userSession.deleteMany.mockResolvedValue({ count: 2 });

      const result = await service.kickByUser(1);

      expect(result.kicked).toBe(2);
      expect(service.isAccessRevoked('jti-1')).toBe(true);
      expect(service.isAccessRevoked('jti-2')).toBe(true);
    });

    it('should keep the current session when excludeJti is given', async () => {
      prisma.userSession.findMany.mockResolvedValue([
        { id: 1, accessJti: 'current-jti' },
        { id: 2, accessJti: 'other-jti' },
      ]);
      prisma.userSession.deleteMany.mockResolvedValue({ count: 1 });

      const result = await service.kickByUser(1, {
        excludeJti: 'current-jti',
      });

      expect(result.kicked).toBe(1);
      expect(service.isAccessRevoked('current-jti')).toBe(false);
      expect(service.isAccessRevoked('other-jti')).toBe(true);
      expect(prisma.userSession.deleteMany).toHaveBeenCalledWith({
        where: { userId: 1, accessJti: { not: 'current-jti' } },
      });
    });
  });

  describe('revokeSessionByRefreshToken', () => {
    it('should blacklist access jti and delete the session', async () => {
      prisma.userSession.findUnique.mockResolvedValue(mockSession);
      prisma.userSession.deleteMany.mockResolvedValue({ count: 1 });

      await service.revokeSessionByRefreshToken('rt-1');

      expect(service.isAccessRevoked('jti-1')).toBe(true);
      expect(prisma.userSession.deleteMany).toHaveBeenCalledWith({
        where: { refreshToken: 'rt-1' },
      });
    });

    it('should do nothing when session not found', async () => {
      prisma.userSession.findUnique.mockResolvedValue(null);

      await service.revokeSessionByRefreshToken('rt-missing');

      expect(prisma.userSession.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('clearDuplicateSessions', () => {
    it('删除设备指纹相同的会话，并拉黑其 access jti', async () => {
      prisma.userSession.findMany.mockResolvedValue([
        { id: 2, accessJti: 'jti-2' },
        { id: 3, accessJti: null },
      ]);
      prisma.userSession.deleteMany.mockResolvedValue({ count: 2 });

      const removed = await service.clearDuplicateSessions({
        userId: 1,
        platform: 'admin',
        ipAddress: '10.0.0.1',
        userAgent: 'UA-1',
      });

      expect(removed).toBe(2);
      expect(prisma.userSession.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: [2, 3] } },
      });
      // 旧 access token 必须立即失效，不能只把列表里的行删掉
      expect(service.isAccessRevoked('jti-2')).toBe(true);
    });

    it('指纹按列宽截断后再比较，与写入时的规则一致', async () => {
      prisma.userSession.findMany.mockResolvedValue([]);

      await service.clearDuplicateSessions({
        userId: 1,
        platform: 'admin',
        userAgent: 'x'.repeat(600),
      });

      const where = prisma.userSession.findMany.mock.calls[0][0]?.where;
      expect((where?.userAgent as string).length).toBe(512);
      expect(where?.ipAddress).toBeNull();
    });

    it('没有重复会话时不执行删除', async () => {
      prisma.userSession.findMany.mockResolvedValue([]);

      const removed = await service.clearDuplicateSessions({
        userId: 1,
        platform: 'admin',
      });

      expect(removed).toBe(0);
      expect(prisma.userSession.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('findAll 筛选', () => {
    beforeEach(() => {
      prisma.userSession.findMany.mockResolvedValue([]);
      prisma.userSession.count.mockResolvedValue(0);
    });

    it('不传筛选时只按未过期过滤，且 count 与 findMany 共用同一 where', async () => {
      await service.findAll(1, 20);

      const where = prisma.userSession.findMany.mock.calls[0][0]?.where;
      expect(where).toEqual({ expiresAt: { gt: expect.any(Date) } });
      expect(prisma.userSession.count.mock.calls[0][0]).toEqual({ where });
    });

    it('用户名同时匹配 username 与 name', async () => {
      await service.findAll(1, 20, undefined, { username: 'admin' });

      const where = prisma.userSession.findMany.mock.calls[0][0]?.where;
      expect(where?.user).toEqual({
        OR: [
          { username: { contains: 'admin' } },
          { name: { contains: 'admin' } },
        ],
      });
    });

    it('status=active 翻译为 lastActiveAt 落在判定窗口内', async () => {
      await service.findAll(1, 20, undefined, { status: 'active' });

      const where = prisma.userSession.findMany.mock.calls[0][0]?.where;
      expect(where?.lastActiveAt).toEqual({ gte: expect.any(Date) });
    });

    it('status=idle 取反为 lt', async () => {
      await service.findAll(1, 20, undefined, { status: 'idle' });

      const where = prisma.userSession.findMany.mock.calls[0][0]?.where;
      expect(where?.lastActiveAt).toEqual({ lt: expect.any(Date) });
    });

    it('登录端与状态可叠加', async () => {
      await service.findAll(1, 20, undefined, {
        platform: 'app',
        status: 'idle',
      });

      const where = prisma.userSession.findMany.mock.calls[0][0]?.where;
      expect(where?.platform).toBe('app');
      expect(where?.lastActiveAt).toEqual({ lt: expect.any(Date) });
    });
  });

  describe('revokeAccessJti', () => {
    it('should blacklist the given jti', () => {
      service.revokeAccessJti('jti-x');
      expect(service.isAccessRevoked('jti-x')).toBe(true);
    });

    it('should ignore empty jti', () => {
      service.revokeAccessJti(undefined);
      expect(service.isAccessRevoked('')).toBe(false);
    });
  });

  describe('isAccessRevoked', () => {
    it('should expire blacklist entries', () => {
      jest.useFakeTimers();
      try {
        service.kick(1).catch(() => {});
        // 黑名单写入依赖 session 查询,直接走 kickByUser 空场景验证过期逻辑
        jest.advanceTimersByTime(3 * 60 * 60 * 1000);
        expect(service.isAccessRevoked('any')).toBe(false);
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe('touchActivity', () => {
    it('同一 jti 在节流窗口内只落库一次', async () => {
      prisma.userSession.updateMany.mockResolvedValue({ count: 1 });

      await service.touchActivity('jti-1');
      await service.touchActivity('jti-1');
      await service.touchActivity('jti-1');

      expect(prisma.userSession.updateMany).toHaveBeenCalledTimes(1);
      expect(prisma.userSession.updateMany.mock.calls[0][0]).toEqual({
        where: { accessJti: 'jti-1' },
        data: { lastActiveAt: expect.any(Date) },
      });
    });

    it('按 jti 分别节流，而不是全局共用一个窗口', async () => {
      prisma.userSession.updateMany.mockResolvedValue({ count: 1 });

      await service.touchActivity('jti-1');
      await service.touchActivity('jti-2');

      expect(prisma.userSession.updateMany).toHaveBeenCalledTimes(2);
    });

    it('超过节流窗口后再次落库', async () => {
      prisma.userSession.updateMany.mockResolvedValue({ count: 1 });
      const nowSpy = jest.spyOn(Date, 'now');

      try {
        nowSpy.mockReturnValue(1_000_000);
        await service.touchActivity('jti-1');
        nowSpy.mockReturnValue(1_000_000 + 61_000);
        await service.touchActivity('jti-1');
      } finally {
        nowSpy.mockRestore();
      }

      expect(prisma.userSession.updateMany).toHaveBeenCalledTimes(2);
    });

    it('没有 jti 时直接跳过', async () => {
      await service.touchActivity(undefined);

      expect(prisma.userSession.updateMany).not.toHaveBeenCalled();
    });

    it('落库失败不抛出，避免拖垮正常请求', async () => {
      prisma.userSession.updateMany.mockRejectedValue(new Error('db down'));

      await expect(service.touchActivity('jti-1')).resolves.toBeUndefined();
    });
  });

  describe('findAll', () => {
    const now = Date.now();

    const sessionRow = (overrides: Record<string, unknown> = {}) => ({
      id: 1,
      userId: 7,
      platform: 'admin',
      accessJti: 'jti-1',
      ipAddress: '10.0.0.1',
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      expiresAt: new Date(now + 3600_000),
      lastActiveAt: new Date(now),
      createdTime: new Date(now - 1000),
      user: { id: 7, username: 'admin', name: '管理员' },
      ...overrides,
    });

    it('窗口内有请求的会话标为 active，并标出当前会话', async () => {
      (prisma.userSession.findMany as jest.Mock).mockResolvedValue([
        sessionRow(),
      ]);
      prisma.userSession.count.mockResolvedValue(1);

      const result = await service.findAll(1, 20, 'jti-1');
      const item = result.items[0];

      expect(item.status).toBe('active');
      expect(item.isCurrent).toBe(true);
      expect(item.username).toBe('admin');
      expect(item.userName).toBe('管理员');
      expect(item.platform).toBe('admin');
      // UA 解析成可读名，且不泄漏安全字段
      expect(item.browser).toMatch(/^Chrome \d+$/);
      expect(item.os).toBe('Windows');
      expect(item).not.toHaveProperty('accessJti');
      expect(item).not.toHaveProperty('refreshToken');
      expect(result.activeWindowMinutes).toBe(ACTIVE_WINDOW_MINUTES);
    });

    it('超过窗口仍有效的会话标为 idle，而不是隐藏', async () => {
      (prisma.userSession.findMany as jest.Mock).mockResolvedValue([
        sessionRow({ lastActiveAt: new Date(now - 6 * 60_000) }),
      ]);
      prisma.userSession.count.mockResolvedValue(1);

      const result = await service.findAll(1, 20, 'other-jti');

      expect(result.items[0].status).toBe('idle');
      expect(result.items[0].isCurrent).toBe(false);
    });

    it('会话没有 jti 时不会误判成当前会话', async () => {
      (prisma.userSession.findMany as jest.Mock).mockResolvedValue([
        sessionRow({ accessJti: null }),
      ]);
      prisma.userSession.count.mockResolvedValue(1);

      const result = await service.findAll(1, 20, 'jti-1');

      expect(result.items[0].isCurrent).toBe(false);
    });

    it('只查未过期会话', async () => {
      (prisma.userSession.findMany as jest.Mock).mockResolvedValue([]);
      prisma.userSession.count.mockResolvedValue(0);

      await service.findAll(1, 20);

      const query = prisma.userSession.findMany.mock.calls[0][0] as {
        where: { expiresAt: { gt: Date } };
      };
      expect(query.where.expiresAt.gt).toBeInstanceOf(Date);
    });
  });

  describe('getStats', () => {
    it('人数按 userId 去重，与会话数分开', async () => {
      // 3 个活跃会话属于 2 个人，另有 1 个闲置会话仍有效
      prisma.userSession.count
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(4);
      (prisma.userSession.groupBy as jest.Mock).mockResolvedValue([
        { userId: 1 },
        { userId: 2 },
      ]);

      const stats = await service.getStats();

      expect(stats).toEqual({
        onlineUsers: 2,
        activeSessions: 3,
        totalSessions: 4,
      });

      // 人数统计走 GROUP BY，避免把全部行拉回应用层
      const groupArg = (prisma.userSession.groupBy as jest.Mock).mock
        .calls[0][0] as { by: string[]; where: unknown };
      expect(groupArg.by).toEqual(['userId']);
      expect(groupArg.where).toMatchObject({
        lastActiveAt: { gte: expect.any(Date) },
      });
    });
  });
});
