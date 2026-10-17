import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OperationType } from '@prisma/client';
import {
  CurrentUser,
  OperationLog,
  Public,
  RequirePermissions,
} from '@/common/decorators';
import { PaginationDto } from '@/common/dto/pagination.dto';
import {
  QuerySettingsDto,
  ResetSettingDto,
  RollbackSettingDto,
  UpdateSettingDto,
} from './dto';
import { SettingsService } from './settings.service';

interface CurrentUserPayload {
  userId?: number;
  username?: string;
}

/**
 * 系统设置接口。
 *
 * 路由声明顺序很关键:`public` / `schema` 必须在 `:key` 之前,
 * 否则会被 `:key` 通配吃掉。
 */
@ApiTags('系统设置')
@ApiBearerAuth()
@Controller('system/settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  /** 匿名可读白名单(注册表 expose=public),登录页/布局品牌位使用 */
  @Get('public')
  @Public()
  @ApiOperation({ summary: '获取公开设置(白名单)' })
  async publicView() {
    return this.settingsService.publicView();
  }

  /** 注册表元数据:前端据此自动渲染设置页 */
  @Get('schema')
  @RequirePermissions({ code: 'system:setting:list', name: '查看设置' })
  @ApiOperation({ summary: '获取设置注册表元数据' })
  schema() {
    return this.settingsService.schema();
  }

  @Get()
  @RequirePermissions({ code: 'system:setting:list', name: '查看设置' })
  @ApiOperation({ summary: '获取设置列表(生效值/来源/版本)' })
  async findAll(@Query() query: QuerySettingsDto) {
    return this.settingsService.listViews(query.group);
  }

  @Get(':key/history')
  @RequirePermissions({ code: 'system:setting:list', name: '查看设置' })
  @ApiOperation({ summary: '获取设置变更历史' })
  async history(@Param('key') key: string, @Query() query: PaginationDto) {
    return this.settingsService.history(key, query.page, query.pageSize);
  }

  @Put(':key')
  @RequirePermissions({ code: 'system:setting:update', name: '修改设置' })
  // 设置值不落操作日志(改完会被 hash/历史记录,secret 更不该进日志)
  @OperationLog({
    operationType: OperationType.UPDATE,
    description: '修改系统设置',
    logParams: false,
  })
  @ApiOperation({ summary: '修改设置' })
  async update(
    @Param('key') key: string,
    @Body() dto: UpdateSettingDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.settingsService.set(key, dto.value, {
      actor: { userId: user?.userId, username: user?.username },
      reason: dto.reason,
      expectedVersion: dto.expectedVersion,
    });
  }

  @Post(':key/reset')
  @RequirePermissions({ code: 'system:setting:update', name: '修改设置' })
  @OperationLog({
    operationType: OperationType.UPDATE,
    description: '重置系统设置',
    logParams: false,
  })
  @ApiOperation({ summary: '重置设置为默认值' })
  async reset(
    @Param('key') key: string,
    @Body() dto: ResetSettingDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.settingsService.reset(key, {
      actor: { userId: user?.userId, username: user?.username },
      reason: dto.reason,
      expectedVersion: dto.expectedVersion,
    });
  }

  @Post(':key/rollback')
  @RequirePermissions({ code: 'system:setting:rollback', name: '回滚设置' })
  @OperationLog({
    operationType: OperationType.UPDATE,
    description: '回滚系统设置',
    logParams: false,
  })
  @ApiOperation({ summary: '回滚设置到指定版本' })
  async rollback(
    @Param('key') key: string,
    @Body() dto: RollbackSettingDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.settingsService.rollback(key, dto.version, {
      actor: { userId: user?.userId, username: user?.username },
      reason: dto.reason,
    });
  }
}
