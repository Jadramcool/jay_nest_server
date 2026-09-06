import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsInt, Min } from 'class-validator';

/** 通用批量 ID 入参（供各模块 batchDelete 等散装 @Body 复用） */
export class BatchIdsDto {
  @ApiProperty({ description: 'ID 列表', type: [Number] })
  @IsArray()
  @ArrayMaxSize(1000)
  @IsInt({ each: true })
  @Min(1, { each: true })
  ids: number[];
}
