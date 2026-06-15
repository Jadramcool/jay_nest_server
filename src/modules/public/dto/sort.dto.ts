import { IsString, IsOptional, IsInt } from 'class-validator';

export class SortDto {
  @IsString()
  tableName: string;

  @IsInt()
  id: number;

  @IsOptional()
  @IsString()
  targetId?: string;

  @IsOptional()
  @IsString()
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

  @IsOptional()
  @IsString()
  parentIdField?: string;

  @IsOptional()
  @IsInt()
  parentId?: number;

  @IsOptional()
  filter?: Record<string, unknown>;
}
