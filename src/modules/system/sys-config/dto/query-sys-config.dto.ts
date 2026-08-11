import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsBoolean, IsEnum } from 'class-validator';
import { ConfigType } from '@prisma/client';
import { PaginationDto } from '@/common/dto/pagination.dto';

export class QuerySysConfigDto extends PaginationDto {
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
