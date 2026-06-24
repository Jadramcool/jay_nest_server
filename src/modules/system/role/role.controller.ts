import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RequirePermissions, OperationLog } from '@/common/decorators';
import { OperationType } from '@prisma/client';
import { RoleService } from './role.service';
import { CreateRoleDto, UpdateRoleDto, QueryRoleDto } from './dto';

@ApiTags('角色管理')
@ApiBearerAuth()
@Controller('system/role')
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Get('list')
  @RequirePermissions('system:role:list')
  @ApiOperation({ summary: '获取角色列表（分页）' })
  async findAll(@Query() queryRoleDto: QueryRoleDto) {
    return this.roleService.findAll(queryRoleDto);
  }

  @Get('all')
  @RequirePermissions('system:role:list')
  @ApiOperation({ summary: '获取所有角色（不分页）' })
  async findAllSimple() {
    return this.roleService.findAllSimple();
  }

  @Get(':id')
  @RequirePermissions('system:role:list')
  @ApiOperation({ summary: '获取角色详情（含菜单权限）' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.roleService.findOne(id);
  }

  @Post('create')
  @RequirePermissions('system:role:create')
  @ApiOperation({ summary: '创建角色' })
  async create(@Body() createRoleDto: CreateRoleDto) {
    return this.roleService.create(createRoleDto);
  }

  @Put('update')
  @RequirePermissions('system:role:update')
  @ApiOperation({ summary: '更新角色' })
  async update(@Body() updateRoleDto: UpdateRoleDto & { id: number }) {
    const { id, ...data } = updateRoleDto;
    return this.roleService.update(id, data);
  }

  @Delete('delete/:id')
  @RequirePermissions('system:role:delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '删除角色' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.roleService.remove(id);
  }

  @Post('update/menu')
  @RequirePermissions('system:role:assign-menu')
  @HttpCode(HttpStatus.OK)
  @OperationLog({ operationType: OperationType.UPDATE, description: '分配角色菜单权限' })
  @ApiOperation({ summary: '分配角色菜单权限' })
  async assignMenus(@Body() body: { roleId: number; menuIds: number[] }) {
    return this.roleService.assignMenus(body.roleId, body.menuIds);
  }
}
