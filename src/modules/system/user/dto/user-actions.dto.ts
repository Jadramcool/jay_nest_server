import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateUserStatusDto {
  @ApiProperty({ description: '用户状态', enum: [0, 1] })
  @IsIn([0, 1])
  status: number;
}

export class AssignUserRolesDto {
  @ApiProperty({ description: '角色ID列表', type: [Number] })
  @IsArray()
  @ArrayMaxSize(100)
  @IsInt({ each: true })
  @Min(1, { each: true })
  roleIds: number[];
}

export class ResetUserPasswordDto {
  @ApiProperty({ description: '新密码' })
  @MinLength(6)
  @MaxLength(20)
  newPassword: string;
}

/** operation-log clearExpired 复用：days 必须为正整数，防止负数清空全部审计日志 */
export class ClearExpiredDaysDto {
  @ApiPropertyOptional({ description: '保留天数', default: 90 })
  @IsOptional()
  @IsInt()
  @Min(1)
  days: number = 90;
}
