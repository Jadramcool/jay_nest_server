import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ConfigType } from '@prisma/client';

export class UpdateSysConfigDto {
  @ApiPropertyOptional({ description: '配置名称' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: '配置键' })
  @IsOptional()
  @IsString()
  key?: string;

  @ApiPropertyOptional({ description: '配置值' })
  @IsOptional()
  @IsString()
  value?: string;

  @ApiPropertyOptional({ description: '配置类型', enum: ConfigType })
  @IsOptional()
  @IsEnum(ConfigType)
  type?: ConfigType;

  @ApiPropertyOptional({ description: '配置描述' })
  @IsOptional()
  @IsString()
  description?: string;

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

  @ApiPropertyOptional({ description: '排序' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;
}
