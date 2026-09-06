import {
  Controller,
  Post,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OperationLog } from '@/common/decorators';
import { OperationType } from '@prisma/client';
import { PublicService, TABLE_SORT_CONFIG } from './public.service';
import { SortDto, ResetSortDto } from './dto';

interface AuthedUser {
  permissions?: string[];
}

/**
 * 按表校验排序权限：任何登录用户默认不可排序，
 * 必须持有该表对应模块的 update 权限码（与 PermissionsGuard 同一数据源）。
 */
export function assertTableSortAccess(
  tableName: string,
  user?: AuthedUser,
): void {
  const config = TABLE_SORT_CONFIG[tableName];
  if (!config) {
    throw new BadRequestException(`不支持的表名: ${tableName}`);
  }
  if (!user?.permissions?.includes(config.permission)) {
    throw new ForbiddenException('没有对该数据进行排序的权限');
  }
}

@ApiTags('公共接口')
@ApiBearerAuth()
@Controller('public')
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Post('sort')
  @HttpCode(HttpStatus.OK)
  @OperationLog({
    operationType: OperationType.UPDATE,
    description: '拖拽排序',
  })
  @ApiOperation({ summary: '拖拽排序' })
  async sort(@Body() dto: SortDto, @Req() request: { user?: AuthedUser }) {
    assertTableSortAccess(dto.tableName, request.user);
    return this.publicService.sort(dto);
  }

  @Post('resetSort')
  @HttpCode(HttpStatus.OK)
  @OperationLog({
    operationType: OperationType.UPDATE,
    description: '重置排序',
  })
  @ApiOperation({ summary: '重置排序' })
  async resetSort(
    @Body() dto: ResetSortDto,
    @Req() request: { user?: AuthedUser },
  ) {
    assertTableSortAccess(dto.tableName, request.user);
    return this.publicService.resetSort(dto);
  }
}
