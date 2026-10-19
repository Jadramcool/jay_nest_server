import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import {
  RequirePermissions,
  OperationLog,
  CurrentUser,
} from '@/common/decorators';
import { OperationType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { SessionService } from './session.service';

class QuerySessionDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;

  /** 用户名或姓名，模糊匹配 */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  username?: string;

  /** 登录端: admin | app | mp */
  @IsOptional()
  @IsString()
  @MaxLength(16)
  platform?: string;

  /** 活跃状态: active 判定窗口内有请求 | idle 超出窗口但会话仍有效 */
  @IsOptional()
  @IsIn(['active', 'idle'])
  status?: 'active' | 'idle';
}

@ApiTags('在线用户')
@ApiBearerAuth()
@Controller('system/session')
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  @Get('list')
  @RequirePermissions({ code: 'system:session:list', name: '查询会话' })
  @ApiOperation({ summary: '在线会话列表(分页，含活跃/闲置状态)' })
  async findAll(
    @Query() query: QuerySessionDto,
    @CurrentUser() user: { jti?: string } | null,
  ) {
    return this.sessionService.findAll(
      query.page ?? 1,
      query.pageSize ?? 20,
      user?.jti,
      {
        username: query.username,
        platform: query.platform,
        status: query.status,
      },
    );
  }

  @Get('stats')
  @RequirePermissions({ code: 'system:session:list', name: '查询会话' })
  @ApiOperation({ summary: '在线会话统计' })
  async getStats() {
    return this.sessionService.getStats();
  }

  @Post('kick/:id')
  @RequirePermissions({ code: 'system:session:kick', name: '强制下线' })
  @HttpCode(HttpStatus.OK)
  @OperationLog({
    operationType: OperationType.UPDATE,
    description: '强制下线会话',
  })
  @ApiOperation({ summary: '强制下线指定会话' })
  async kick(@Param('id', ParseIntPipe) id: number) {
    return this.sessionService.kick(id);
  }

  @Post('kick-user/:userId')
  @RequirePermissions({ code: 'system:session:kick', name: '强制下线' })
  @HttpCode(HttpStatus.OK)
  @OperationLog({
    operationType: OperationType.UPDATE,
    description: '强制下线用户全部会话',
  })
  @ApiOperation({
    summary: '强制下线用户全部会话',
    description: '调用者自己的当前会话会被保留，避免管理员把自己踢下线',
  })
  async kickByUser(
    @Param('userId', ParseIntPipe) userId: number,
    @CurrentUser() user: { jti?: string } | null,
  ) {
    return this.sessionService.kickByUser(userId, { excludeJti: user?.jti });
  }
}
