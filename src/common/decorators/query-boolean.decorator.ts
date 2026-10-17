import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

/**
 * 查询参数布尔装饰器。
 *
 * 查询串里的值永远是字符串，而全局 ValidationPipe 打开了
 * enableImplicitConversion，class-transformer 对 Boolean 目标类型会先执行
 * `Boolean(value)`（'false' / '0' 都会变成 true），**再**调用自定义转换器，
 * 此时 value 已经被污染成 true。
 *
 * 因此这里必须读原始入参 obj[key]，不能读 value
 * （同一个坑见 report.dto.ts 的 to_pdf 字段）。
 *
 * @example
 *   @QueryBoolean() isPublic?: boolean;
 *   @QueryBoolean() includeDeleted?: boolean = false;
 */
export function QueryBoolean(): PropertyDecorator {
  return applyDecorators(
    IsOptional(),
    Transform(({ obj, key }) => {
      const raw = (obj as Record<string, unknown> | undefined)?.[key];
      return raw === true || raw === 'true' || raw === 1 || raw === '1';
    }),
    IsBoolean(),
  );
}
