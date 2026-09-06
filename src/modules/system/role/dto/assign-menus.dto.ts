import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsInt, Min } from 'class-validator';

export class AssignRoleMenusDto {
  @ApiProperty({ description: '角色ID' })
  @IsInt()
  @Min(1)
  roleId: number;

  @ApiProperty({ description: '菜单ID列表', type: [Number] })
  @IsArray()
  @ArrayMaxSize(500)
  @IsInt({ each: true })
  @Min(1, { each: true })
  menuIds: number[];
}
