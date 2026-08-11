/**
 * 数据字典初始数据
 * 内置常用业务字典,seed 时按类型编码 upsert,幂等可重复执行
 */
export interface DictSeedType {
  code: string;
  name: string;
  remark?: string;
  items: { code: string; label: string; sortOrder?: number }[];
}

export const dictSeeds: DictSeedType[] = [
  {
    code: 'sex',
    name: '性别',
    remark: '用户性别',
    items: [
      { code: 'MALE', label: '男', sortOrder: 1 },
      { code: 'FEMALE', label: '女', sortOrder: 2 },
      { code: 'OTHER', label: '其他', sortOrder: 3 },
    ],
  },
  {
    code: 'notice_type',
    name: '公告类型',
    remark: '公告类型分类',
    items: [
      { code: 'NOTICE', label: '通知', sortOrder: 1 },
      { code: 'INFO', label: '信息', sortOrder: 2 },
      { code: 'ACTIVITY', label: '活动', sortOrder: 3 },
    ],
  },
  {
    code: 'operation_type',
    name: '操作类型',
    remark: '操作日志分类',
    items: [
      { code: 'CREATE', label: '创建', sortOrder: 1 },
      { code: 'UPDATE', label: '更新', sortOrder: 2 },
      { code: 'DELETE', label: '删除', sortOrder: 3 },
      { code: 'VIEW', label: '查看', sortOrder: 4 },
      { code: 'LOGIN', label: '登录', sortOrder: 5 },
      { code: 'LOGOUT', label: '登出', sortOrder: 6 },
      { code: 'EXPORT', label: '导出', sortOrder: 7 },
      { code: 'IMPORT', label: '导入', sortOrder: 8 },
      { code: 'OTHER', label: '其他', sortOrder: 9 },
    ],
  },
  {
    code: 'status',
    name: '通用状态',
    remark: '通用启停状态',
    items: [
      { code: '1', label: '启用', sortOrder: 1 },
      { code: '0', label: '禁用', sortOrder: 2 },
    ],
  },
];
