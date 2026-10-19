import type { SettingDef, SettingGroup, SettingValueOf } from './types';
import { defineGroup } from './types';

export type {
  SettingDef,
  SettingExpose,
  SettingGroup,
  SettingSource,
  SettingType,
} from './types';

/**
 * 设置注册表 —— 设置的唯一事实来源。
 *
 * 规则（由 CI 契约测试强制）：
 *   1. key 必须命名空间化，如 `site.name`；
 *   2. 每项必须有 label / group / default / consumer；
 *   3. `expose: 'secret'` 必须是 `source: 'env'`（密钥不入库、不回读）；
 *   4. `type: 'select'` 必须给 `dictCode`（选项由数据字典维护）；
 *   5. 类型必须与默认值匹配。
 *
 * 加一项设置 = 改这里 + 发版；数据库只存覆盖值。
 */
export const settings = {
  ...defineGroup({
    'site.name': {
      type: 'string',
      default: 'Jay Admin',
      label: '站点名称',
      group: '站点',
      description: '登录页与侧边栏展示的系统名称',
      expose: 'public',
      order: 1,
      consumer: 'web-admin: SideLogo / 登录页',
    },
    'site.description': {
      type: 'string',
      default: '基于 NestJS 与 Vue3 的现代化管理系统',
      label: '站点描述',
      group: '站点',
      description: '登录页副标题',
      expose: 'public',
      order: 2,
      consumer: 'web-admin: 登录页',
    },
    'site.copyright': {
      type: 'string',
      default: '© 2026 Jay Admin. All rights reserved.',
      label: '版权信息',
      group: '站点',
      description: '页脚版权文案',
      expose: 'public',
      order: 3,
      consumer: 'web-admin: 页脚',
    },
    'site.primaryColor': {
      type: 'color',
      default: '#1890ff',
      label: '主题色',
      group: '站点',
      description: '管理端主题主色，保存后即时生效',
      expose: 'public',
      order: 4,
      consumer: 'web-admin: app store 主题色',
    },
  }),
  ...defineGroup({
    'security.login.maxRetry': {
      type: 'number',
      default: 5,
      min: 1,
      max: 20,
      label: '登录失败最大次数',
      group: '安全',
      description: '超过该次数锁定账号',
      order: 1,
      consumer: 'api: login-guard.service',
    },
    'security.login.lockMinutes': {
      type: 'number',
      default: 15,
      min: 1,
      max: 1440,
      label: '失败锁定时长（分钟）',
      group: '安全',
      order: 2,
      consumer: 'api: login-guard.service',
    },
    'session.activeWindowMinutes': {
      type: 'number',
      default: 5,
      min: 2,
      max: 1440,
      label: '在线判定窗口（分钟）',
      group: '安全',
      description:
        '最近该时长内有过请求的会话才计为「在线」，超过则显示为「闲置」（会话本身仍有效，不算掉线）。活跃时间回写带 60s 节流，故不宜小于 2 分钟，否则状态会抖动',
      order: 3,
      consumer: 'api: session/session.service（在线统计与列表状态）',
    },
  }),
  ...defineGroup({
    'notice.retentionDays': {
      type: 'number',
      default: 180,
      min: 7,
      max: 3650,
      label: '公告保留天数',
      group: '维护',
      description:
        '按发布时间(publishedAt，缺失时用创建时间)起算，超过该天数的已发布公告会被软删除；置顶公告不受影响，管理端可在「已清理」里恢复',
      order: 1,
      consumer: 'api: maintenance/cleanup.service(定时任务)',
    },
    'operationLog.retentionDays': {
      type: 'number',
      default: 365,
      min: 30,
      max: 3650,
      label: '操作日志保留天数',
      group: '维护',
      description: '超过该天数的操作日志会被删除',
      order: 2,
      consumer: 'api: maintenance/cleanup.service(定时任务)',
    },
    'system.cleanupEnabled': {
      type: 'boolean',
      default: true,
      label: '启用定时清理',
      group: '维护',
      description:
        '关闭后所有定时清理（公告 / 操作日志 / 报告中间产物）全部暂停（应急开关）',
      order: 3,
      consumer: 'api: maintenance/cleanup.scheduler',
    },
  }),
};

export type SettingKey = keyof typeof settings;
export type SettingValue<K extends SettingKey> = SettingValueOf<
  typeof settings,
  K
>;

/** 分组展示顺序（设置页 tab 顺序） */
export const SETTING_GROUP_ORDER: SettingGroup[] = [
  '站点',
  '安全',
  '上传',
  '报表',
  '维护',
  '其它',
];

export function getSettingDef(key: SettingKey): SettingDef {
  return settings[key];
}

export function isSettingKey(key: string): key is SettingKey {
  return Object.prototype.hasOwnProperty.call(settings, key);
}

export function allSettingKeys(): SettingKey[] {
  return Object.keys(settings) as SettingKey[];
}

/** 匿名可读白名单：只有 expose=public 且非 secret 的项 */
export function publicSettingKeys(): SettingKey[] {
  return allSettingKeys().filter(
    (key) => getSettingDef(key).expose === 'public',
  );
}

export function sortedSettingKeys(): SettingKey[] {
  return allSettingKeys().sort((a, b) => {
    const defA = settings[a];
    const defB = settings[b];
    const groupDiff =
      SETTING_GROUP_ORDER.indexOf(defA.group) -
      SETTING_GROUP_ORDER.indexOf(defB.group);
    if (groupDiff !== 0) return groupDiff;
    return (defA.order ?? 99) - (defB.order ?? 99);
  });
}
