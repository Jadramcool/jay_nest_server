import {
  PLATFORMS,
  configurablePlatforms,
  isClientPlatform,
  isPlatformCode,
  platformFromPermission,
  resolveClientPlatform,
  visiblePlatforms,
} from './platform';

describe('platform 常量与工具', () => {
  it('isPlatformCode 识别已登记的端', () => {
    expect(isPlatformCode('admin')).toBe(true);
    expect(isPlatformCode('app')).toBe(true);
    expect(isPlatformCode('common')).toBe(true);
    expect(isPlatformCode('web')).toBe(false);
    expect(isPlatformCode(undefined)).toBe(false);
  });

  it('isClientPlatform 不接受共享端 common', () => {
    expect(isClientPlatform('app')).toBe(true);
    expect(isClientPlatform('common')).toBe(false);
  });

  it('resolveClientPlatform 对空值/非法值回落到管理端', () => {
    expect(resolveClientPlatform(undefined)).toBe(PLATFORMS.ADMIN);
    expect(resolveClientPlatform('')).toBe(PLATFORMS.ADMIN);
    expect(resolveClientPlatform('unknown')).toBe(PLATFORMS.ADMIN);
    expect(resolveClientPlatform('app')).toBe(PLATFORMS.APP);
  });

  it('visiblePlatforms 返回本端 + 共享端', () => {
    expect(visiblePlatforms(PLATFORMS.APP)).toEqual(['app', 'common']);
    expect(visiblePlatforms(PLATFORMS.ADMIN)).toEqual(['admin', 'common']);
  });

  it('configurablePlatforms 限定普通角色只能配置本端与通用端', () => {
    expect(configurablePlatforms('admin')).toEqual(['admin', 'common']);
    expect(configurablePlatforms('app')).toEqual(['app', 'common']);
    expect(configurablePlatforms(undefined)).toEqual(['admin', 'common']);
    expect(configurablePlatforms('unknown')).toEqual(['admin', 'common']);
  });

  it('configurablePlatforms 允许通用角色配置所有端', () => {
    expect(configurablePlatforms(PLATFORMS.COMMON)).toEqual([
      'admin',
      'app',
      'mp',
      'common',
    ]);
  });

  it('platformFromPermission 只识别已登记的端前缀', () => {
    expect(platformFromPermission('app:report:generate')).toBe('app');
    expect(platformFromPermission('common:user:profile')).toBe('common');
    // 历史管理端权限码没有端前缀
    expect(platformFromPermission('system:user:create')).toBeNull();
    expect(platformFromPermission('notice:list')).toBeNull();
  });
});
