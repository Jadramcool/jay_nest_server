import { Injectable } from '@nestjs/common';
import { OperationStatus, OperationType, Prisma } from '@prisma/client';
import * as os from 'os';
import { PrismaService } from '@/prisma/prisma.service';
import { SessionService } from '@/modules/session/session.service';

/** 调用方信息(来自 JWT,由 @CurrentUser() 注入) */
interface DashboardCaller {
  userId: number;
  permissions?: string[];
}

/** 操作日志行(含 user 关联),mapActivity 的入参结构 */
interface ActivityLogRow {
  id: number;
  username: string | null;
  description: string | null;
  url: string | null;
  module: string | null;
  operationType: OperationType;
  status: OperationStatus;
  createdTime: Date;
  user?: { id: number; username: string; name: string | null } | null;
}

/** $queryRaw 按日聚合的行结构(COUNT(*) 在 MySQL 驱动下可能返回 BigInt) */
interface DailyCountRow {
  day: string;
  cnt: number | bigint;
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionService: SessionService,
  ) {}

  async getStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      userCount,
      roleCount,
      menuCount,
      departmentCount,
      logCount,
      logTodayCount,
      sessionStats,
    ] = await Promise.all([
      this.prisma.user.count({ where: { isDeleted: false } }),
      this.prisma.role.count({ where: { isDeleted: false } }),
      this.prisma.menu.count(),
      this.prisma.department.count({ where: { isDeleted: false } }),
      this.prisma.operationLog.count(),
      this.prisma.operationLog.count({
        where: { createdTime: { gte: today } },
      }),
      this.sessionService.getStats(),
    ]);

    const yesterdayStart = new Date(today.getTime() - 86400000);
    const userYesterday = await this.prisma.user.count({
      where: {
        isDeleted: false,
        createdTime: { lt: today, gte: yesterdayStart },
      },
    });
    const userDayBefore = await this.prisma.user.count({
      where: {
        isDeleted: false,
        createdTime: {
          lt: yesterdayStart,
          gte: new Date(yesterdayStart.getTime() - 86400000),
        },
      },
    });
    const userTrend =
      userDayBefore > 0
        ? Math.round(((userYesterday - userDayBefore) / userDayBefore) * 100)
        : userYesterday > 0
          ? 100
          : 0;

    return {
      userCount,
      userTrend,
      roleCount,
      menuCount,
      departmentCount,
      logCount,
      logTodayCount,
      onlineCount: sessionStats.online,
    };
  }

  /**
   * 近 N 天趋势。
   *
   * 指标口径:
   * - visits = 前端上报的 pageview 事件数(ClientEvent, type='pageview')
   * - operations = 操作日志条数(OperationLog)
   * - newUsers = 当日注册用户数
   *
   * 按日聚合用参数化 $queryRaw(Prisma groupBy 不支持日期截断),
   * 一次查询代替逐日 count,缺失日期在应用层补 0。
   * 日界取数据库会话时区(DATE_FORMAT),与 JS 侧本地日期对齐,
   * 跨时区部署时需统一两者时区。
   */
  async getTrends(days: number = 7) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(today.getTime() - (days - 1) * 86400000);

    const [visitRows, operationRows, userRows] = await Promise.all([
      this.prisma.$queryRaw<DailyCountRow[]>(
        Prisma.sql`SELECT DATE_FORMAT(created_time, '%Y-%m-%d') AS day, COUNT(*) AS cnt
          FROM client_event
          WHERE type = 'pageview' AND created_time >= ${start}
          GROUP BY day`,
      ),
      this.prisma.$queryRaw<DailyCountRow[]>(
        Prisma.sql`SELECT DATE_FORMAT(created_time, '%Y-%m-%d') AS day, COUNT(*) AS cnt
          FROM operation_log
          WHERE created_time >= ${start}
          GROUP BY day`,
      ),
      this.prisma.$queryRaw<DailyCountRow[]>(
        Prisma.sql`SELECT DATE_FORMAT(created_time, '%Y-%m-%d') AS day, COUNT(*) AS cnt
          FROM user
          WHERE created_time >= ${start}
          GROUP BY day`,
      ),
    ]);

    const toDailyMap = (rows: DailyCountRow[]) =>
      new Map(rows.map((row) => [row.day, Number(row.cnt)]));
    const visitMap = toDailyMap(visitRows);
    const operationMap = toDailyMap(operationRows);
    const userMap = toDailyMap(userRows);

    const dates: string[] = [];
    const visits: number[] = [];
    const newUsers: number[] = [];
    const operations: number[] = [];
    for (let i = 0; i < days; i++) {
      const key = this.formatDay(new Date(start.getTime() + i * 86400000));
      dates.push(key);
      visits.push(visitMap.get(key) ?? 0);
      newUsers.push(userMap.get(key) ?? 0);
      operations.push(operationMap.get(key) ?? 0);
    }

    return { dates, visits, newUsers, operations };
  }

  /**
   * 个人工作台聚合数据(任何登录用户)。
   *
   * 三个数据块并行,单块失败降级为空值,不拖垮整体响应。
   */
  async getMine(userId: number) {
    const [todo, notice, myActivities] = await Promise.all([
      this.getMyTodoBlock(userId).catch(() => ({
        openCount: 0,
        doneCount: 0,
        recent: [],
      })),
      this.getMyNoticeBlock(userId).catch(() => ({
        unreadCount: 0,
        recent: [],
      })),
      this.getMyActivities(userId).catch(() => []),
    ]);

    return { todo, notice, myActivities };
  }

  private async getMyTodoBlock(userId: number) {
    const [openCount, doneCount, recent] = await Promise.all([
      this.prisma.todo.count({ where: { userId, isDone: false } }),
      this.prisma.todo.count({ where: { userId, isDone: true } }),
      this.prisma.todo.findMany({
        where: { userId, isDone: false },
        orderBy: { createdTime: 'desc' },
        take: 5,
        select: { id: true, title: true, isDone: true, createdTime: true },
      }),
    ]);
    return { openCount, doneCount, recent };
  }

  private async getMyNoticeBlock(userId: number) {
    const noticeFilter = { isDeleted: false, status: 1 };
    const [unreadCount, recentRows] = await Promise.all([
      this.prisma.userNotice.count({
        where: {
          userId,
          isDeleted: false,
          readTime: null,
          notice: noticeFilter,
        },
      }),
      this.prisma.userNotice.findMany({
        // recent 含已读(分配给我的公告列表),未读数由 unreadCount 表达
        where: { userId, isDeleted: false, notice: noticeFilter },
        orderBy: { assignedTime: 'desc' },
        take: 5,
        select: {
          id: true,
          noticeId: true,
          readTime: true,
          assignedTime: true,
          notice: {
            select: {
              title: true,
              publishedAt: true,
              type: true,
              isPinned: true,
              isMandatory: true,
            },
          },
        },
      }),
    ]);

    return {
      unreadCount,
      recent: recentRows.map((row) => ({
        id: row.id,
        noticeId: row.noticeId,
        title: row.notice.title,
        publishedAt: row.notice.publishedAt,
        type: row.notice.type,
        isPinned: row.notice.isPinned,
        isMandatory: row.notice.isMandatory,
        readTime: row.readTime,
        assignedTime: row.assignedTime,
      })),
    };
  }

  private async getMyActivities(userId: number) {
    const logs = await this.prisma.operationLog.findMany({
      where: { userId },
      take: 8,
      orderBy: { createdTime: 'desc' },
      include: { user: { select: { id: true, username: true, name: true } } },
    });
    return logs.map((log) => this.mapActivity(log));
  }

  async getSystemInfo() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;
    for (const cpu of cpus) {
      totalTick += Object.values(cpu.times).reduce(
        (sum, time) => sum + time,
        0,
      );
      totalIdle += cpu.times.idle;
    }

    const dbCount = await this.prisma.operationLog.count();

    return {
      cpu: Math.round((1 - totalIdle / totalTick) * 100),
      memory: Math.round(((totalMem - freeMem) / totalMem) * 100),
      disk: 0,
      uptime: this.formatUptime(os.uptime()),
      version: process.env.npm_package_version || '1.0.0',
      nodeVersion: process.version,
      platform: `${os.type()} ${os.arch()}`,
      dbRecords: dbCount,
    };
  }

  /**
   * 最近动态。
   *
   * 有意按权限分级(非漏加权限):持有 `system:operation-log:list`
   * (审计查询权)的调用者可看全站动态;普通用户仅返回本人操作记录,
   * 与操作日志查询口的权限保持一致,避免横向信息泄露。
   */
  async getActivities(limit: number = 8, caller?: DashboardCaller) {
    if (!caller) return [];

    const isAuditor =
      caller.permissions?.includes('system:operation-log:list') ?? false;
    const logs = await this.prisma.operationLog.findMany({
      where: isAuditor ? {} : { userId: caller.userId },
      take: limit,
      orderBy: { createdTime: 'desc' },
      include: { user: { select: { id: true, username: true, name: true } } },
    });

    return logs.map((log) => this.mapActivity(log));
  }

  /** activities 与 mine.myActivities 共用的字段映射 */
  private mapActivity(log: ActivityLogRow) {
    return {
      id: log.id,
      username: log.username || log.user?.username || '-',
      action: log.description || log.url || '-',
      module: log.module || '-',
      operationType: log.operationType,
      time: log.createdTime,
      status: log.status,
    };
  }

  /** 本地时区 YYYY-MM-DD(与 DATE_FORMAT 输出对齐,月/日补零) */
  private formatDay(date: Date): string {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
  }

  private formatUptime(seconds: number): string {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const parts: string[] = [];
    if (d > 0) parts.push(`${d}天`);
    if (h > 0) parts.push(`${h}小时`);
    parts.push(`${m}分钟`);
    return parts.join(' ');
  }
}
