import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export type SortOrder = 'asc' | 'desc';

/**
 * 列表排序参数契约。
 *
 * PaginationDto 继承它，因此所有分页列表接口都能安全接收
 * sortField / sortOrder（前端 BasicTable 在 remote 模式下排序时会带上）。
 * 具体哪些字段可排序由各 service 的白名单决定，见 buildOrderBy。
 */
export class SortQueryDto {
  @ApiPropertyOptional({ description: '排序字段' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  sortField?: string;

  @ApiPropertyOptional({ description: '排序方向', enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: SortOrder;
}
