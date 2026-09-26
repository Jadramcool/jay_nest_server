import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { PLATFORM_KEY } from '../decorators/platform.decorator';
import { PermissionsGuard } from './permissions.guard';

/**
 * 权限守卫行为验证。
 *
 * 装饰器元数据为 { code, name } 结构（中文名用于权限管理展示），
 * 守卫只取 code 与用户权限串比对；@Platform 元数据用于端限制校验。
 */
describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let reflector: jest.Mocked<Reflector>;

  const createContext = (user?: {
    platform?: string;
    permissions?: string[];
  }) =>
    ({
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    }) as ExecutionContext;

  /** 按元数据 key 返回不同的值（守卫会分别读取权限与端元数据） */
  const setMetadata = (permissions?: unknown, platforms?: unknown) => {
    reflector.getAllAndOverride.mockImplementation((key: string) =>
      key === PLATFORM_KEY ? platforms : permissions,
    );
  };

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;
    guard = new PermissionsGuard(reflector);
    expect(PERMISSIONS_KEY).toBe('permissions');
  });

  it('should allow when no permission metadata is set', () => {
    setMetadata(undefined);

    expect(guard.canActivate(createContext())).toBe(true);
  });

  it('should allow when user holds the required permission', () => {
    setMetadata([{ code: 'system:monitor:view', name: '查看监控' }]);

    expect(
      guard.canActivate(
        createContext({ permissions: ['system:monitor:view'] }),
      ),
    ).toBe(true);
  });

  it('should deny (403) when user lacks system:monitor:view', () => {
    setMetadata([{ code: 'system:monitor:view', name: '查看监控' }]);

    expect(
      guard.canActivate(createContext({ permissions: ['system:user:list'] })),
    ).toBe(false);
  });

  it('should deny when user or permissions are missing', () => {
    setMetadata([{ code: 'system:monitor:view', name: '查看监控' }]);

    expect(guard.canActivate(createContext(undefined))).toBe(false);
    expect(guard.canActivate(createContext({}))).toBe(false);
  });

  it('should pass when any of the required permissions matches', () => {
    setMetadata([
      { code: 'system:monitor:view', name: '查看监控' },
      { code: 'system:metrics:list', name: '查询指标' },
    ]);

    expect(
      guard.canActivate(
        createContext({ permissions: ['system:metrics:list'] }),
      ),
    ).toBe(true);
  });

  it('should deny when token platform does not match @Platform', () => {
    setMetadata(undefined, ['app']);

    expect(guard.canActivate(createContext({ platform: 'admin' }))).toBe(false);
    expect(guard.canActivate(createContext({}))).toBe(false);
    expect(guard.canActivate(createContext({ platform: 'app' }))).toBe(true);
  });

  it('should allow any platform when @Platform is absent', () => {
    setMetadata([{ code: 'app:report:generate', name: '生成报告' }], undefined);

    expect(
      guard.canActivate(
        createContext({
          platform: 'app',
          permissions: ['app:report:generate'],
        }),
      ),
    ).toBe(true);
  });
});
