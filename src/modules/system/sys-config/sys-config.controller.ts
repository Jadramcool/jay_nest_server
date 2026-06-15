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
import { Public, RequirePermissions } from '@/common/decorators';
import { SysConfigService } from './sys-config.service';
import {
  CreateSysConfigDto,
  UpdateSysConfigDto,
  QuerySysConfigDto,
} from './dto';

@ApiTags('系统配置')
@ApiBearerAuth()
@Controller('system/config')
export class SysConfigController {
  constructor(private readonly sysConfigService: SysConfigService) {}

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
  async update(
    @Body() updateSysConfigDto: UpdateSysConfigDto & { id: number },
  ) {
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
  @ApiOperation({ summary: '校验密码' })
  async validatePassword(@Body('password') password: string) {
    return this.sysConfigService.validatePassword(password);
  }
}
