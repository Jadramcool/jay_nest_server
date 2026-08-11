import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, IsString, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { NoticeType } from '@prisma/client';
import { PaginationDto } from '@/common/dto/pagination.dto';

export class QueryNoticeDto extends PaginationDto {
  @ApiPropertyOptional({ description: '公告标题（模糊搜索）' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: '公告类型', enum: NoticeType })
  @IsOptional()
  @IsEnum(NoticeType)
  type?: NoticeType;

  @ApiPropertyOptional({ description: '状态 0-草稿 1-发布' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  status?: number;
}
