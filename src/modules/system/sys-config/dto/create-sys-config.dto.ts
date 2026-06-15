import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  IsEnum,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ConfigType } from '@prisma/client';

export class CreateSysConfigDto {
  @ApiProperty({ description: '配置名称' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @ApiProperty({ description: '配置键' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  key: string;

  @ApiProperty({ description: '配置值' })
  @IsString()
  value: string;

  @ApiPropertyOptional({
    description: '配置类型',
    enum: ConfigType,
    default: ConfigType.STRING,
  })
  @IsOptional()
  @IsEnum(ConfigType)
  type?: ConfigType;

  @ApiPropertyOptional({ description: '配置描述' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: '配置分类', default: 'SYSTEM' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: '是否公开配置', default: false })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @ApiPropertyOptional({ description: '是否系统配置', default: false })
  @IsOptional()
  @IsBoolean()
  isSystem?: boolean;

  @ApiPropertyOptional({ description: '排序', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;
}
