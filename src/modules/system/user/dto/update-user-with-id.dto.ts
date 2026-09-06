import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';
import { UpdateUserDto } from './update-user.dto';

// id 必须声明在 DTO 类内：控制器参数若写成 `UpdateUserDto & { id: number }`
// 交集类型，TS 发射的 design:paramtypes 是 Object，全局 ValidationPipe 会
// 整体跳过该校验（导致无 whitelist、可 mass assignment）。
export class UpdateUserWithIdDto extends UpdateUserDto {
  @ApiProperty({ description: '用户ID' })
  @IsInt()
  @Min(1)
  id: number;
}
