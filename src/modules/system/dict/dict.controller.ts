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
import { DictService } from './dict.service';
import {
  CreateDictTypeDto,
  UpdateDictTypeDto,
  QueryDictTypeDto,
} from './dto/dict-type.dto';
import {
  CreateDictItemDto,
  UpdateDictItemDto,
  QueryDictItemDto,
} from './dto/dict-item.dto';

@ApiTags('数据字典')
@ApiBearerAuth()
@Controller('system/dict')
export class DictController {
  constructor(private readonly dictService: DictService) {}

  // ═══════════ 字典类型 ═══════════

  @Get('type/list')
  @RequirePermissions('system:dict:list')
  @ApiOperation({ summary: '获取字典类型列表(分页)' })
  async findTypes(@Query() query: QueryDictTypeDto) {
    return this.dictService.findTypes(query);
  }

  @Get('type/all')
  @RequirePermissions('system:dict:list')
  @ApiOperation({ summary: '获取全部字典类型(下拉)' })
  async findAllTypes() {
    return this.dictService.findAllTypes();
  }

  @Post('type/create')
  @RequirePermissions('system:dict:create')
  @OperationLog({
    operationType: OperationType.CREATE,
    description: '新增字典类型',
  })
  @ApiOperation({ summary: '创建字典类型' })
  async createType(@Body() dto: CreateDictTypeDto) {
    return this.dictService.createType(dto);
  }

  @Put('type/update')
  @RequirePermissions('system:dict:update')
  @OperationLog({
    operationType: OperationType.UPDATE,
    description: '更新字典类型',
  })
  @ApiOperation({ summary: '更新字典类型' })
  async updateType(@Body() dto: UpdateDictTypeDto) {
    return this.dictService.updateType(dto);
  }

  @Delete('type/delete/:id')
  @RequirePermissions('system:dict:delete')
  @HttpCode(HttpStatus.OK)
  @OperationLog({
    operationType: OperationType.DELETE,
    description: '删除字典类型',
  })
  @ApiOperation({ summary: '删除字典类型(级联软删字典项)' })
  async removeType(@Param('id', ParseIntPipe) id: number) {
    return this.dictService.removeType(id);
  }

  @Put('type/status/:id')
  @RequirePermissions('system:dict:update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '启用/禁用字典类型' })
  async updateTypeStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body('status') status: number,
  ) {
    return this.dictService.updateTypeStatus(id, status);
  }

  // ═══════════ 字典项 ═══════════

  @Get('item/list')
  @RequirePermissions('system:dict:list')
  @ApiOperation({ summary: '获取字典项列表(分页)' })
  async findItems(@Query() query: QueryDictItemDto) {
    return this.dictService.findItems(query);
  }

  @Get('items/:code')
  @RequirePermissions('system:dict:list')
  @ApiOperation({ summary: '按类型编码获取启用字典项(下拉)' })
  async itemsByCode(@Param('code') code: string) {
    return this.dictService.itemsByCode(code);
  }

  @Post('item/create')
  @RequirePermissions('system:dict:create')
  @OperationLog({
    operationType: OperationType.CREATE,
    description: '新增字典项',
  })
  @ApiOperation({ summary: '创建字典项' })
  async createItem(@Body() dto: CreateDictItemDto) {
    return this.dictService.createItem(dto);
  }

  @Put('item/update')
  @RequirePermissions('system:dict:update')
  @OperationLog({
    operationType: OperationType.UPDATE,
    description: '更新字典项',
  })
  @ApiOperation({ summary: '更新字典项' })
  async updateItem(@Body() dto: UpdateDictItemDto) {
    return this.dictService.updateItem(dto);
  }

  @Delete('item/delete/:id')
  @RequirePermissions('system:dict:delete')
  @HttpCode(HttpStatus.OK)
  @OperationLog({
    operationType: OperationType.DELETE,
    description: '删除字典项',
  })
  @ApiOperation({ summary: '删除字典项' })
  async removeItem(@Param('id', ParseIntPipe) id: number) {
    return this.dictService.removeItem(id);
  }

  @Put('item/status/:id')
  @RequirePermissions('system:dict:update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '启用/禁用字典项' })
  async updateItemStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body('status') status: number,
  ) {
    return this.dictService.updateItemStatus(id, status);
  }
}
