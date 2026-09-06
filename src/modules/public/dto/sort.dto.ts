import { IsString, IsOptional, IsInt, IsIn, Min } from 'class-validator';

export class SortDto {
  @IsString()
  tableName: string;

  @IsInt()
  @Min(1)
  id: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  targetId?: number;

  @IsOptional()
  @IsIn(['before', 'after', 'first', 'last'])
  position?: 'before' | 'after' | 'first' | 'last';

  @IsOptional()
  @IsString()
  parentIdField?: string;

  @IsOptional()
  @IsInt()
  parentId?: number;
}

export class ResetSortDto {
  @IsString()
  tableName: string;

  // 层级表必填（service 校验），平表不传；用于限定重置范围
  @IsOptional()
  @IsString()
  parentIdField?: string;

  @IsOptional()
  @IsInt()
  parentId?: number;
}
