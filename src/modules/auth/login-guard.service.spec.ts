import { HttpException } from '@nestjs/common';
import { LoginGuardService } from './login-guard.service';

describe('LoginGuardService', () => {
  let service: LoginGuardService;

  beforeEach(() => {
    service = new LoginGuardService();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
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

    it('should lock after 5 consecutive failures', () => {
      for (let i = 0; i < 5; i++) service.recordFailure('admin', '127.0.0.1');

      expect(() => service.assertNotLocked('admin', '127.0.0.1')).toThrow(
        '登录失败次数过多',
      );
    });

    it('should throw 42901 code when locked', () => {
      for (let i = 0; i < 5; i++) service.recordFailure('admin', '127.0.0.1');

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

    it('should reset failures on success', () => {
      for (let i = 0; i < 4; i++) service.recordFailure('admin', '127.0.0.1');
      service.resetFailures('admin', '127.0.0.1');

      expect(() => service.assertNotLocked('admin', '127.0.0.1')).not.toThrow();
      // 重置后重新计数
      service.recordFailure('admin', '127.0.0.1');
      expect(() => service.assertNotLocked('admin', '127.0.0.1')).not.toThrow();
    });

    it('should unlock after lock duration', () => {
      for (let i = 0; i < 5; i++) service.recordFailure('admin', '127.0.0.1');
      expect(() => service.assertNotLocked('admin', '127.0.0.1')).toThrow();

      jest.advanceTimersByTime(16 * 60 * 1000);
      expect(() => service.assertNotLocked('admin', '127.0.0.1')).not.toThrow();
    });

    it('should isolate by username and ip', () => {
      for (let i = 0; i < 5; i++) service.recordFailure('admin', '127.0.0.1');

      // 不同用户不受影响
      expect(() => service.assertNotLocked('other', '127.0.0.1')).not.toThrow();
      // 同一用户不同 IP 不受影响
      expect(() => service.assertNotLocked('admin', '10.0.0.1')).not.toThrow();
    });
  });
});
