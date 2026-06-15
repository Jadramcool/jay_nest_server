import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class CheckPasswordDto {
  @ApiProperty({ description: '待验证的密码', example: '123456' })
  @IsString()
  password: string;
}
