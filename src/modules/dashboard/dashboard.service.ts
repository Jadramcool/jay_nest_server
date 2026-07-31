import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import * as os from 'os';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

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
    ] = await Promise.all([
      this.prisma.user.count({ where: { isDeleted: false } }),
      this.prisma.role.count({ where: { isDeleted: false } }),
      this.prisma.menu.count(),
      this.prisma.department.count({ where: { isDeleted: false } }),
      this.prisma.operationLog.count(),
      this.prisma.operationLog.count({
        where: { createdTime: { gte: today } },
      }),
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
      onlineCount: 0,
    };
  }

  async getTrends(days: number = 7) {
    const dates: string[] = [];
    const visits: number[] = [];
    const newUsers: number[] = [];
    const operations: number[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      dates.push(dateStr);

      const dayStart = new Date(date.setHours(0, 0, 0, 0));
      const dayEnd = new Date(date.setHours(23, 59, 59, 999));

      const [visitCount, userCount, operationCount] = await Promise.all([
        this.prisma.operationLog.count({
          where: { createdTime: { gte: dayStart, lte: dayEnd } },
        }),
        this.prisma.user.count({
          where: { createdTime: { gte: dayStart, lte: dayEnd } },
        }),
        this.prisma.operationLog.count({
          where: { createdTime: { gte: dayStart, lte: dayEnd } },
        }),
      ]);

      visits.push(visitCount);
      newUsers.push(userCount);
      operations.push(operationCount);
    }

    return { dates, visits, newUsers, operations };
  }

  async getSystemInfo() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const cpus = os.cpus();
    const cpuCount = cpus.length;
    let totalIdle = 0;
    let totalTick = 0;
    for (const cpu of cpus) {
      for (const type in cpu.times) {
        totalTick += (cpu.times as any)[type];
      }
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

  async getActivities(limit: number = 8) {
    const logs = await this.prisma.operationLog.findMany({
      take: limit,
      orderBy: { createdTime: 'desc' },
      include: {
        user: { select: { id: true, username: true, name: true } },
      },
    });

    return logs.map((log) => ({
      id: log.id,
      username: log.username || log.user?.username || '-',
      action: log.description || log.url || '-',
      module: log.module || '-',
      operationType: log.operationType,
      time: log.createdTime,
      status: log.status,
    }));
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
