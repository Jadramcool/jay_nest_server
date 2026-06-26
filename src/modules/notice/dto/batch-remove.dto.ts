import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsInt } from 'class-validator';

export class BatchRemoveDto {
  @ApiProperty({ description: '公告ID列表', example: [1, 2, 3] })
  @IsArray()
  @IsInt({ each: true })
  ids: number[];
}
