import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { IntervalTaskRunner } from '@/common/utils/interval-task.util';
import { CleanupService } from './cleanup.service';

/** 运行间隔:保留期以"天"为粒度,每天跑一次足够 */
const INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * 保留期清理调度:启动 60s 后首跑,之后每 24h 一次。
 *
 * 定时/重入/日志等公共逻辑见 `IntervalTaskRunner`;
 * 真正要清什么由 `CleanupService` 决定(业务模块若需扩展,见该类注释)。
 */
@Injectable()
export class CleanupScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly runner: IntervalTaskRunner;

  constructor(private readonly cleanup: CleanupService) {
    this.runner = new IntervalTaskRunner(
      '保留期清理',
      () => this.cleanup.runAll(),
      {
        intervalMs: INTERVAL_MS,
      },
    );
  }

  onModuleInit() {
    this.runner.start();
  }

  onModuleDestroy() {
    this.runner.stop();
  }
}
