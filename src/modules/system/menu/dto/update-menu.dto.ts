import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateMenuDto {
  @ApiProperty({ description: '菜单ID' })
  @Type(() => Number)
  @IsInt()
  id!: number;

  @ApiPropertyOptional({ description: '菜单名称' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name?: string;

  @ApiPropertyOptional({ description: '菜单编码' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  code?: string;

  @ApiPropertyOptional({ description: '菜单类型' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ description: '父菜单ID' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  pid?: number;

  @ApiPropertyOptional({ description: '路由路径' })
  @IsOptional()
  @IsString()
  path?: string;

  @ApiPropertyOptional({ description: '重定向路径' })
  @IsOptional()
  @IsString()
  redirect?: string;

  @ApiPropertyOptional({ description: '图标' })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional({ description: '组件路径' })
  @IsOptional()
  @IsString()
  component?: string;

  @ApiPropertyOptional({ description: '布局类型' })
  @IsOptional()
  @IsString()
  layout?: string;

  @ApiPropertyOptional({ description: '是否缓存页面' })
  @IsOptional()
  @IsBoolean()
  keepAlive?: boolean;

  @ApiPropertyOptional({ description: 'HTTP方法' })
  @IsOptional()
  @IsString()
  method?: string;

  @ApiPropertyOptional({ description: '描述' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: '是否显示' })
  @IsOptional()
  @IsBoolean()
  show?: boolean;

  @ApiPropertyOptional({ description: '是否启用' })
  @IsOptional()
  @IsBoolean()
  enable?: boolean;

  @ApiPropertyOptional({ description: '排序' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  order?: number;

  @ApiPropertyOptional({ description: '是否需要登录' })
  @IsOptional()
  @IsBoolean()
  needLogin?: boolean;

  @ApiPropertyOptional({ description: '额外数据' })
  @IsOptional()
  @IsString()
  extraData?: string;
}
