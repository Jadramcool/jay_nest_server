import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';
import { UpdateRoleDto } from './update-role.dto';

// 同 UpdateUserWithIdDto：id 必须声明在 DTO 类内，避免交集类型使
// ValidationPipe 被整体绕过（isSystem 提权漏洞的根因）。
export class UpdateRoleWithIdDto extends UpdateRoleDto {
  @ApiProperty({ description: '角色ID' })
  @IsInt()
  @Min(1)
  id: number;
}
