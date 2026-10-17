import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsInt, Min, IsOptional } from 'class-validator';
import { SortQueryDto } from './sort-query.dto';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/**
 * 分页查询基类。
 *
 * 继承 SortQueryDto：所有分页列表接口都接受 sortField / sortOrder
 * （前端 BasicTable 在 remote 模式下排序会带上），是否真的支持排序
 * 由各 service 的 buildOrderBy 白名单决定。
 */
export class PaginationDto extends SortQueryDto {
  @ApiProperty({
    description: '页码',
    example: 1,
    required: false,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    description: '每页数量',
    example: DEFAULT_PAGE_SIZE,
    required: false,
    minimum: 1,
  })
  @IsOptional()
  @Transform(({ value }) =>
    Math.min(Number(value ?? DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE),
  )
  @IsInt()
  @Min(1)
  pageSize?: number = DEFAULT_PAGE_SIZE;
}
