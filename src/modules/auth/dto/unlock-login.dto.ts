import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** 解除某账号的登录失败锁定 */
export class UnlockLoginDto {
  @ApiProperty({ description: '要解锁的用户名', example: 'zhangsan' })
  @IsString()
  @IsNotEmpty({ message: '用户名不能为空' })
  @MaxLength(50, { message: '用户名不能超过 50 个字符' })
  username: string;
}
