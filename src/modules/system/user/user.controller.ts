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
  BadRequestException,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RequirePermissions, OperationLog } from '@/common/decorators';
import { OperationType } from '@prisma/client';
import { QueryWithOps } from '@/common/decorators/query-with-ops.decorator';
import { UserService } from './user.service';
import { CreateUserDto, UpdateUserDto, QueryUserDto } from './dto';
import {
  buildUserExportWorkbook,
  buildUserImportTemplateWorkbook,
} from './excel.util';

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

  @Post('roles/:id')
  @RequirePermissions('system:user:assign-role')
  @HttpCode(HttpStatus.OK)
  @OperationLog({
    operationType: OperationType.UPDATE,
    description: '分配用户角色',
  })
  @ApiOperation({ summary: '分配用户角色' })
  async assignRoles(
    @Param('id', ParseIntPipe) id: number,
    @Body('roleIds') roleIds: number[],
  ) {
    return this.userService.assignRoles(id, roleIds);
  }

  @Post('reset-password/:id')
  @RequirePermissions('system:user:reset-password')
  @HttpCode(HttpStatus.OK)
  @OperationLog({
    operationType: OperationType.UPDATE,
    description: '重置用户密码',
  })
  @ApiOperation({ summary: '重置用户密码' })
  async resetPassword(
    @Param('id', ParseIntPipe) id: number,
    @Body('newPassword') newPassword: string,
  ) {
    return this.userService.resetPassword(id, newPassword);
  }

  // ═══════════ Excel 导入导出 ═══════════

  @Get('export')
  @RequirePermissions('system:user:list')
  @OperationLog({
    operationType: OperationType.EXPORT,
    description: '导出用户列表',
  })
  @ApiOperation({ summary: '导出用户列表(Excel)' })
  async exportUsers(
    @QueryWithOps(QueryUserDto) queryUserDto: QueryUserDto,
    @Res() res: Response,
  ) {
    const rows = await this.userService.exportUsers(queryUserDto);
    const workbook = buildUserExportWorkbook(rows);
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="users-${Date.now()}.xlsx"`,
    });
    await workbook.xlsx.write(res);
    res.end();
  }

  @Get('import/template')
  @RequirePermissions('system:user:create')
  @OperationLog({
    operationType: OperationType.EXPORT,
    description: '下载用户导入模板',
  })
  @ApiOperation({ summary: '下载用户导入模板' })
  async downloadImportTemplate(@Res() res: Response) {
    const workbook = buildUserImportTemplateWorkbook();
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="user-import-template.xlsx"',
    });
    await workbook.xlsx.write(res);
    res.end();
  }

  @Post('import')
  @RequirePermissions('system:user:create')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  @OperationLog({
    operationType: OperationType.IMPORT,
    description: '导入用户',
  })
  @ApiOperation({ summary: '导入用户(Excel)' })
  async importUsers(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('请选择要导入的文件');
    }
    return this.userService.importUsers(file.buffer);
  }
}
