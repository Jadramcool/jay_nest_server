import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class LoginDto {
  @ApiProperty({ description: '用户名', example: 'admin' })
  @IsString()
  @IsNotEmpty({ message: '用户名不能为空' })
  username: string;

  @ApiProperty({ description: '密码', example: '123456' })
  @IsString()
  @IsNotEmpty({ message: '密码不能为空' })
  password: string;

  @ApiProperty({ description: '验证码', required: false, example: 'abcd' })
  @IsString()
  @IsOptional()
  captcha?: string;

  @ApiProperty({ description: '验证码ID', required: false })
  @IsString()
  @IsOptional()
  captchaId?: string;
}
