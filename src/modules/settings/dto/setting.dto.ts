import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDefined,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateSettingDto {
  @ApiProperty({
    description: '设置值(具体类型由注册表声明决定:字符串/数字/布尔/对象/数组)',
    oneOf: [
      { type: 'string' },
      { type: 'number' },
      { type: 'boolean' },
      { type: 'object', additionalProperties: true },
      { type: 'array', items: {} },
    ],
    example: 'Jay Admin',
  })
  @IsDefined()
  value: unknown;

  @ApiPropertyOptional({
    description: '期望版本号(乐观锁);与当前版本不一致返回 409',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion?: number;

  @ApiPropertyOptional({ description: '变更原因(写入历史)' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}

export class ResetSettingDto {
  @ApiPropertyOptional({ description: '期望版本号(乐观锁)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion?: number;

  @ApiPropertyOptional({ description: '重置原因(写入历史)' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}

export class RollbackSettingDto {
  @ApiProperty({
    description: '要回滚的版本号(取自变更历史);回滚后恢复该版本变更前的值',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version: number;

  @ApiPropertyOptional({ description: '回滚原因' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}

export class QuerySettingsDto {
  @ApiPropertyOptional({ description: '按分组过滤,如 站点 / 安全' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  group?: string;
}
