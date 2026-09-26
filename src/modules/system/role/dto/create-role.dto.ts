import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength, MinLength } from 'class-validator';

export class CreateRoleDto {
  @ApiProperty({ description: '角色编码', example: 'admin' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  code: string;

  @ApiProperty({ description: '角色名称', example: '管理员' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({
    description: '所属端: admin | app | mp | common（缺省 admin）',
    example: 'app',
    default: 'admin',
  })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  platform?: string;

  @ApiPropertyOptional({ description: '角色描述' })
  @IsOptional()
  @IsString()
  description?: string;
}
