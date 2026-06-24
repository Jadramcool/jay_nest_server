import { OperationType } from '@prisma/client';

const MODULE_NAMES: Record<string, string> = {
  '/api/auth': '用户认证',
  '/api/system/user': '用户管理',
  '/api/system/role': '角色管理',
  '/api/system/menu': '菜单管理',
  '/api/system/department': '部门管理',
  '/api/system/config': '系统配置',
  '/api/system/operation-log': '操作日志',
  '/api/notice': '公告管理',
  '/api/upload': '文件上传',
  '/api/public': '公共接口',
};

const METHOD_TO_OPERATION_TYPE: Record<string, OperationType> = {
  GET: OperationType.VIEW,
  POST: OperationType.CREATE,
  PUT: OperationType.UPDATE,
  PATCH: OperationType.UPDATE,
  DELETE: OperationType.DELETE,
};

export const EXCLUDE_PATHS = [
  '/health',
  '/metrics',
  '/api-docs',
  '/api/auth/refresh',
];

export function resolveModuleName(path: string): string {
  for (const [prefix, name] of Object.entries(MODULE_NAMES)) {
    if (path.startsWith(prefix)) {
      return name;
    }
  }
  return '未知模块';
}

export function getDefaultDescription(
  operationType: OperationType,
  path: string,
): string {
  const typeDescriptions: Record<string, string> = {
    [OperationType.CREATE]: '新增',
    [OperationType.UPDATE]: '修改',
    [OperationType.DELETE]: '删除',
    [OperationType.VIEW]: '查看',
    [OperationType.LOGIN]: '登录',
    [OperationType.LOGOUT]: '登出',
    [OperationType.EXPORT]: '导出',
    [OperationType.IMPORT]: '导入',
    [OperationType.OTHER]: '其他',
  };

  const moduleName = resolveModuleName(path);
  return `${typeDescriptions[operationType] || '操作'}${moduleName}`;
}

export function resolveOperationType(method: string): OperationType {
  return METHOD_TO_OPERATION_TYPE[method] || OperationType.OTHER;
}
