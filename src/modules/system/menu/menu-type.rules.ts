import { MenuType } from '@prisma/client';

/** 菜单类型中文名（错误提示与界面展示共用） */
export const MENU_TYPE_LABEL: Record<MenuType, string> = {
  DIRECTORY: '目录',
  MENU: '菜单',
  BUTTON: '按钮',
};

export interface MenuTypeRule {
  /** 是否允许作为根节点（pid 为空） */
  allowRoot: boolean;
  /** 允许的父节点类型 */
  parentTypes: MenuType[];
}

/**
 * 菜单树父子类型约束
 *
 * 同一棵树承载两个投影：
 * - 导航层（目录 / 菜单）：构成路由与侧边栏，可作根节点，父级只能是目录
 * - 权限层（按钮）：一个按钮即一个接口权限码，必须挂在导航节点下
 *
 * 按钮的宿主既可以是页面（菜单），也可以是模块分组（目录）：
 * 页面级操作（如"查询用户"）挂在页面上，模块级操作（如"新增用户""分配角色"）
 * 直接挂在目录上——现有种子数据与线上库都是这个约定，两种挂法都能被
 * 鉴权（JwtStrategy 只按 type='BUTTON' 采集）与授权树正常消费。
 *
 * 被禁止的是真正无法消费的结构：按钮没有父级（在授权树里成孤儿）、
 * 按钮挂在按钮下、页面挂在页面/按钮下。
 */
export const MENU_TYPE_RULES: Record<MenuType, MenuTypeRule> = {
  DIRECTORY: { allowRoot: true, parentTypes: ['DIRECTORY'] },
  MENU: { allowRoot: true, parentTypes: ['DIRECTORY'] },
  BUTTON: { allowRoot: false, parentTypes: ['DIRECTORY', 'MENU'] },
};

/** 权限码的唯一声明方：只有按钮行可以携带 permission */
export function isPermissionOwner(type: MenuType): boolean {
  return type === 'BUTTON';
}

/** 人类可读的父级约束描述，用于错误提示 */
export function describeAllowedParents(type: MenuType): string {
  const rule = MENU_TYPE_RULES[type];
  const parents = rule.parentTypes
    .map((item) => MENU_TYPE_LABEL[item])
    .join('、');
  return rule.allowRoot ? `根节点或${parents}` : parents;
}
