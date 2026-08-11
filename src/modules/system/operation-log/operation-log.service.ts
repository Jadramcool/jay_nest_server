import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { Prisma, OperationStatus } from '@prisma/client';
import { QueryOperationLogDto } from './dto';
import { paginate } from '@/common/utils/pagination.util';
import { buildQueryWhere } from '@/common/utils/query-where.util';
import { ICreateOperationLog } from './typings';

@Injectable()
export class OperationLogService {
  constructor(private readonly prisma: PrismaService) {}

  async createLog(data: ICreateOperationLog) {
    return this.prisma.operationLog.create({ data });
  }

  createLogAsync(data: ICreateOperationLog): void {
    setImmediate(() => {
      void this.prisma.operationLog.create({ data }).catch(() => {
        // 异步日志写入失败不影响主流程
      });
    });
  }

  async findAll(queryDto: QueryOperationLogDto) {
    const { page = 1, pageSize = 20, startTime, endTime } = queryDto;

    const where: Prisma.OperationLogWhereInput = {
      ...buildQueryWhere(queryDto, {
        userId: 'eq',
        username: 'contains',
        operationType: 'eq',
        module: 'contains',
        status: 'eq',
        ipAddress: 'contains',
      }),
    };

    if (startTime || endTime) {
      const createdTimeFilter: Prisma.DateTimeFilter = {};
      if (startTime) {
        createdTimeFilter.gte = new Date(startTime);
      }
      if (endTime) {
        createdTimeFilter.lte = new Date(endTime);
      }
      where.createdTime = createdTimeFilter;
    }

    const [logs, total] = await Promise.all([
      this.prisma.operationLog.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdTime: 'desc' },
        include: {
          user: {
            select: { id: true, username: true, name: true },
          },
        },
      }),
      this.prisma.operationLog.count({ where }),
    ]);

    return paginate(
      logs.map((log) => ({
        id: log.id,
        userId: log.userId,
        username: log.username,
        operationType: log.operationType,
        module: log.module,
        description: log.description,
        method: log.method,
        url: log.url,
        status: log.status,
        errorMessage: log.errorMessage,
        ipAddress: log.ipAddress,
        duration: log.duration,
        createdTime: log.createdTime,
        user: log.user,
      })),
      { page, pageSize, total },
    );
  }

  async findOne(id: number) {
    const log = await this.prisma.operationLog.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, username: true, name: true },
        },
      },
    });

    if (!log) {
      throw new NotFoundException(`操作日志 ID ${id} 不存在`);
    }

    return log;
  }

  async remove(id: number) {
    const log = await this.prisma.operationLog.findUnique({
      where: { id },
    });

    if (!log) {
      throw new NotFoundException(`操作日志 ID ${id} 不存在`);
    }

    await this.prisma.operationLog.delete({ where: { id } });
    return { id };
  }

  async batchRemove(ids: number[]) {
    await this.prisma.operationLog.deleteMany({
      where: { id: { in: ids } },
    });
    return { ids };
  }

  async clearExpired(days: number) {
    const expireDate = new Date();
    expireDate.setDate(expireDate.getDate() - days);

    const result = await this.prisma.operationLog.deleteMany({
      where: {
        createdTime: { lt: expireDate },
      },
    });

    return { deletedCount: result.count, days };
  }

  async getStats() {
    const [totalCount, todayCount, successCount, failedCount] =
      await Promise.all([
        this.prisma.operationLog.count(),
        this.prisma.operationLog.count({
          where: {
            createdTime: {
              gte: new Date(new Date().setHours(0, 0, 0, 0)),
            },
          },
        }),
        this.prisma.operationLog.count({
          where: { status: OperationStatus.SUCCESS },
        }),
        this.prisma.operationLog.count({
          where: { status: OperationStatus.FAILED },
        }),
      ]);

    const operationTypeStats = await this.prisma.operationLog.groupBy({
      by: ['operationType'],
      _count: { operationType: true },
    });

    const moduleStats = await this.prisma.operationLog.groupBy({
      by: ['module'],
      _count: { module: true },
      orderBy: { _count: { module: 'desc' } },
      take: 10,
    });

    return {
      totalCount,
      todayCount,
      successCount,
      failedCount,
      operationTypeStats: operationTypeStats.map((item) => ({
        operationType: item.operationType,
        count: item._count.operationType,
      })),
      moduleStats: moduleStats.map((item) => ({
        module: item.module,
        count: item._count.module,
      })),
    };
  }
}
