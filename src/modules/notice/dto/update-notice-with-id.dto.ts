import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';
import { UpdateNoticeDto } from './update-notice.dto';

export class UpdateNoticeWithIdDto extends UpdateNoticeDto {
  @ApiProperty({ description: '公告ID' })
  @IsInt()
  @Min(1)
  id: number;
}
