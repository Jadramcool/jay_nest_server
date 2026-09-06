import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

/**
 * 登录会话管理 + access token 黑名单(内存实现,单实例有效)
 *
 * - 会话:登录创建、刷新轮换、登出/强制下线删除
 * - 黑名单:强制下线时记录 access token 的 jti,2 小时内失效(与 access 有效期一致)
 */
const ACCESS_BLACKLIST_TTL = 2 * 60 * 60 * 1000; // 2 小时

@Injectable()
export class SessionService {
  private readonly revokedJtis = new Map<string, number>();

  constructor(private readonly prisma: PrismaService) {}

  /** 登录时创建会话 */
  async createSession(params: {
    userId: number;
    refreshToken: string;
    accessJti?: string;
    ipAddress?: string;
    userAgent?: string;
    expiresAt: Date;
  }) {
    return this.prisma.userSession.create({
      data: {
        userId: params.userId,
        refreshToken: params.refreshToken,
        accessJti: params.accessJti ?? null,
        ipAddress: params.ipAddress?.slice(0, 100) ?? null,
        userAgent: params.userAgent?.slice(0, 200) ?? null,
        expiresAt: params.expiresAt,
      },
    });
  }

  /** 刷新时轮换会话(refreshToken 换新 + 更新 access jti) */
  async rotateSession(
    oldRefreshToken: string,
    newRefreshToken: string,
    newAccessJti?: string,
  ) {
    return this.prisma.userSession.updateMany({
      where: { refreshToken: oldRefreshToken },
      data: {
        refreshToken: newRefreshToken,
        accessJti: newAccessJti ?? null,
        lastActiveAt: new Date(),
      },
    });
  }

  /** 校验 refresh token 对应的会话是否有效(存在且未过期) */
  async findValidSession(refreshToken: string) {
    const session = await this.prisma.userSession.findUnique({
      where: { refreshToken },
      include: { user: { select: { id: true, username: true } } },
    });
    if (!session || session.expiresAt < new Date()) return null;
    return session;
  }

  /** 登出:按 refresh token 删除会话 */
  async removeByRefreshToken(refreshToken: string) {
    await this.prisma.userSession.deleteMany({ where: { refreshToken } });
  }

  /** 在线会话分页(含用户信息)。显式 select 安全字段，禁止返回 refreshToken/accessJti */
  async findAll(page: number, pageSize: number) {
    const now = new Date();
    const where = { expiresAt: { gt: now } };
    const [items, total] = await Promise.all([
      this.prisma.userSession.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { lastActiveAt: 'desc' },
        select: {
          id: true,
          userId: true,
          ipAddress: true,
          userAgent: true,
          expiresAt: true,
          lastActiveAt: true,
          createdTime: true,
          user: {
            select: { id: true, username: true, name: true },
          },
        },
      }),
      this.prisma.userSession.count({ where }),
    ]);

    return {
      items: items.map(({ user, ...session }) => ({
        ...session,
        username: user.username,
        userName: user.name,
      })),
      total,
      page,
      pageSize,
    };
  }

  /** 在线统计 */
  async getStats() {
    const now = new Date();
    const [online, total] = await Promise.all([
      this.prisma.userSession.count({ where: { expiresAt: { gt: now } } }),
      this.prisma.userSession.count(),
    ]);
    return { online, total };
  }

  /** 强制下线:删除会话 + access token 进黑名单 */
  async kick(id: number) {
    const session = await this.prisma.userSession.findUnique({ where: { id } });
    if (!session) return { kicked: 0 };
    if (session.accessJti)
      this.revokedJtis.set(
        session.accessJti,
        Date.now() + ACCESS_BLACKLIST_TTL,
      );
    await this.prisma.userSession.delete({ where: { id } });
    this.cleanupBlacklist();
    return { kicked: 1 };
  }

  /** 强制下线某用户全部会话 */
  async kickByUser(userId: number) {
    const sessions = await this.prisma.userSession.findMany({
      where: { userId },
      select: { id: true, accessJti: true },
    });
    for (const session of sessions) {
      if (session.accessJti)
        this.revokedJtis.set(
          session.accessJti,
          Date.now() + ACCESS_BLACKLIST_TTL,
        );
    }
    const result = await this.prisma.userSession.deleteMany({
      where: { userId },
    });
    this.cleanupBlacklist();
    return { kicked: result.count };
  }

  /** access token 是否已被强制下线(黑名单) */
  isAccessRevoked(jti?: string): boolean {
    if (!jti) return false;
    const expiresAt = this.revokedJtis.get(jti);
    if (!expiresAt) return false;
    if (expiresAt < Date.now()) {
      this.revokedJtis.delete(jti);
      return false;
    }
    return true;
  }

  private cleanupBlacklist() {
    const now = Date.now();
    for (const [jti, expiresAt] of this.revokedJtis) {
      if (expiresAt < now) this.revokedJtis.delete(jti);
    }
  }
}
