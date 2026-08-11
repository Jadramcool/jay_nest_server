import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import {
  RequirePermissions,
  CurrentUser,
  OperationLog,
} from '@/common/decorators';
import { OperationType } from '@prisma/client';
import { NoticeService } from './notice.service';
import {
  CreateNoticeDto,
  UpdateNoticeWithIdDto,
  QueryNoticeDto,
  QueryNoticeReceiversDto,
  BatchRemoveDto,
} from './dto';

@ApiTags('公告管理')
@ApiBearerAuth()
@Controller('notice')
export class NoticeController {
  constructor(private readonly noticeService: NoticeService) {}

  @Get('list')
  @RequirePermissions('notice:list')
  @ApiOperation({ summary: '获取公告列表（分页）' })
  async findAll(@Query() queryNoticeDto: QueryNoticeDto) {
    return this.noticeService.findAll(queryNoticeDto);
  }

  // ============ 用户端接口（仅需 JWT 认证）============
  // 放在 :id 路由之前，避免被参数化路由捕获

  @Get('user/unread')
  @ApiOperation({ summary: '获取当前用户未读公告列表' })
  async findUnreadByUser(@CurrentUser() user: { userId: number }) {
    return this.noticeService.findUnreadByUser(user.userId);
  }

  @Put('user/read/:id')
  @ApiOperation({ summary: '标记公告为已读' })
  @HttpCode(HttpStatus.OK)
  async markAsRead(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { userId: number },
  ) {
    return this.noticeService.markAsRead(user.userId, id);
  }

  @Get(':id/receivers')
  @RequirePermissions('notice:list')
  @ApiOperation({ summary: '获取公告接收人列表' })
  async findReceivers(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: QueryNoticeReceiversDto,
  ) {
    return this.noticeService.findReceivers(id, query);
  }

  @Get(':id')
  @RequirePermissions('notice:list')
  @ApiOperation({ summary: '获取公告详情' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.noticeService.findOne(id);
  }

  @Post('create')
  @RequirePermissions('notice:create')
  @OperationLog({
    operationType: OperationType.CREATE,
    description: '新增公告',
  })
  @ApiOperation({ summary: '创建公告' })
  async create(
    @Body() createNoticeDto: CreateNoticeDto,
    @CurrentUser() user: { userId: number },
  ) {
    return this.noticeService.create(createNoticeDto, user.userId);
  }

  @Put('update')
  @RequirePermissions('notice:update')
  @OperationLog({
    operationType: OperationType.UPDATE,
    description: '编辑公告',
  })
  @ApiOperation({ summary: '更新公告' })
  async update(@Body() dto: UpdateNoticeWithIdDto) {
    const { id, ...data } = dto;
    return this.noticeService.update(id, data);
  }

  @Put('status/:id')
  @RequirePermissions('notice:publish')
  @OperationLog({
    operationType: OperationType.UPDATE,
    description: '发布/下刊公告',
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '切换公告发布状态' })
  async toggleStatus(@Param('id', ParseIntPipe) id: number) {
    return this.noticeService.toggleStatus(id);
  }

  @Put('pin/:id')
  @RequirePermissions('notice:update')
  @OperationLog({
    operationType: OperationType.UPDATE,
    description: '置顶/取消置顶公告',
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '切换公告置顶状态' })
  async togglePin(@Param('id', ParseIntPipe) id: number) {
    return this.noticeService.togglePin(id);
  }

  @Post('resend/:id')
  @RequirePermissions('notice:update')
  @OperationLog({
    operationType: OperationType.UPDATE,
    description: '重新推送公告',
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '重新推送公告至未读用户' })
  async resend(@Param('id', ParseIntPipe) id: number) {
    return this.noticeService.resend(id);
  }

  @Put('delete/:id')
  @RequirePermissions('notice:delete')
  @OperationLog({
    operationType: OperationType.DELETE,
    description: '删除公告',
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '删除公告' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.noticeService.remove(id);
  }

  @Put('batchDelete')
  @RequirePermissions('notice:delete')
  @OperationLog({
    operationType: OperationType.DELETE,
    description: '批量删除公告',
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '批量删除公告' })
  async batchRemove(@Body() dto: BatchRemoveDto) {
    return this.noticeService.batchRemove(dto.ids);
  }
}
