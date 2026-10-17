import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { QueryBoolean } from '@/common/decorators';
import { PaginationDto } from '@/common/dto/pagination.dto';

export class QueryDepartmentDto extends PaginationDto {
  @ApiPropertyOptional({ description: '部门名称' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: '部门编码' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ description: '部门状态' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  status?: number;

  @ApiPropertyOptional({ description: '父部门ID' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  parentId?: number;

  @ApiPropertyOptional({ description: '是否包含已删除部门' })
  @QueryBoolean()
  includeDeleted?: boolean = false;
}
