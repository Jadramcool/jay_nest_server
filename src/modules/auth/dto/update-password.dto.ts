import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class UpdatePasswordDto {
  @ApiProperty({ description: '原密码', example: '123456' })
  @IsString()
  oldPassword: string;

  @ApiProperty({ description: '新密码', example: 'newpassword123' })
  @IsString()
  @MinLength(6)
  newPassword: string;
}
