import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { ClientEventDto, QueryClientEventDto } from './dto/metrics.dto';

@Injectable()
export class MetricsService {
  constructor(private readonly prisma: PrismaService) {}

  /** 批量写入前端上报事件(带浏览器标识) */
  async report(
    userId: number | null,
    events: ClientEventDto[],
    userAgent?: string,
  ) {
    if (!Array.isArray(events) || events.length === 0) {
      return { received: 0 };
    }

    const browser = this.parseBrowser(userAgent);
    const rows = events.map((event) => ({
      type: event.type || 'error',
      category: event.category ?? null,
      message: event.message?.slice(0, 500) ?? null,
      stack: event.stack?.slice(0, 4000) ?? null,
      url: event.url?.slice(0, 500) ?? null,
      route: event.route?.slice(0, 200) ?? null,
      userId,
      browser,
      // extra 是任意 JSON,序列化后超限直接丢弃,防止灌库 DoS
      extra: this.safeExtra(event.extra),
    }));

    const result = await this.prisma.clientEvent.createMany({ data: rows });
    return { received: result.count };
  }

  /** extra 序列化长度限制(4KB)，超限丢弃 */
  private safeExtra(extra: unknown): Prisma.InputJsonValue | undefined {
    if (extra === undefined || extra === null) return undefined;
    try {
      if (JSON.stringify(extra).length > 4096) return undefined;
    } catch {
      return undefined;
    }
    return extra;
  }

  async findAll(query: QueryClientEventDto) {
    const { page = 1, pageSize = 20, type, category } = query;
    const where = {
      ...(type ? { type } : {}),
      ...(category ? { category } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.clientEvent.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdTime: 'desc' },
      }),
      this.prisma.clientEvent.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  /** 按类型统计(近 24 小时) */
  async getStats() {
    const since = new Date(Date.now() - 24 * 3600 * 1000);
    const [total, errors, pageviews, todayErrors] = await Promise.all([
      this.prisma.clientEvent.count(),
      this.prisma.clientEvent.count({ where: { type: 'error' } }),
      this.prisma.clientEvent.count({ where: { type: 'pageview' } }),
      this.prisma.clientEvent.count({
        where: { type: 'error', createdTime: { gte: since } },
      }),
    ]);
    return { total, errors, pageviews, todayErrors };
  }

  private parseBrowser(userAgent?: string): string | null {
    if (!userAgent) return null;
    const ua = userAgent.slice(0, 200);
    if (/Chrome\//.test(ua))
      return `Chrome ${ua.match(/Chrome\/([\d.]+)/)?.[1] ?? ''}`.trim();
    if (/Firefox\//.test(ua))
      return `Firefox ${ua.match(/Firefox\/([\d.]+)/)?.[1] ?? ''}`.trim();
    if (/Safari\//.test(ua)) return 'Safari';
    if (/Edg\//.test(ua)) return 'Edge';
    return 'Other';
  }
}
