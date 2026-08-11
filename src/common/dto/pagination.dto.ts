import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsInt, Min, IsOptional } from 'class-validator';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export class PaginationDto {
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
