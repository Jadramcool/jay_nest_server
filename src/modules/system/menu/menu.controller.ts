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
import { MenuService } from './menu.service';
import { CreateMenuDto, UpdateMenuDto, QueryMenuDto } from './dto';

@ApiTags('菜单管理')
@ApiBearerAuth()
@Controller('system/menu')
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  @Get('list')
  @RequirePermissions('system:menu:list')
  @ApiOperation({ summary: '获取菜单列表' })
  async findAll(@Query() queryMenuDto: QueryMenuDto) {
    return this.menuService.findAll(queryMenuDto);
  }

  @Public()
  @Get('onlineMenus')
  @ApiOperation({ summary: '获取在线菜单（无需登录）' })
  async findOnlineMenus() {
    return this.menuService.findOnlineMenus();
  }

  @Get('tree')
  @RequirePermissions('system:menu:list')
  @ApiOperation({ summary: '获取菜单树' })
  async findTree() {
    return this.menuService.findTree();
  }

  @Post('create')
  @RequirePermissions('system:menu:create')
  @ApiOperation({ summary: '创建菜单' })
  async create(@Body() createMenuDto: CreateMenuDto) {
    return this.menuService.create(createMenuDto);
  }

  @Put('update')
  @RequirePermissions('system:menu:update')
  @ApiOperation({ summary: '更新菜单' })
  async update(@Body() updateMenuDto: UpdateMenuDto) {
    const { id, ...data } = updateMenuDto;
    return this.menuService.update(id, data);
  }

  @Delete('delete/:id')
  @RequirePermissions('system:menu:delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '删除菜单' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.menuService.remove(id);
  }

  @Delete('batchDelete')
  @RequirePermissions('system:menu:delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '批量删除菜单' })
  async batchRemove(@Body('ids') ids: number[]) {
    return this.menuService.batchRemove(ids);
  }
}
