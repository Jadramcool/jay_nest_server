import {
  Controller,
  Get,
  Delete,
  Post,
  Param,
  Query,
  Body,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OperationType } from '@prisma/client';
import { RequirePermissions, OperationLog } from '@/common/decorators';
import { OperationLogService } from './operation-log.service';
import { QueryOperationLogDto } from './dto';
import { BatchIdsDto } from '@/common/dto';
import { ClearExpiredDaysDto } from '@/modules/system/user/dto/user-actions.dto';

@ApiTags('操作日志')
@ApiBearerAuth()
@Controller('system/operation-log')
export class OperationLogController {
  constructor(private readonly operationLogService: OperationLogService) {}

  @Get('list')
  @RequirePermissions({ code: 'system:operation-log:list', name: '查询操作日志' })
  @ApiOperation({ summary: '获取操作日志列表' })
  async findAll(@Query() queryDto: QueryOperationLogDto) {
    return this.operationLogService.findAll(queryDto);
  }

  @Get('detail/:id')
  @RequirePermissions({ code: 'system:operation-log:list', name: '查询操作日志' })
  @ApiOperation({ summary: '获取操作日志详情' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.operationLogService.findOne(id);
  }

  @Get('stats')
  @RequirePermissions({ code: 'system:operation-log:list', name: '查询操作日志' })
  @ApiOperation({ summary: '获取操作日志统计' })
  async getStats() {
    return this.operationLogService.getStats();
  }

  @Delete('delete/:id')
  @RequirePermissions({ code: 'system:operation-log:delete', name: '删除操作日志' })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '删除操作日志' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.operationLogService.remove(id);
  }

  @Post('batch-delete')
  @RequirePermissions({ code: 'system:operation-log:delete', name: '删除操作日志' })
  @HttpCode(HttpStatus.OK)
  @OperationLog({
    operationType: OperationType.DELETE,
    description: '批量删除操作日志',
  })
  @ApiOperation({ summary: '批量删除操作日志' })
  async batchRemove(@Body() body: BatchIdsDto) {
    return this.operationLogService.batchRemove(body.ids);
  }

  @Post('clear-expired')
  @RequirePermissions({ code: 'system:operation-log:delete', name: '删除操作日志' })
  @HttpCode(HttpStatus.OK)
  @OperationLog({
    operationType: OperationType.DELETE,
    description: '清理过期操作日志',
  })
  @ApiOperation({ summary: '清理过期日志' })
  async clearExpired(@Body() body: ClearExpiredDaysDto) {
    return this.operationLogService.clearExpired(body.days);
  }
}
