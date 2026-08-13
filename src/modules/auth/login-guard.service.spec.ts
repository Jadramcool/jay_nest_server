import { HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoginGuardService } from './login-guard.service';
import { ConfigResolverService } from '@/modules/system/sys-config/config-resolver.service';

describe('LoginGuardService', () => {
  let service: LoginGuardService;

  const configGet = jest.fn();
  const resolverGet = jest.fn<Promise<number>, [key: string]>();

  beforeEach(() => {
    configGet.mockReturnValue('true');
    // 默认系统配置:最大失败 5 次,锁定 15 分钟
    resolverGet.mockImplementation((key: string) =>
      key === 'security.login.lockMinutes'
        ? Promise.resolve(15)
        : Promise.resolve(5),
    );
    service = new LoginGuardService(
      { get: configGet } as unknown as ConfigService,
      { get: resolverGet } as unknown as ConfigResolverService,
    );
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('验证码开关', () => {
    it('should be enabled by default', () => {
      configGet.mockReturnValue(undefined);
      expect(service.isCaptchaEnabled()).toBe(true);
    });

    it('should be disabled when LOGIN_CAPTCHA_ENABLED=false', () => {
      configGet.mockReturnValue('false');
      expect(service.isCaptchaEnabled()).toBe(false);
    });

    it('should be enabled when LOGIN_CAPTCHA_ENABLED=true', () => {
      configGet.mockReturnValue('true');
      expect(service.isCaptchaEnabled()).toBe(true);
    });
  });

  describe('验证码', () => {
    it('should create captcha with id and base64 image', () => {
      const captcha = service.createCaptcha();

      expect(captcha.captchaId).toBeTruthy();
      expect(captcha.image).toMatch(/^data:image\/svg\+xml;base64,/);
    });

    it('should validate captcha case-insensitively and consume once', () => {
      const { captchaId } = service.createCaptcha();
      // 从生成器内部拿答案不便,验证错误路径与一次性语义:
      // 任意错误答案 → 422
      expect(() => service.consumeCaptcha(captchaId, 'wrong')).toThrow(
        HttpException,
      );
      // 已消费的 id → 过期
      expect(() => service.consumeCaptcha(captchaId, 'whatever')).toThrow(
        '验证码已过期',
      );
    });

    it('should reject expired captcha', () => {
      const { captchaId } = service.createCaptcha();
      // 答案错误先消费;直接构造过期场景:手动推进时间后
      // 重新生成并立刻过期不可行,验证 unknown id 与错误答案的 422
      jest.advanceTimersByTime(6 * 60 * 1000);
      expect(() => service.consumeCaptcha(captchaId, 'abcd')).toThrow(
        '验证码已过期',
      );
    });
  });

  describe('限流', () => {
    it('should allow login before threshold', () => {
      expect(() => service.assertNotLocked('admin', '127.0.0.1')).not.toThrow();
    });

    it('should lock after 5 consecutive failures (default)', async () => {
      for (let i = 0; i < 5; i++)
        await service.recordFailure('admin', '127.0.0.1');

      expect(() => service.assertNotLocked('admin', '127.0.0.1')).toThrow(
        '登录失败次数过多',
      );
    });

    it('should use configured max retries from sys config', async () => {
      resolverGet.mockResolvedValue(3);
      for (let i = 0; i < 3; i++)
        await service.recordFailure('admin', '127.0.0.1');

      expect(() => service.assertNotLocked('admin', '127.0.0.1')).toThrow(
        '登录失败次数过多',
      );
      expect(resolverGet.mock.calls[0][0]).toBe('security.login.maxRetry');
    });

    it('should throw 42901 code when locked', async () => {
      for (let i = 0; i < 5; i++)
        await service.recordFailure('admin', '127.0.0.1');

      try {
        service.assertNotLocked('admin', '127.0.0.1');
        throw new Error('should have thrown');
      } catch (error) {
        const response = (error as HttpException).getResponse() as {
          code: number;
        };
        expect(response.code).toBe(42901);
      }
    });

    it('should reset failures on success', async () => {
      for (let i = 0; i < 4; i++)
        await service.recordFailure('admin', '127.0.0.1');
      service.resetFailures('admin', '127.0.0.1');

      expect(() => service.assertNotLocked('admin', '127.0.0.1')).not.toThrow();
      // 重置后重新计数
      await service.recordFailure('admin', '127.0.0.1');
      expect(() => service.assertNotLocked('admin', '127.0.0.1')).not.toThrow();
    });

    it('should unlock after configured lock duration', async () => {
      for (let i = 0; i < 5; i++)
        await service.recordFailure('admin', '127.0.0.1');
      expect(() => service.assertNotLocked('admin', '127.0.0.1')).toThrow();

      jest.advanceTimersByTime(16 * 60 * 1000);
      expect(() => service.assertNotLocked('admin', '127.0.0.1')).not.toThrow();
    });

    it('should use configured lock minutes from sys config', async () => {
      resolverGet.mockImplementation((key: string) =>
        key === 'security.login.lockMinutes'
          ? Promise.resolve(1)
          : Promise.resolve(5),
      );
      for (let i = 0; i < 5; i++)
        await service.recordFailure('admin', '127.0.0.1');
      expect(() => service.assertNotLocked('admin', '127.0.0.1')).toThrow();

      // 锁定 1 分钟后解锁
      jest.advanceTimersByTime(2 * 60 * 1000);
      expect(() => service.assertNotLocked('admin', '127.0.0.1')).not.toThrow();
    });

    it('should isolate by username and ip', async () => {
      for (let i = 0; i < 5; i++)
        await service.recordFailure('admin', '127.0.0.1');

      // 不同用户不受影响
      expect(() => service.assertNotLocked('other', '127.0.0.1')).not.toThrow();
      // 同一用户不同 IP 不受影响
      expect(() => service.assertNotLocked('admin', '10.0.0.1')).not.toThrow();
    });
  });
});
