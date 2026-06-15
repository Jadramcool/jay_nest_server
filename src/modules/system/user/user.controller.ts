import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RequirePermissions } from '@/common/decorators';
import { QueryWithOps } from '@/common/decorators/query-with-ops.decorator';
import { UserService } from './user.service';
import { CreateUserDto, UpdateUserDto, QueryUserDto } from './dto';

@ApiTags('用户管理')
@ApiBearerAuth()
@Controller('system/user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('list')
  @RequirePermissions('system:user:list')
  @ApiOperation({ summary: '获取用户列表' })
  async findAll(@QueryWithOps(QueryUserDto) queryUserDto: QueryUserDto) {
    return this.userService.findAll(queryUserDto);
  }

  @Get('detail/:id')
  @RequirePermissions('system:user:list')
  @ApiOperation({ summary: '获取用户详情' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.userService.findOne(id);
  }

  @Post('create')
  @RequirePermissions('system:user:create')
  @ApiOperation({ summary: '创建用户' })
  async create(@Body() createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto);
  }

  @Put('update')
  @RequirePermissions('system:user:update')
  @ApiOperation({ summary: '更新用户' })
  async update(@Body() updateUserDto: UpdateUserDto & { id: number }) {
    const { id, ...data } = updateUserDto;
    return this.userService.update(id, data);
  }

  @Put('delete/:id')
  @RequirePermissions('system:user:delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '删除用户' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.userService.remove(id);
  }

  @Put('batchDelete')
  @RequirePermissions('system:user:delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '批量删除用户' })
  async batchRemove(@Body('ids') ids: number[]) {
    return this.userService.batchRemove(ids);
  }

  @Put('status/:id')
  @RequirePermissions('system:user:update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '启用/禁用用户' })
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body('status') status: number,
  ) {
    return this.userService.updateStatus(id, status);
  }

  @Post(':id/roles')
  @RequirePermissions('system:user:assign-role')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '分配用户角色' })
  async assignRoles(
    @Param('id', ParseIntPipe) id: number,
    @Body('roleIds') roleIds: number[],
  ) {
    return this.userService.assignRoles(id, roleIds);
  }

  @Post(':id/reset-password')
  @RequirePermissions('system:user:reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '重置用户密码' })
  async resetPassword(
    @Param('id', ParseIntPipe) id: number,
    @Body('newPassword') newPassword: string,
  ) {
    return this.userService.resetPassword(id, newPassword);
  }
}
