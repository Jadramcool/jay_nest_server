import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  Matches,
  MinLength,
  MaxLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ description: '用户名', example: 'user123' })
  @IsString()
  @IsNotEmpty({ message: '用户名不能为空' })
  @MinLength(4, { message: '用户名至少4个字符' })
  @MaxLength(20, { message: '用户名最多20个字符' })
  @Matches(/^[a-zA-Z0-9_]+$/, { message: '用户名只能包含字母、数字和下划线' })
  username: string;

  @ApiProperty({ description: '密码', example: '123456' })
  @IsString()
  @IsNotEmpty({ message: '密码不能为空' })
  @MinLength(8, { message: '密码至少8个字符' })
  @MaxLength(32, { message: '密码最多32个字符' })
  password: string;

  @ApiProperty({ description: '确认密码', example: '123456' })
  @IsString()
  @IsNotEmpty({ message: '确认密码不能为空' })
  confirmPassword: string;

  @ApiProperty({
    description: '手机号',
    required: false,
    example: '13800138000',
  })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({
    description: '邮箱',
    required: false,
    example: 'user@example.com',
  })
  @IsEmail({}, { message: '邮箱格式不正确' })
  @IsOptional()
  email?: string;
}
