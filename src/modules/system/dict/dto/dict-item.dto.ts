import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsInt,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateDictItemDto {
  @ApiProperty({ description: '所属字典类型ID' })
  @IsInt()
  typeId: number;

  @ApiProperty({ description: '字典项编码(值)', example: 'MALE' })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  code: string;

  @ApiProperty({ description: '显示文本', example: '男' })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  label: string;

  @ApiPropertyOptional({ description: '排序', default: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({ description: '状态 0-禁用 1-启用', default: 1 })
  @IsOptional()
  @IsInt()
  status?: number;
}

export class UpdateDictItemDto {
  @ApiProperty({ description: '字典项ID' })
  @IsInt()
  id: number;

  @ApiPropertyOptional({ description: '字典项编码' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  code?: string;

  @ApiPropertyOptional({ description: '显示文本' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  label?: string;

  @ApiPropertyOptional({ description: '排序' })
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({ description: '状态 0-禁用 1-启用' })
  @IsOptional()
  @IsInt()
  status?: number;
}

export class QueryDictItemDto {
  @ApiPropertyOptional({ description: '页码', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page?: number = 1;

  @ApiPropertyOptional({ description: '每页数量', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  pageSize?: number = 20;

  @ApiPropertyOptional({ description: '字典类型ID' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  typeId?: number;

  @ApiPropertyOptional({ description: '字典类型编码' })
  @IsOptional()
  @IsString()
  typeCode?: string;

  @ApiPropertyOptional({ description: '项编码或文本(模糊)' })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({ description: '状态' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  status?: number;
}
