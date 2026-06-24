import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  IsArray,
  IsIn,
  MaxLength,
} from 'class-validator';
import { NoticeType } from '@prisma/client';

export class UpdateNoticeDto {
  @ApiPropertyOptional({ description: '公告标题' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ description: '公告内容（富文本HTML）' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ description: '公告类型', enum: NoticeType })
  @IsOptional()
  @IsString()
  type?: NoticeType;

  @ApiPropertyOptional({ description: '状态 0-草稿 1-发布' })
  @IsOptional()
  @IsInt()
  status?: number;

  @ApiPropertyOptional({ description: '是否置顶' })
  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;

  @ApiPropertyOptional({ description: '是否强制阅读' })
  @IsOptional()
  @IsBoolean()
  isMandatory?: boolean;

  @ApiPropertyOptional({
    description: '发布范围类型',
    enum: ['ALL', 'ROLE', 'DEPARTMENT', 'USER'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['ALL', 'ROLE', 'DEPARTMENT', 'USER'])
  scopeType?: string;

  @ApiPropertyOptional({
    description: '发布范围目标ID列表',
  })
  @IsOptional()
  @IsArray()
  scopeTargets?: { targetType: string; targetId: number }[];
}
