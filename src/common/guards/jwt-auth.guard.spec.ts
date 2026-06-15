import { Reflector } from '@nestjs/core';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: jest.Mocked<Reflector>;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;
    guard = new JwtAuthGuard(reflector);
  });

  it('should return true immediately when @Public() is set', () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () =>
        ({
          getRequest: () => ({}),
        }) as ReturnType<ExecutionContext['switchToHttp']>,
    } as ExecutionContext;

    const result = guard.canActivate(context);
    expect(result).toBe(true);
  });

  describe('handleRequest', () => {
    it('should return user when valid', () => {
      const user = { userId: 1, username: 'test' };
      expect(guard.handleRequest(null, user)).toEqual(user);
    });

    it('should throw UnauthorizedException when no user', () => {
      expect(() => guard.handleRequest(null, false)).toThrow(
        UnauthorizedException,
      );
    });

    it('should pass through the original error when present', () => {
      const error = new UnauthorizedException('custom error');
      expect(() => guard.handleRequest(error, false)).toThrow(error);
    });
  });
});
