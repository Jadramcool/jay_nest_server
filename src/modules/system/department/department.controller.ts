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
import { DepartmentService } from './department.service';
import {
  CreateDepartmentDto,
  UpdateDepartmentDto,
  QueryDepartmentDto,
} from './dto';

@ApiTags('部门管理')
@ApiBearerAuth()
@Controller('system/department')
export class DepartmentController {
  constructor(private readonly departmentService: DepartmentService) {}

  @Get('list')
  @RequirePermissions('system:department:list')
  @ApiOperation({ summary: '获取部门列表' })
  async findAll(@Query() queryDepartmentDto: QueryDepartmentDto) {
    return this.departmentService.findAll(queryDepartmentDto);
  }

  @Get('tree')
  @RequirePermissions('system:department:list')
  @ApiOperation({ summary: '获取部门树' })
  async findTree() {
    return this.departmentService.findTree();
  }

  @Get('search')
  @RequirePermissions('system:department:list')
  @ApiOperation({ summary: '搜索部门' })
  async search(@Query('keyword') keyword: string) {
    return this.departmentService.search(keyword);
  }

  @Get('stats')
  @RequirePermissions('system:department:list')
  @ApiOperation({ summary: '获取部门统计信息' })
  async getStats() {
    return this.departmentService.getStats();
  }

  @Get('stats/:id')
  @RequirePermissions('system:department:list')
  @ApiOperation({ summary: '获取指定部门统计信息' })
  async getStatsById(@Param('id', ParseIntPipe) id: number) {
    return this.departmentService.getStats(id);
  }

  @Get('detail/:id')
  @RequirePermissions('system:department:list')
  @ApiOperation({ summary: '获取部门详情' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.departmentService.findOne(id);
  }

  @Get('members/:id')
  @RequirePermissions('system:department:list')
  @ApiOperation({ summary: '获取部门成员列表' })
  async getMembers(
    @Param('id', ParseIntPipe) id: number,
    @Query() query?: Record<string, unknown>,
  ) {
    return this.departmentService.getMembers(id, query);
  }

  @Post('create')
  @RequirePermissions('system:department:create')
  @ApiOperation({ summary: '创建部门' })
  async create(@Body() createDepartmentDto: CreateDepartmentDto) {
    return this.departmentService.create(createDepartmentDto);
  }

  @Put('update/:id')
  @RequirePermissions('system:department:update')
  @ApiOperation({ summary: '更新部门' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDepartmentDto: UpdateDepartmentDto,
  ) {
    return this.departmentService.update(id, updateDepartmentDto);
  }

  @Delete('delete/:id')
  @RequirePermissions('system:department:delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '删除部门' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.departmentService.remove(id);
  }

  @Post('assign-user')
  @RequirePermissions('system:department:assign-user')
  @HttpCode(HttpStatus.OK)
  @OperationLog({ operationType: OperationType.UPDATE, description: '分配用户到部门' })
  @ApiOperation({ summary: '分配用户到部门' })
  async assignUser(@Body() body: { userId: number; departmentId: number }) {
    return this.departmentService.assignUser(body.userId, body.departmentId);
  }

  @Post('batch-assign-users')
  @RequirePermissions('system:department:assign-user')
  @HttpCode(HttpStatus.OK)
  @OperationLog({ operationType: OperationType.UPDATE, description: '批量分配用户到部门' })
  @ApiOperation({ summary: '批量分配用户到部门' })
  async batchAssignUsers(
    @Body() body: { userIds: number[]; departmentId: number },
  ) {
    return this.departmentService.batchAssignUsers(
      body.userIds,
      body.departmentId,
    );
  }

  @Delete('remove-user')
  @RequirePermissions('system:department:assign-user')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '从部门移除用户' })
  async removeUser(@Body() body: { userId: number; departmentId: number }) {
    return this.departmentService.removeUser(body.userId, body.departmentId);
  }

  @Post('assign-role')
  @RequirePermissions('system:department:assign-role')
  @HttpCode(HttpStatus.OK)
  @OperationLog({ operationType: OperationType.UPDATE, description: '分配角色到部门' })
  @ApiOperation({ summary: '分配角色到部门' })
  async assignRole(@Body() body: { roleId: number; departmentId: number }) {
    return this.departmentService.assignRole(body.roleId, body.departmentId);
  }

  @Delete('remove-role')
  @RequirePermissions('system:department:assign-role')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '从部门移除角色' })
  async removeRole(@Body() body: { roleId: number; departmentId: number }) {
    return this.departmentService.removeRole(body.roleId, body.departmentId);
  }

  @Put('enable/:id')
  @RequirePermissions('system:department:update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '启用部门' })
  async enable(@Param('id', ParseIntPipe) id: number) {
    return this.departmentService.updateStatus(id, 1);
  }

  @Put('disable/:id')
  @RequirePermissions('system:department:update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '停用部门' })
  async disable(@Param('id', ParseIntPipe) id: number) {
    return this.departmentService.updateStatus(id, 0);
  }
}
