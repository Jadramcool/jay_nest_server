import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { PaginationDto } from '@/common/dto/pagination.dto';

export class QueryNoticeReceiversDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ['read', 'unread'], description: '阅读状态' })
  @IsOptional()
  @IsIn(['read', 'unread'])
  readStatus?: 'read' | 'unread';
}
