import { Logger } from '@nestjs/common';

export interface IntervalTaskOptions {
  /** 启动后首次执行延迟(毫秒),默认 60s:避开启动高峰 */
  firstRunDelayMs?: number;
  /** 执行间隔(毫秒) */
  intervalMs: number;
}

/**
 * 单例周期任务:延迟首跑 + 固定间隔 + 重入保护。
 *
 * 仓库没有引入 `@nestjs/schedule`(不为几个每日任务加依赖),因此由各服务
 * 在 `onModuleInit` / `onModuleDestroy` 里调 `start()` / `stop()`:
 *
 * - 定时器 `unref()` → 不阻止进程退出
 * - 上一轮没跑完则跳过本轮,避免任务堆积
 * - 任务抛错只记日志,不中断后续周期
 *
 * 多实例部署时每个实例都会跑:使用方需保证任务本身幂等。
 */
export class IntervalTaskRunner {
  private readonly logger: Logger;
  private firstRunTimer?: NodeJS.Timeout;
  private intervalTimer?: NodeJS.Timeout;
  private running = false;

  constructor(
    name: string,
    private readonly task: () => unknown,
    private readonly options: IntervalTaskOptions,
  ) {
    this.logger = new Logger(name);
  }

  /** 启动:firstRunDelayMs 后首跑,之后每 intervalMs 一次 */
  start(): void {
    const { firstRunDelayMs = 60_000, intervalMs } = this.options;
    this.firstRunTimer = setTimeout(() => {
      void this.tick();
      this.intervalTimer = setInterval(() => void this.tick(), intervalMs);
      this.intervalTimer.unref?.();
    }, firstRunDelayMs);
    this.firstRunTimer.unref?.();
    this.logger.log(
      `周期任务已就绪:${firstRunDelayMs / 1000}s 后首跑,之后每 ${intervalMs / 3_600_000}h 一次`,
    );
  }

  stop(): void {
    if (this.firstRunTimer) clearTimeout(this.firstRunTimer);
    if (this.intervalTimer) clearInterval(this.intervalTimer);
  }

  /** 手动触发一轮(便于测试与运维排查) */
  async runNow(): Promise<void> {
    await this.tick();
  }

  private async tick(): Promise<void> {
    if (this.running) {
      this.logger.warn('上一轮任务尚未结束，跳过本轮');
      return;
    }
    this.running = true;
    try {
      // 任务可以是同步的(文件清理)也可以是异步的(查库),返回值一律忽略
      await Promise.resolve(this.task());
    } catch (error) {
      this.logger.error(`周期任务异常: ${String(error)}`);
    } finally {
      this.running = false;
    }
  }
}
