import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';
import { UpdateSysConfigDto } from './update-sys-config.dto';

// 同 UpdateUserWithIdDto：id 必须声明在 DTO 类内，避免交集类型使
// ValidationPipe 被整体绕过。
export class UpdateSysConfigWithIdDto extends UpdateSysConfigDto {
  @ApiProperty({ description: '配置ID' })
  @IsInt()
  @Min(1)
  id: number;
}
