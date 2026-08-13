/**
 * 系统配置类型系统
 *
 * 每个 ConfigType 统一实现 解析/校验/序列化,并映射前端控件:
 * - parse:    读时转强类型(NUMBER→number, BOOLEAN→boolean, JSON→object...)
 * - validate: 写时校验(格式 + options 约束),返回错误列表
 * - serialize:写时统一转字符串存储
 * - 前端控件:类型 → naive-ui 组件映射(供管理弹窗渲染)
 */

export type ConfigType =
  | 'STRING'
  | 'NUMBER'
  | 'BOOLEAN'
  | 'JSON'
  | 'ARRAY'
  | 'FILE'
  | 'EMAIL'
  | 'URL'
  | 'PASSWORD';

export interface ConfigOptions {
  min?: number;
  max?: number;
  pattern?: string;
  enum?: string[];
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE =
  /^https?:\/\/[\w.-]+(?::\d+)?(?:\/[\w\-._~:/?#[\]@!$&'()*+,;=]*)?$/i;

// ═══════════ 解析(读) ═══════════

export function parseConfigValue(
  type: ConfigType,
  value: string | null | undefined,
): unknown {
  if (value === null || value === undefined || value === '') return null;

  switch (type) {
    case 'NUMBER': {
      const num = Number(value);
      return Number.isNaN(num) ? null : num;
    }
    case 'BOOLEAN':
      return value === 'true' || value === '1';
    case 'JSON':
    case 'ARRAY':
      try {
        return JSON.parse(value);
      } catch {
        return null;
      }
    default:
      return value;
  }
}

// ═══════════ 校验(写) ═══════════

export function validateConfigValue(
  type: ConfigType,
  value: string | null | undefined,
  options?: ConfigOptions,
): string[] {
  const errors: string[] = [];
  if (value === null || value === undefined || value === '') return errors;

  const opts = options ?? {};

  switch (type) {
    case 'NUMBER': {
      if (Number.isNaN(Number(value))) errors.push('必须是数字');
      else {
        const num = Number(value);
        if (opts.min !== undefined && num < opts.min)
          errors.push(`不能小于 ${opts.min}`);
        if (opts.max !== undefined && num > opts.max)
          errors.push(`不能大于 ${opts.max}`);
      }
      break;
    }
    case 'BOOLEAN':
      if (!['true', 'false', '1', '0'].includes(value))
        errors.push('必须是 true/false');
      break;
    case 'JSON':
      try {
        JSON.parse(value);
      } catch {
        errors.push('必须是合法的 JSON');
      }
      break;
    case 'ARRAY':
      try {
        if (!Array.isArray(JSON.parse(value))) errors.push('必须是数组');
      } catch {
        errors.push('必须是合法的 JSON 数组');
      }
      break;
    case 'EMAIL':
      if (!EMAIL_RE.test(value)) errors.push('邮箱格式不正确');
      break;
    case 'URL':
      if (!URL_RE.test(value)) errors.push('URL 格式不正确');
      break;
    default: {
      // STRING / FILE / PASSWORD:长度约束
      if (opts.min !== undefined && value.length < opts.min)
        errors.push(`长度不能小于 ${opts.min}`);
      if (opts.max !== undefined && value.length > opts.max)
        errors.push(`长度不能大于 ${opts.max}`);
    }
  }

  if (opts.pattern && !new RegExp(opts.pattern).test(value))
    errors.push('不符合格式要求');
  if (opts.enum?.length && !opts.enum.includes(value))
    errors.push(`只能是: ${opts.enum.join(' / ')}`);

  return errors;
}

// ═══════════ 序列化(写) ═══════════

export function serializeConfigValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value);
  // 对象统一 JSON 序列化;function/symbol 等兜底为空串
  return JSON.stringify(value) ?? '';
}

// ═══════════ 类型列表(前端控件映射见 SysConfigModal) ═══════════

export const CONFIG_TYPES: ConfigType[] = [
  'STRING',
  'NUMBER',
  'BOOLEAN',
  'JSON',
  'ARRAY',
  'FILE',
  'EMAIL',
  'URL',
  'PASSWORD',
];
