import { PLATFORMS } from '@/common/constants/platform';
import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { SettingsService } from '@/modules/settings/settings.service';
import UAParser from 'ua-parser-js';

/** access token 黑名单有效期（与 access token 有效期一致） */
const ACCESS_BLACKLIST_TTL = 2 * 60 * 60 * 1000; // 2 小时

/** user_session.user_agent 列宽，须与 schema.prisma 的 @db.VarChar(512) 一致 */
const USER_AGENT_MAX_LENGTH = 512;

/** 活跃时间回写节流窗口：同一 jti 在此窗口内只落库一次 */
const ACTIVITY_WRITE_THROTTLE_MS = 60_000;

/** 节流表容量上限，超过时清掉已过期条目，避免随会话数无限增长 */
const ACTIVITY_TRACK_MAX = 5_000;

/** 会话活跃状态：活跃(判定窗口内有请求) | 闲置(会话仍有效但已超窗口) */
export type SessionActivity = 'active' | 'idle';

/**
 * 从原始 UA 提取可读的浏览器/系统名。
 *
 * 只在列表返回时计算，不入库 —— 解析规则更新后历史数据立刻跟着变，
 * 也不需要为它加列加迁移。
 */
export function parseClient(userAgent?: string | null): {
  browser: string | null;
  os: string | null;
} {
  if (!userAgent) return { browser: null, os: null };
  const { browser, os } = UAParser(userAgent);
  const major = browser.version?.split('.')[0];
  return {
    browser: [browser.name, major].filter(Boolean).join(' ') || null,
    os: os.name ?? null,
  };
}

/** 在线列表筛选条件 */
export interface SessionListFilters {
  /** 用户名或姓名，模糊匹配 */
  username?: string;
  /** 登录端: admin | app | mp */
  platform?: string;
  /** 活跃状态: 判定窗口内有请求为 active，超出窗口但会话仍有效为 idle */
  status?: SessionActivity;
}

/**
 * 列表过滤条件。
 *
 * status 是实时算出来的（库里没有这一列），但它等价于 lastActiveAt 与判定窗口的比较，
 * 所以照样下推到 SQL —— 一旦改成取回内存再过滤，分页与 total 都会错。
 */
export function buildSessionListWhere(
  { now, activeSince }: { now: Date; activeSince: Date },
  filters: SessionListFilters,
): Prisma.UserSessionWhereInput {
  const where: Prisma.UserSessionWhereInput = { expiresAt: { gt: now } };
  if (filters.platform) where.platform = filters.platform;
  if (filters.username) {
    where.user = {
      OR: [
        { username: { contains: filters.username } },
        { name: { contains: filters.username } },
      ],
    };
  }
  if (filters.status === 'active') where.lastActiveAt = { gte: activeSince };
  else if (filters.status === 'idle') where.lastActiveAt = { lt: activeSince };
  return where;
}

/** 登录会话管理 + access token 黑名单（内存实现，单实例有效） */
@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  private readonly revokedJtis = new Map<string, number>();

  /** jti → 上次活跃时间落库的时间戳（节流用） */
  private readonly activityWrites = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  /** 登录时创建会话 */
  async createSession(params: {
    userId: number;
    refreshToken: string;
    accessJti?: string;
    ipAddress?: string;
    userAgent?: string;
    /** 登录端: admin | app | mp */
    platform?: string;
    expiresAt: Date;
  }) {
    return this.prisma.userSession.create({
      data: {
        userId: params.userId,
        refreshToken: params.refreshToken,
        accessJti: params.accessJti ?? null,
        ipAddress: params.ipAddress?.slice(0, 100) ?? null,
        userAgent: params.userAgent?.slice(0, USER_AGENT_MAX_LENGTH) ?? null,
        platform: params.platform ?? PLATFORMS.ADMIN,
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

  /**
   * 记录会话活跃时间（由 JwtStrategy 在每个受保护请求上调用）。
   *
   * 节流是必需的：不节流等于每个 API 请求打一次 UPDATE，管理端首页一次并发
   * 就能打出十几次写。单实例下用进程内 Map 节流即可；进程重启只是丢掉节流
   * 状态（多写几次），不影响正确性。
   *
   * 失败只记日志不抛出 —— 活跃度是观测数据，不能让它拖垮正常请求。
   */
  async touchActivity(jti?: string) {
    if (!jti) return;
    const now = Date.now();
    if (!this.shouldWriteActivity(jti, now)) return;

    try {
      await this.prisma.userSession.updateMany({
        where: { accessJti: jti },
        data: { lastActiveAt: new Date(now) },
      });
    } catch (error) {
      this.logger.warn(
        `活跃时间回写失败(jti=${jti}): ${(error as Error).message}`,
      );
    }
  }

  /** 判断该 jti 本次是否应该落库；顺手做节流表的容量治理 */
  private shouldWriteActivity(jti: string, now: number): boolean {
    const lastWrite = this.activityWrites.get(jti);
    if (
      lastWrite !== undefined &&
      now - lastWrite < ACTIVITY_WRITE_THROTTLE_MS
    ) {
      return false;
    }
    // 先登记再写库：同一 jti 的并发请求里只会有一次真正落库
    this.activityWrites.set(jti, now);
    if (this.activityWrites.size > ACTIVITY_TRACK_MAX) {
      this.pruneActivityWrites(now);
    }
    return true;
  }

  /** 清掉已过节的节流条目（过期的条目与不存在等价，删掉不影响节流语义） */
  private pruneActivityWrites(now: number) {
    for (const [jti, writtenAt] of this.activityWrites) {
      if (now - writtenAt >= ACTIVITY_WRITE_THROTTLE_MS) {
        this.activityWrites.delete(jti);
      }
    }
  }

  /** 会话销毁后立刻丢弃其节流条目，不必等容量治理兜底 */
  private forgetActivity(jti?: string | null) {
    if (jti) this.activityWrites.delete(jti);
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

  /**
   * 登录前清理「同用户 + 同端 + 同 IP + 同 UA」的旧会话。
   *
   * 同一台机器反复登录会堆出设备指纹完全相同的行，列表里同一个人看起来像开了好几个会话，
   * 但这些行没有任何保留价值；而 IP / UA 不同的会话代表真实的多设备，必须保留
   * （管理员要能看到并手动下线）。删除前把 access jti 压进黑名单，
   * 避免出现「列表里没了、旧 token 却还能用」。
   */
  async clearDuplicateSessions(params: {
    userId: number;
    platform: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<number> {
    // 截断规则必须与 createSession 一致：两处不一致会让同一台机器的两次登录写进不同的值，去重失效
    const ipAddress = params.ipAddress?.slice(0, 100) ?? null;
    const userAgent = params.userAgent?.slice(0, USER_AGENT_MAX_LENGTH) ?? null;

    const duplicates = await this.prisma.userSession.findMany({
      where: {
        userId: params.userId,
        platform: params.platform,
        ipAddress,
        userAgent,
      },
      select: { id: true, accessJti: true },
    });
    if (!duplicates.length) return 0;

    for (const { accessJti } of duplicates) {
      if (accessJti) {
        this.revokedJtis.set(accessJti, Date.now() + ACCESS_BLACKLIST_TTL);
      }
      this.forgetActivity(accessJti);
    }

    await this.prisma.userSession.deleteMany({
      where: { id: { in: duplicates.map(({ id }) => id) } },
    });
    this.cleanupBlacklist();
    return duplicates.length;
  }

  /** 登出:按 refresh token 删除会话 */
  async removeByRefreshToken(refreshToken: string) {
    await this.prisma.userSession.deleteMany({ where: { refreshToken } });
  }

  /**
   * 登出:拉黑该会话的 access jti 后删除会话
   *
   * 与 removeByRefreshToken 的区别:当前 access token 立即失效,
   * 而不是等它自然过期(默认 2 小时)
   */
  async revokeSessionByRefreshToken(refreshToken: string) {
    const session = await this.prisma.userSession.findUnique({
      where: { refreshToken },
    });
    if (!session) return;
    if (session.accessJti) {
      this.revokedJtis.set(
        session.accessJti,
        Date.now() + ACCESS_BLACKLIST_TTL,
      );
    }
    this.forgetActivity(session.accessJti);
    await this.prisma.userSession.deleteMany({ where: { refreshToken } });
    this.cleanupBlacklist();
  }

  /** 将单个 access jti 加入黑名单(如登出时未携带 refreshToken 的兜底) */
  revokeAccessJti(jti?: string) {
    if (!jti) return;
    this.revokedJtis.set(jti, Date.now() + ACCESS_BLACKLIST_TTL);
    this.forgetActivity(jti);
    this.cleanupBlacklist();
  }

  /**
   * 在线会话分页(含用户信息)。
   *
   * 列表只列**未过期**的会话；每一项按判定窗口标出 active/idle，
   * 用闲置而不是直接隐藏 —— 关掉浏览器没登出的人不该看起来像掉线，
   * 而且管理员需要看到他们才能手动下线。
   *
   * 支持按 用户名/姓名、登录端、活跃状态 筛选，条件全部下推到 SQL。
   *
   * 显式 select 安全字段，禁止返回 refreshToken/accessJti。
   */
  async findAll(
    page: number,
    pageSize: number,
    currentJti?: string,
    filters: SessionListFilters = {},
  ) {
    const { now, activeSince, activeWindowMinutes } =
      await this.resolveActiveWindow();
    const where = buildSessionListWhere({ now, activeSince }, filters);
    const [items, total] = await Promise.all([
      this.prisma.userSession.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { lastActiveAt: 'desc' },
        select: {
          id: true,
          userId: true,
          platform: true,
          // 仅用于判断「当前会话」，不对外返回
          accessJti: true,
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
      items: items.map(({ user, accessJti, ...session }) => ({
        ...session,
        username: user.username,
        userName: user.name,
        status: this.toActivity(session.lastActiveAt, activeSince),
        isCurrent: Boolean(currentJti && accessJti && accessJti === currentJti),
        ...parseClient(session.userAgent),
      })),
      total,
      page,
      pageSize,
      activeWindowMinutes,
    };
  }

  /**
   * 在线统计。
   *
   * 三个口径分开，不要用会话数冒充人数：
   *   - onlineUsers    活跃会话去重后的**人数**（首页「在线用户」用这个）
   *   - activeSessions 活跃会话数（同一人多端登录会算多条）
   *   - totalSessions  未过期会话数（即"有效会话"，不含历史累计）
   */
  async getStats() {
    const { now, activeSince } = await this.resolveActiveWindow();
    const activeWhere = {
      expiresAt: { gt: now },
      lastActiveAt: { gte: activeSince },
    };

    const [activeSessions, activeUserRows, totalSessions] = await Promise.all([
      this.prisma.userSession.count({ where: activeWhere }),
      this.prisma.userSession.groupBy({
        by: ['userId'],
        where: activeWhere,
      }),
      this.prisma.userSession.count({ where: { expiresAt: { gt: now } } }),
    ]);

    return {
      onlineUsers: activeUserRows.length,
      activeSessions,
      totalSessions,
    };
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
    this.forgetActivity(session.accessJti);
    await this.prisma.userSession.delete({ where: { id } });
    this.cleanupBlacklist();
    return { kicked: 1 };
  }

  /** 强制下线某用户全部会话(excludeJti 用于保留当前会话,如改密场景) */
  async kickByUser(
    userId: number,
    options?: { excludeJti?: string },
  ): Promise<{ kicked: number }> {
    const sessions = await this.prisma.userSession.findMany({
      where: { userId },
      select: { id: true, accessJti: true },
    });
    for (const session of sessions) {
      if (session.accessJti && session.accessJti !== options?.excludeJti) {
        this.revokedJtis.set(
          session.accessJti,
          Date.now() + ACCESS_BLACKLIST_TTL,
        );
      }
      this.forgetActivity(session.accessJti);
    }
    const result = await this.prisma.userSession.deleteMany({
      where: {
        userId,
        ...(options?.excludeJti
          ? { accessJti: { not: options.excludeJti } }
          : {}),
      },
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

  /** 读在线判定窗口（设置带缓存，改完下一次调用即生效） */
  private async resolveActiveWindow() {
    const activeWindowMinutes = await this.settings.get(
      'session.activeWindowMinutes',
    );
    const now = new Date();
    return {
      now,
      activeSince: new Date(now.getTime() - activeWindowMinutes * 60_000),
      activeWindowMinutes,
    };
  }

  private toActivity(lastActiveAt: Date, activeSince: Date): SessionActivity {
    return lastActiveAt >= activeSince ? 'active' : 'idle';
  }

  private cleanupBlacklist() {
    const now = Date.now();
    for (const [jti, expiresAt] of this.revokedJtis) {
      if (expiresAt < now) this.revokedJtis.delete(jti);
    }
  }
}
