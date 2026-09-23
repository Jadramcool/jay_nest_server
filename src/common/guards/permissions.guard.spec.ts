import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { PermissionsGuard } from './permissions.guard';

/**
 * 权限守卫行为验证。
 *
 * 装饰器元数据为 { code, name } 结构（中文名用于权限管理展示），
 * 守卫只取 code 与用户权限串比对。
 */
describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let reflector: jest.Mocked<Reflector>;

  const createContext = (user?: { permissions?: string[] }) =>
    ({
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    }) as ExecutionContext;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;
    guard = new PermissionsGuard(reflector);
  });

  it('should allow when no permission metadata is set', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    expect(guard.canActivate(createContext())).toBe(true);
  });

  it('should allow when user holds the required permission', () => {
    reflector.getAllAndOverride.mockReturnValue([
      { code: 'system:monitor:view', name: '查看监控' },
    ]);

    expect(
      guard.canActivate(
        createContext({ permissions: ['system:monitor:view'] }),
      ),
    ).toBe(true);
  });

  it('should deny (403) when user lacks system:monitor:view', () => {
    reflector.getAllAndOverride.mockReturnValue([
      { code: 'system:monitor:view', name: '查看监控' },
    ]);

    expect(
      guard.canActivate(createContext({ permissions: ['system:user:list'] })),
    ).toBe(false);
  });

  it('should deny when user or permissions are missing', () => {
    reflector.getAllAndOverride.mockReturnValue([
      { code: 'system:monitor:view', name: '查看监控' },
    ]);

    expect(guard.canActivate(createContext(undefined))).toBe(false);
    expect(guard.canActivate(createContext({}))).toBe(false);
  });

  it('should pass when any of the required permissions matches', () => {
    reflector.getAllAndOverride.mockReturnValue([
      { code: 'system:monitor:view', name: '查看监控' },
      { code: 'system:metrics:list', name: '查询指标' },
    ]);

    expect(
      guard.canActivate(
        createContext({ permissions: ['system:metrics:list'] }),
      ),
    ).toBe(true);
  });
});
