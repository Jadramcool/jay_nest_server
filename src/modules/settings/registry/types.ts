/**
 * 设置注册表类型定义。
 *
 * 注册表是设置的**唯一事实来源**：默认值、类型、分组、可见性、消费方都写在代码里，
 * 数据库只存"被改过的值"（setting_override）。
 */

/** 值类型：决定 DB 序列化方式、接口返回形态与前端控件 */
export type SettingType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'json'
  | 'string[]'
  | 'color'
  | 'url'
  | 'email'
  | 'select';

/** 可见性：public=匿名可读(白名单)；admin=仅后台；secret=永不回读 */
export type SettingExpose = 'public' | 'admin' | 'secret';

/** 值来源：db=可自助修改；env=由环境变量提供，接口只读 */
export type SettingSource = 'db' | 'env';

export type SettingGroup = '站点' | '安全' | '上传' | '报表' | '维护' | '其它';

export interface SettingDefBase {
  type: SettingType;
  label: string;
  group: SettingGroup;
  description?: string;
  /** 缺省 admin */
  expose?: SettingExpose;
  /** 缺省 db */
  source?: SettingSource;
  /** source=env 时必填：对应环境变量名 */
  envKey?: string;
  /** type=select 时必填：数据字典类型编码（选项不重复维护） */
  dictCode?: string;
  min?: number;
  max?: number;
  pattern?: string;
  /** 消费方说明：启动校验与 CI 用它治理"死配置" */
  consumer: string;
  order?: number;
}

export interface SettingDef<T = unknown> extends SettingDefBase {
  default: T;
}

export type SettingRegistry = Record<string, SettingDef>;

/** 仅用于保留字面量类型的分组包装 */
export function defineGroup<const T extends SettingRegistry>(defs: T): T {
  return defs;
}

type ValueOf<D> = D extends { type: 'number' }
  ? number
  : D extends { type: 'boolean' }
    ? boolean
    : D extends { type: 'json' }
      ? unknown
      : D extends { type: 'string[]' }
        ? string[]
        : string;

export type SettingKeyOf<R extends SettingRegistry> = keyof R & string;
export type SettingValueOf<
  R extends SettingRegistry,
  K extends keyof R,
> = ValueOf<R[K]>;
