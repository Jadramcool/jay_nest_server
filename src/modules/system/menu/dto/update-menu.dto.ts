import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  MaxLength,
  MinLength,
  IsEnum,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MenuType } from '@prisma/client';

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

  @ApiPropertyOptional({ description: '路由标识' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  code?: string;

  @ApiPropertyOptional({ description: '权限标识' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  permission?: string;

  @ApiPropertyOptional({ description: '菜单类型', enum: MenuType })
  @IsOptional()
  @IsEnum(MenuType)
  type?: MenuType;

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

  @ApiPropertyOptional({ description: '是否外部链接' })
  @IsOptional()
  @IsBoolean()
  isFrame?: boolean;

  @ApiPropertyOptional({ description: '外部链接地址' })
  @IsOptional()
  @IsString()
  frameSrc?: string;

  @ApiPropertyOptional({ description: '打开方式' })
  @IsOptional()
  @IsString()
  target?: string;

  @ApiPropertyOptional({ description: '是否固定标签页' })
  @IsOptional()
  @IsBoolean()
  affix?: boolean;

  @ApiPropertyOptional({ description: '目录是否始终显示' })
  @IsOptional()
  @IsBoolean()
  alwaysShow?: boolean;

  @ApiPropertyOptional({ description: '徽标内容' })
  @IsOptional()
  @IsString()
  badge?: string;

  @ApiPropertyOptional({ description: '徽标类型' })
  @IsOptional()
  @IsString()
  badgeType?: string;

  @ApiPropertyOptional({ description: '是否需要登录' })
  @IsOptional()
  @IsBoolean()
  needLogin?: boolean;

  @ApiPropertyOptional({ description: '额外数据（JSON 对象）' })
  @IsOptional()
  @IsObject()
  extraData?: Record<string, any>;
}
