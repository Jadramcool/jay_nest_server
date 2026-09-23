import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RequirePermissions } from '@/common/decorators';
import { PermissionService } from './permission.service';

@ApiTags('功能权限')
@ApiBearerAuth()
@Controller('system/permission')
export class PermissionController {
  constructor(private readonly permissionService: PermissionService) {}

  @Get('list')
  @RequirePermissions({ code: 'system:role:list', name: '查询角色' })
  @ApiOperation({ summary: '获取功能权限列表（按模块分组）' })
  async findGrouped() {
    return this.permissionService.findAllGrouped();
  }

  @Get('role/:roleId')
  @RequirePermissions({ code: 'system:role:list', name: '查询角色' })
  @ApiOperation({ summary: '获取角色已分配的功能权限ID列表' })
  async findPermissionIdsByRole(
    @Param('roleId', ParseIntPipe) roleId: number,
  ) {
    return this.permissionService.findPermissionIdsByRole(roleId);
  }
}
