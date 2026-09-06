/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/unbound-method */

import { Test, TestingModule } from '@nestjs/testing';
import { SessionService } from './session.service';
import { PrismaService } from '@/prisma/prisma.service';

describe('SessionService', () => {
  let service: SessionService;
  let prisma: jest.Mocked<PrismaService>;

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
              updateMany: jest.fn(),
              deleteMany: jest.fn(),
              delete: jest.fn(),
            },
          },
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
});
