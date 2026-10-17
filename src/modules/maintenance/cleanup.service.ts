import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { SettingsService } from '@/modules/settings/settings.service';

/** 单次清理统计 */
export interface CleanupResult {
  /** 应急开关关闭时为 true，两项都没跑 */
  skipped: boolean;
  notices: number;
  operationLogs: number;
}

export interface CleanupOptions {
  /** 只统计不删除(上线前先看会删多少) */
  dryRun?: boolean;
}

const DAY_MS = 86_400_000;

/**
 * 保留期清理(通用能力,不含任何业务模块知识)。
 *
 * 两项策略读注册表设置(改完即时生效,无需重启):
 *   - `notice.retentionDays`        已发布且未置顶的公告 → 软删除
 *   - `operationLog.retentionDays`  操作日志 → 物理删除
 * 外加一个应急开关 `system.cleanupEnabled`。
 *
 * 业务模块若还有自己的临时产物要清,由该模块自己起周期任务,
 * 本模块不反向依赖任何业务模块。
 *
 * 实现要点:
 *   - 每次运行都重新读设置,所以运营调整保留期后**下一次运行**就生效;
 *   - 公告用软删除(`isDeleted/deletedTime`),与 notice.service.remove 一致,保留审计痕迹;
 *   - 置顶公告不清理:置顶是运营明确的"长期展示"意图;
 *   - `dryRun` 只统计不落库,便于上线前评估影响。
 */
@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  /** 依次执行两项清理(供调度器与手动触发调用) */
  async runAll(options: CleanupOptions = {}): Promise<CleanupResult> {
    const enabled = await this.settings.get('system.cleanupEnabled');
    if (!enabled) {
      this.logger.warn('定时清理已关闭(system.cleanupEnabled=false)，跳过本次');
      return { skipped: true, notices: 0, operationLogs: 0 };
    }

    const notices = await this.cleanupNotices(options);
    const operationLogs = await this.cleanupOperationLogs(options);

    const suffix = options.dryRun ? '(dry-run)' : '';
    this.logger.log(
      `保留期清理完成${suffix}: 公告 ${notices} 条, 操作日志 ${operationLogs} 条`,
    );
    return { skipped: false, notices, operationLogs };
  }

  /** 公告:超过保留期的"已发布 + 未置顶"记录软删除(管理端可恢复) */
  async cleanupNotices(options: CleanupOptions = {}): Promise<number> {
    const days = await this.settings.get('notice.retentionDays');
    const cutoff = new Date(Date.now() - days * DAY_MS);
    // 保留期以"发布后"起算:publishedAt 缺失时退回 createdTime
    const where = {
      isDeleted: false,
      isPinned: false,
      status: 1,
      OR: [
        { publishedAt: { lt: cutoff } },
        { publishedAt: null, createdTime: { lt: cutoff } },
      ],
    };

    if (options.dryRun) return this.prisma.notice.count({ where });

    const { count } = await this.prisma.notice.updateMany({
      where,
      data: { isDeleted: true, deletedTime: new Date() },
    });
    return count;
  }

  /** 操作日志:超过保留期物理删除(该表无软删除字段) */
  async cleanupOperationLogs(options: CleanupOptions = {}): Promise<number> {
    const days = await this.settings.get('operationLog.retentionDays');
    const cutoff = new Date(Date.now() - days * DAY_MS);
    const where = { createdTime: { lt: cutoff } };

    if (options.dryRun) return this.prisma.operationLog.count({ where });

    const { count } = await this.prisma.operationLog.deleteMany({ where });
    return count;
  }
}
