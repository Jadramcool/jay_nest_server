import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

/** 权限元数据：code 为权限码，name 为中文展示名 */
export interface PermissionMeta {
  code: string;
  name: string;
}

/**
 * 权限校验装饰器
 *
 * 支持两种传参（可混用）：
 * - 字符串：仅声明权限码（兼容旧写法），中文名回退为权限码本身
 * - 对象：{ code: 'system:user:create', name: '新增' }，同时声明权限码与中文名
 *
 * @example
 * @RequirePermissions('system:user:list')
 * @example
 * @RequirePermissions({ code: 'system:user:create', name: '新增' })
 */
export const RequirePermissions = (
  ...permissions: (string | PermissionMeta)[]
) =>
  SetMetadata(
    PERMISSIONS_KEY,
    permissions.map(normalizePermissionMeta),
  );

export function normalizePermissionMeta(
  permission: string | PermissionMeta,
): PermissionMeta {
  if (typeof permission === 'string') {
    return { code: permission, name: permission };
  }
  return { code: permission.code, name: permission.name ?? permission.code };
}

/** 从装饰器元数据中提取纯权限码列表（供守卫使用） */
export function extractPermissionCodes(
  permissions: PermissionMeta[] | undefined,
): string[] | undefined {
  if (!permissions) return undefined;
  return permissions.map((permission) => permission.code);
}
