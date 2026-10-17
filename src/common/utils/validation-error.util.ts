import { BadRequestException } from '@nestjs/common';
import type { ValidationError } from 'class-validator';

export interface FieldError {
  field: string;
  message: string;
}

/** class-validator 的英文约束名 → 中文提示（入参为字段路径） */
const CONSTRAINT_MESSAGES: Record<string, (field: string) => string> = {
  whitelistValidation: (field) => `不支持的字段 ${field}`,
  isDefined: (field) => `${field} 不能为空`,
  isNotEmpty: (field) => `${field} 不能为空`,
  isString: (field) => `${field} 必须是字符串`,
  isInt: (field) => `${field} 必须是整数`,
  isNumber: (field) => `${field} 必须是数字`,
  isBoolean: (field) => `${field} 必须是布尔值`,
  isArray: (field) => `${field} 必须是数组`,
  arrayNotEmpty: (field) => `${field} 不能为空数组`,
  isEnum: (field) => `${field} 取值不在允许范围内`,
  isIn: (field) => `${field} 取值不在允许范围内`,
  minLength: (field) => `${field} 长度不足`,
  maxLength: (field) => `${field} 长度超出限制`,
  min: (field) => `${field} 小于允许的最小值`,
  max: (field) => `${field} 大于允许的最大值`,
  isEmail: (field) => `${field} 必须是合法邮箱`,
  isUrl: (field) => `${field} 必须是合法链接`,
  isDateString: (field) => `${field} 必须是合法日期`,
  isObject: (field) => `${field} 必须是对象`,
};

/** 拼进 message 的字段错误条数上限，避免长表单把提示撑爆 */
const MAX_MESSAGE_ITEMS = 3;

/** 展平嵌套 ValidationError，子级带上父级路径 */
export function flattenValidationErrors(
  errors: ValidationError[],
  parent = '',
): FieldError[] {
  return errors.flatMap((error) => {
    const path = parent ? `${parent}.${error.property}` : error.property;
    const own = Object.keys(error.constraints ?? {}).map((key) => {
      const translate = CONSTRAINT_MESSAGES[key];
      return {
        field: path,
        message: translate ? translate(path) : `${path} 校验未通过`,
      };
    });
    const children = error.children?.length
      ? flattenValidationErrors(error.children, path)
      : [];
    return [...own, ...children];
  });
}

/**
 * 统一构造带 fieldErrors 的 400。
 *
 * 全局 ValidationPipe 的 exceptionFactory 与 @QueryWithOps 共用同一份实现，
 * 保证前端拿到的 `{ message, errMsg, fieldErrors }` 形状一致——前端
 * ErrorResponse 契约里本来就有 fieldErrors，之前后端只往 data 里塞字符串数组，
 * 导致界面只能显示「参数验证失败」。
 */
export function buildValidationException(
  errors: ValidationError[],
): BadRequestException {
  const fieldErrors = flattenValidationErrors(errors);
  const shown = fieldErrors.slice(0, MAX_MESSAGE_ITEMS).map((e) => e.message);
  const rest = fieldErrors.length - shown.length;
  const message = fieldErrors.length
    ? `参数验证失败：${shown.join('；')}${rest > 0 ? ` 等 ${fieldErrors.length} 项` : ''}`
    : '参数验证失败';

  return new BadRequestException({
    message,
    errorCode: 'VALIDATION_FAILED',
    fieldErrors,
  });
}
