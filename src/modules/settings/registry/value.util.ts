import type { SettingDefBase } from './types';

/**
 * 设置值的解析/序列化/校验。
 *
 * 与旧实现的关键差异：DB 里只存字符串（TEXT），但**接口收发的是强类型值**
 * （number/boolean/object），所以写校验直接面对强类型值，而不是"先转字符串再猜"。
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^https?:\/\/\S+$/i;
const COLOR_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** DB(TEXT) → 强类型值；空值或解析失败返回 undefined（由调用方回退默认值） */
export function parseSettingValue(
  def: Pick<SettingDefBase, 'type'>,
  raw: string | null | undefined,
): unknown {
  if (raw === null || raw === undefined || raw === '') return undefined;

  switch (def.type) {
    case 'number': {
      const num = Number(raw);
      return Number.isNaN(num) ? undefined : num;
    }
    case 'boolean':
      return raw === 'true' || raw === '1';
    case 'json':
    case 'string[]': {
      try {
        return JSON.parse(raw);
      } catch {
        return undefined;
      }
    }
    default:
      return raw;
  }
}

/** 强类型值 → DB(TEXT) */
export function serializeSettingValue(
  def: Pick<SettingDefBase, 'type'>,
  value: unknown,
): string {
  switch (def.type) {
    case 'boolean':
      return value ? 'true' : 'false';
    case 'json':
    case 'string[]':
      return JSON.stringify(value);
    default:
      return String(value);
  }
}

export interface ValidateContext {
  /** type=select 时由调用方按 dictCode 查出允许值 */
  allowed?: (string | number)[];
  /** 数据字典不存在等场景下的补充错误 */
  extraErrors?: string[];
}

/** 写时校验，返回中文错误列表（空数组表示通过） */
export function validateSettingValue(
  def: SettingDefBase,
  value: unknown,
  context: ValidateContext = {},
): string[] {
  const errors: string[] = [];

  switch (def.type) {
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        errors.push('必须是数字');
      } else {
        if (def.min !== undefined && value < def.min)
          errors.push(`不能小于 ${def.min}`);
        if (def.max !== undefined && value > def.max)
          errors.push(`不能大于 ${def.max}`);
      }
      break;

    case 'boolean':
      if (typeof value !== 'boolean') errors.push('必须是布尔值');
      break;

    case 'json':
      if (value === null || typeof value !== 'object')
        errors.push('必须是对象或数组');
      break;

    case 'string[]':
      if (
        !Array.isArray(value) ||
        value.some((item) => typeof item !== 'string')
      ) {
        errors.push('必须是字符串数组');
      }
      break;

    case 'color':
      if (typeof value !== 'string' || !COLOR_RE.test(value))
        errors.push('必须是合法的十六进制颜色，如 #1890ff');
      break;

    case 'url':
      if (typeof value !== 'string' || !URL_RE.test(value))
        errors.push('必须是合法的 http(s) 链接');
      break;

    case 'email':
      if (typeof value !== 'string' || !EMAIL_RE.test(value))
        errors.push('必须是合法的邮箱');
      break;

    case 'select':
      if (typeof value !== 'string' && typeof value !== 'number') {
        errors.push('必须是合法选项');
      } else if (context.allowed && !context.allowed.includes(value)) {
        errors.push(`只能是: ${context.allowed.join(' / ')}`);
      }
      break;

    default:
      if (typeof value !== 'string') errors.push('必须是字符串');
      break;
  }

  if (
    typeof value === 'string' &&
    def.pattern &&
    !new RegExp(def.pattern).test(value)
  ) {
    errors.push('不符合格式要求');
  }

  return [...errors, ...(context.extraErrors ?? [])];
}

/** 注册表声明与默认值自检：类型必须与默认值匹配 */
export function checkDefaultValue(
  def: SettingDefBase & { default: unknown },
): string[] {
  const errors = validateSettingValue(
    { ...def, min: undefined, max: undefined, pattern: undefined },
    def.default,
  );
  return errors.map((error) => `默认值不合法: ${error}`);
}
