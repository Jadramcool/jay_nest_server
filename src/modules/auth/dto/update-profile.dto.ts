import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsISO8601 } from 'class-validator';

/**
 * 当前用户（个人中心）资料更新 DTO。
 *
 * 注意:类名不能再叫 UpdateUserDto —— system/user 模块已有同名类，
 * 而 Swagger 是按类名生成 schema 的，重名会让其中一个被覆盖，
 * 前端 `typings/` 里生成的类型就会指向错误的契约。
 * 管理端用户更新走 system/user 的 UpdateUserWithIdDto。
 */
export class UpdateProfileDto {
  @ApiPropertyOptional({ description: '真实姓名' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: '手机号' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: '邮箱' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({
    description: '性别',
    enum: ['MALE', 'FEMALE', 'OTHER'],
  })
  @IsOptional()
  @IsString()
  sex?: string;

  @ApiPropertyOptional({ description: '头像 URL' })
  @IsOptional()
  @IsString()
  avatar?: string;

  @ApiPropertyOptional({ description: '生日' })
  @IsOptional()
  @IsISO8601({ strict: false })
  birthday?: string;

  @ApiPropertyOptional({ description: '城市' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ description: '地址' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ description: '详细地址' })
  @IsOptional()
  @IsString()
  addressDetail?: string;

  @ApiPropertyOptional({ description: '职位' })
  @IsOptional()
  @IsString()
  position?: string;
}
