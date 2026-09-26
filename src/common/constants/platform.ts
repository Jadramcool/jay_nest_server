/**
 * 端（platform）常量
 *
 * 端是权限体系的一等维度：角色、菜单/按钮都属于某个端，登录时携带端标识，
 * token 里只包含该端的角色与权限，从而实现端之间的天然隔离。
 *
 * 新增端只需在这里登记一项 + 灌对应种子数据，无需修改数据库结构
 * （platform 列是 VARCHAR(16) 而非数据库枚举）。
 */
export const PLATFORMS = {
  /** 管理后台 */
  ADMIN: 'admin',
  /** 移动端 App */
  APP: 'app',
  /** 小程序（预留） */
  MP: 'mp',
  /** 两端共享的能力（如个人中心、修改密码） */
  COMMON: 'common',
} as const;

export type PlatformCode = (typeof PLATFORMS)[keyof typeof PLATFORMS];

/** 可作为登录端的端（不含共享端 common） */
export const CLIENT_PLATFORMS = [
  PLATFORMS.ADMIN,
  PLATFORMS.APP,
  PLATFORMS.MP,
] as const;

export type ClientPlatform = (typeof CLIENT_PLATFORMS)[number];

/** 登录缺省端 */
export const DEFAULT_CLIENT_PLATFORM: ClientPlatform = PLATFORMS.ADMIN;

export const PLATFORM_LABELS: Record<PlatformCode, string> = {
  [PLATFORMS.ADMIN]: '管理端',
  [PLATFORMS.APP]: 'App 端',
  [PLATFORMS.MP]: '小程序',
  [PLATFORMS.COMMON]: '通用',
};

export function isPlatformCode(value: unknown): value is PlatformCode {
  return (
    typeof value === 'string' &&
    (Object.values(PLATFORMS) as string[]).includes(value)
  );
}

export function isClientPlatform(value: unknown): value is ClientPlatform {
  return (
    typeof value === 'string' &&
    (CLIENT_PLATFORMS as readonly string[]).includes(value)
  );
}

/** 归一化登录端：缺省或非法值一律回落到管理端 */
export function resolveClientPlatform(value?: string | null): ClientPlatform {
  return isClientPlatform(value) ? value : DEFAULT_CLIENT_PLATFORM;
}

/** 某个端可见的角色/菜单端集合：本端 + 通用端 */
export function visiblePlatforms(client: ClientPlatform): PlatformCode[] {
  return [client, PLATFORMS.COMMON];
}

/**
 * 从权限码解析端前缀
 *
 * 约定：新增权限码建议带端前缀（app:report:generate、common:user:profile），
 * 历史管理端权限码（system:user:create）没有前缀，返回 null 表示"按所在行的端解释"。
 */
export function platformFromPermission(code: string): PlatformCode | null {
  const prefix = code.split(':')[0];
  // 未登记过的前缀（如 system/notice/dashboard）视为历史无前缀写法
  return isPlatformCode(prefix) ? prefix : null;
}
