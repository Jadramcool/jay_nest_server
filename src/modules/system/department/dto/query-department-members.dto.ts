import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { QueryBoolean } from '@/common/decorators';
import { PaginationDto } from '@/common/dto/pagination.dto';

export class QueryDepartmentMembersDto extends PaginationDto {
  @ApiProperty({ description: '部门 ID' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  departmentId!: number;

  @ApiPropertyOptional({ description: '是否包含子部门成员' })
  @QueryBoolean()
  includeChildren?: boolean = false;

  @ApiPropertyOptional({ description: '用户名或姓名关键字' })
  @IsOptional()
  @IsString()
  keyword?: string;
}
