import { BadRequestException } from '@nestjs/common';
import type { SortOrder } from '../dto/sort-query.dto';
import type { SortQueryDto } from '../dto/sort-query.dto';

/**
 * 按白名单把排序参数映射为 Prisma orderBy。
 *
 * 用户传入的 sortField 绝不能直接进 orderBy：非白名单字段会让 Prisma 抛错
 * （500），也会把不该排序的列暴露出去。字段不在白名单内时显式 400，
 * 而不是静默退回默认排序——静默会让「排了但没生效」变成难查的问题。
 *
 * @param query    含 sortField / sortOrder 的查询 DTO
 * @param allowed  该接口允许排序的字段白名单
 * @param fallback 未传排序参数时的默认排序
 */
export function buildOrderBy<T extends string>(
  query: SortQueryDto,
  allowed: readonly T[],
  fallback: Record<string, SortOrder>,
): Record<string, SortOrder> {
  const { sortField, sortOrder } = query;
  if (!sortField || !sortOrder) return fallback;

  if (!(allowed as readonly string[]).includes(sortField)) {
    throw new BadRequestException(`不支持的排序字段：${sortField}`);
  }

  return { [sortField]: sortOrder };
}
