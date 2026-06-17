import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsInt,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateDepartmentDto {
  @ApiProperty({ description: '部门名称' })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name: string;

  @ApiProperty({ description: '部门编码' })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  code: string;

  @ApiPropertyOptional({ description: '部门描述' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: '排序', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({ description: '部门状态 0-禁用 1-启用', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  status?: number;

  @ApiPropertyOptional({ description: '部门经理ID' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  managerId?: number;

  @ApiPropertyOptional({ description: '父部门ID' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  parentId?: number;
}
