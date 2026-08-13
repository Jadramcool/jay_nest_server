import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as svgCaptcha from 'svg-captcha';
import { ConfigResolverService } from '@/modules/system/sys-config/config-resolver.service';

/**
 * 登录守卫:图形验证码 + 失败限流(内存实现,单实例部署有效)
 *
 * - 验证码:svg-captcha 生成,答案存内存 Map,5 分钟过期,一次性使用
 *   - 可用环境变量 LOGIN_CAPTCHA_ENABLED=false 关闭(本地/测试环境)
 * - 限流:按 用户名+IP 计数,连续失败达到阈值后锁定(错误码 42901)
 *   - 阈值与锁定分钟数读系统配置 `security.login.maxRetry` / `security.login.lockMinutes`
 *   - 配置写入时 ConfigResolverService 自动失效缓存,变更即时生效
 *
 * 注意:多实例部署时需替换为 Redis 实现(当前内存方案仅单实例有效)
 */

interface CaptchaEntry {
  answer: string;
  expiresAt: number;
}

interface RateLimitEntry {
  failures: number;
  lockedUntil?: number;
}

const CAPTCHA_TTL = 5 * 60 * 1000; // 5 分钟
const DEFAULT_MAX_FAILURES = 5;
const DEFAULT_LOCK_MINUTES = 15;

@Injectable()
export class LoginGuardService {
  private readonly captchaStore = new Map<string, CaptchaEntry>();
  private readonly rateLimitStore = new Map<string, RateLimitEntry>();

  constructor(
    private readonly configService: ConfigService,
    private readonly configResolver: ConfigResolverService,
  ) {}

  /** 验证码是否启用(LOGIN_CAPTCHA_ENABLED,默认开启) */
  isCaptchaEnabled(): boolean {
    return (
      this.configService.get<string>('LOGIN_CAPTCHA_ENABLED', 'true') !==
      'false'
    );
  }

  /** 连续失败阈值(读系统配置,默认 5 次) */
  private async getMaxFailures(): Promise<number> {
    return this.configResolver.get<number>(
      'security.login.maxRetry',
      DEFAULT_MAX_FAILURES,
    );
  }

  /** 锁定时长毫秒(读系统配置,默认 15 分钟) */
  private async getLockDuration(): Promise<number> {
    const minutes = await this.configResolver.get<number>(
      'security.login.lockMinutes',
      DEFAULT_LOCK_MINUTES,
    );
    return minutes * 60 * 1000;
  }

  // ═══════════ 图形验证码 ═══════════

  /** 生成验证码,返回 captchaId 与 base64 图片 */
  createCaptcha(): { captchaId: string; image: string } {
    const captcha = svgCaptcha.create({
      size: 4,
      noise: 2,
      ignoreChars: '0o1ilI',
      color: true,
      background: '#f2f5f9',
    });
    const captchaId = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    this.captchaStore.set(captchaId, {
      answer: captcha.text.toLowerCase(),
      expiresAt: Date.now() + CAPTCHA_TTL,
    });
    this.cleanupCaptchas();
    return {
      captchaId,
      image: `data:image/svg+xml;base64,${Buffer.from(captcha.data).toString('base64')}`,
    };
  }

  /**
   * 校验验证码(一次性,区分大小写不敏感)
   * 校验失败时抛出 42201
   */
  consumeCaptcha(captchaId: string, captcha: string): void {
    const entry = this.captchaStore.get(captchaId);
    if (!entry) {
      throw new HttpException(
        { code: 42201, message: '验证码已过期，请刷新后重试' },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    this.captchaStore.delete(captchaId); // 一次性使用
    if (Date.now() > entry.expiresAt) {
      throw new HttpException(
        { code: 42201, message: '验证码已过期，请刷新后重试' },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    if (captcha.toLowerCase() !== entry.answer) {
      throw new HttpException(
        { code: 42201, message: '验证码错误' },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
  }

  private cleanupCaptchas() {
    const now = Date.now();
    for (const [id, entry] of this.captchaStore) {
      if (entry.expiresAt < now) this.captchaStore.delete(id);
    }
  }

  // ═══════════ 登录失败限流 ═══════════

  private rateKey(username: string, ip?: string) {
    return `${username}:${ip ?? 'unknown'}`;
  }

  /** 检查是否被锁定,锁定中抛出 42901 */
  assertNotLocked(username: string, ip?: string): void {
    const entry = this.rateLimitStore.get(this.rateKey(username, ip));
    if (entry?.lockedUntil && entry.lockedUntil > Date.now()) {
      const minutes = Math.ceil((entry.lockedUntil - Date.now()) / 60000);
      throw new HttpException(
        { code: 42901, message: `登录失败次数过多，请 ${minutes} 分钟后再试` },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /** 记录一次登录失败,达到阈值则锁定 */
  async recordFailure(username: string, ip?: string): Promise<void> {
    const key = this.rateKey(username, ip);
    const entry = this.rateLimitStore.get(key) ?? { failures: 0 };
    entry.failures += 1;
    if (entry.failures >= (await this.getMaxFailures())) {
      entry.lockedUntil = Date.now() + (await this.getLockDuration());
      entry.failures = 0;
    }
    this.rateLimitStore.set(key, entry);
  }

  /** 登录成功清除限流状态 */
  resetFailures(username: string, ip?: string): void {
    this.rateLimitStore.delete(this.rateKey(username, ip));
  }
}
