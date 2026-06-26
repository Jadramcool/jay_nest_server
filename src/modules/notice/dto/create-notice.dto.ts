import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsInt,
  IsEnum,
  IsBoolean,
  MaxLength,
  MinLength,
  IsArray,
  IsIn,
  ValidateIf,
  IsNotEmpty,
} from 'class-validator';
import { NoticeType } from '@prisma/client';

export class CreateNoticeDto {
  @ApiProperty({ description: '公告标题', example: '系统升级通知' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({ description: '公告内容（富文本HTML）' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiProperty({
    description: '公告类型',
    enum: NoticeType,
    example: NoticeType.NOTICE,
  })
  @IsEnum(NoticeType)
  type: NoticeType;

  @ApiPropertyOptional({ description: '状态 0-草稿 1-发布', default: 0 })
  @IsOptional()
  @IsInt()
  status?: number;

  @ApiPropertyOptional({ description: '是否置顶', default: false })
  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;

  @ApiPropertyOptional({ description: '是否强制阅读', default: false })
  @IsOptional()
  @IsBoolean()
  isMandatory?: boolean;

  @ApiPropertyOptional({
    description: '发布范围类型',
    default: 'ALL',
    enum: ['ALL', 'ROLE', 'DEPARTMENT', 'USER'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['ALL', 'ROLE', 'DEPARTMENT', 'USER'])
  scopeType?: string;

  @ApiPropertyOptional({
    description: '发布范围目标ID列表（scopeType不为ALL时必填）',
    example: [{ targetType: 'ROLE', targetId: 1 }],
  })
  @ValidateIf(
    (o: CreateNoticeDto) => o.scopeType !== undefined && o.scopeType !== 'ALL',
  )
  @IsNotEmpty()
  @IsArray()
  scopeTargets?: { targetType: string; targetId: number }[];
}
