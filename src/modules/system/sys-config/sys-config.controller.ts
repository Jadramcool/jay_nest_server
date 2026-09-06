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
import { Public, RequirePermissions, OperationLog } from '@/common/decorators';
import { OperationType } from '@prisma/client';
import { SysConfigService } from './sys-config.service';
import { ConfigResolverService } from './config-resolver.service';
import {
  CreateSysConfigDto,
  UpdateSysConfigWithIdDto,
  QuerySysConfigDto,
} from './dto';

@ApiTags('系统配置')
@ApiBearerAuth()
@Controller('system/config')
export class SysConfigController {
  constructor(
    private readonly sysConfigService: SysConfigService,
    private readonly configResolver: ConfigResolverService,
  ) {}

  /** 类型化读取单个配置(带缓存,业务消费方与调试用) */
  @Get('resolve/:key')
  @RequirePermissions('system:config:list')
  @ApiOperation({ summary: '类型化读取配置(带缓存)' })
  async resolve(@Param('key') key: string) {
    return this.configResolver.get(key);
  }

  /** 批量类型化读取 */
  @Get('resolve')
  @RequirePermissions('system:config:list')
  @ApiOperation({ summary: '批量类型化读取配置' })
  async resolveMany(@Query('keys') keys: string) {
    const keyList = keys
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);
    return this.configResolver.getMany(keyList);
  }

  @Get('list')
  @RequirePermissions('system:config:list')
  @ApiOperation({ summary: '获取系统配置列表' })
  async findAll(@Query() querySysConfigDto: QuerySysConfigDto) {
    return this.sysConfigService.findAll(querySysConfigDto);
  }

  @Get('detail/:id')
  @RequirePermissions('system:config:list')
  @ApiOperation({ summary: '获取系统配置详情' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.sysConfigService.findOne(id);
  }

  @Get('key/:key')
  @RequirePermissions('system:config:list')
  @ApiOperation({ summary: '根据键获取系统配置' })
  async findByKey(@Param('key') key: string) {
    return this.sysConfigService.findByKey(key);
  }

  @Get('category/:category')
  @RequirePermissions('system:config:list')
  @ApiOperation({ summary: '根据分类获取系统配置' })
  async findByCategory(@Param('category') category: string) {
    return this.sysConfigService.findByCategory(category);
  }

  @Get('public')
  @Public()
  @ApiOperation({ summary: '获取公开配置' })
  async findPublic() {
    return this.sysConfigService.findPublic();
  }

  @Post('create')
  @RequirePermissions('system:config:create')
  @ApiOperation({ summary: '创建系统配置' })
  async create(@Body() createSysConfigDto: CreateSysConfigDto) {
    return this.sysConfigService.create(createSysConfigDto);
  }

  @Put('update')
  @RequirePermissions('system:config:update')
  @ApiOperation({ summary: '更新系统配置' })
  async update(@Body() updateSysConfigDto: UpdateSysConfigWithIdDto) {
    const { id, ...data } = updateSysConfigDto;
    return this.sysConfigService.update(id, data);
  }

  @Delete('delete/:id')
  @RequirePermissions('system:config:delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '删除系统配置' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.sysConfigService.remove(id);
  }

  @Put('batchDelete')
  @RequirePermissions('system:config:delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '批量删除系统配置' })
  async batchRemove(@Body('ids') ids: number[]) {
    return this.sysConfigService.batchRemove(ids);
  }

  @Put('status/:id')
  @RequirePermissions('system:config:update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '启用/禁用系统配置' })
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body('status') status: number,
  ) {
    return this.sysConfigService.updateStatus(id, status);
  }

  @Post('validate-password')
  @RequirePermissions('system:config:update')
  @HttpCode(HttpStatus.OK)
  @OperationLog({ operationType: OperationType.VIEW, description: '校验密码' })
  @ApiOperation({ summary: '校验密码' })
  async validatePassword(@Body('password') password: string) {
    return this.sysConfigService.validatePassword(password);
  }
}
