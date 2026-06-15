import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsInt,
  IsString,
  IsBoolean,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ConfigType } from '@prisma/client';

export class QuerySysConfigDto {
  @ApiPropertyOptional({ description: '页码', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page?: number = 1;

  @ApiPropertyOptional({ description: '每页数量', example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  pageSize?: number = 10;

  @ApiPropertyOptional({ description: '配置名称' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: '配置键' })
  @IsOptional()
  @IsString()
  key?: string;

  @ApiPropertyOptional({ description: '配置类型', enum: ConfigType })
  @IsOptional()
  @IsEnum(ConfigType)
  type?: ConfigType;

  @ApiPropertyOptional({ description: '配置分类' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: '是否公开配置' })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @ApiPropertyOptional({ description: '是否系统配置' })
  @IsOptional()
  @IsBoolean()
  isSystem?: boolean;
}
