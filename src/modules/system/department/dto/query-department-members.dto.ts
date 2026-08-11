import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { PaginationDto } from '@/common/dto/pagination.dto';

export class QueryDepartmentMembersDto extends PaginationDto {
  @ApiProperty({ description: '部门 ID' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  departmentId!: number;

  @ApiPropertyOptional({ description: '是否包含子部门成员' })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  includeChildren?: boolean = false;

  @ApiPropertyOptional({ description: '用户名或姓名关键字' })
  @IsOptional()
  @IsString()
  keyword?: string;
}
