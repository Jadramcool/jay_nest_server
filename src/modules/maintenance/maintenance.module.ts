import { Module } from '@nestjs/common';
import { SettingsModule } from '@/modules/settings/settings.module';
import { CleanupScheduler } from './cleanup.scheduler';
import { CleanupService } from './cleanup.service';

/**
 * 运维/维护模块:保留期清理(通用)。
 *
 * 消费注册表设置 `notice.retentionDays` / `operationLog.retentionDays` /
 * `system.cleanupEnabled`;**不依赖任何业务模块** —— 业务自己的临时产物
 * 由业务模块起自己的周期任务。
 *
 * 目前没有对外接口(纯后台任务),需要手动触发时可直接调 CleanupService。
 */
@Module({
  imports: [SettingsModule],
  providers: [CleanupService, CleanupScheduler],
  exports: [CleanupService],
})
export class MaintenanceModule {}
