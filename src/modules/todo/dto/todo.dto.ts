import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsInt,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTodoDto {
  @ApiProperty({ description: '待办标题', example: '完成周报' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({ description: '待办内容' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  content?: string;

  @ApiPropertyOptional({ description: '父待办ID(子任务)' })
  @IsOptional()
  @IsInt()
  pid?: number;

  @ApiPropertyOptional({ description: '排序' })
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateTodoDto {
  @ApiProperty({ description: '待办ID' })
  @IsInt()
  id: number;

  @ApiPropertyOptional({ description: '待办标题' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ description: '待办内容' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  content?: string;

  @ApiPropertyOptional({ description: '父待办ID(子任务)' })
  @IsOptional()
  @IsInt()
  pid?: number;

  @ApiPropertyOptional({ description: '排序' })
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class QueryTodoDto {
  @ApiPropertyOptional({ description: '是否只查未完成', default: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  onlyUndone?: number;

  @ApiPropertyOptional({ description: '标题关键字' })
  @IsOptional()
  @IsString()
  keyword?: string;
}
