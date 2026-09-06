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
import { RequirePermissions, OperationLog } from '@/common/decorators';
import { OperationType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
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
}

@ApiTags('在线用户')
@ApiBearerAuth()
@Controller('system/session')
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  @Get('list')
  @RequirePermissions('system:session:list')
  @ApiOperation({ summary: '在线会话列表(分页)' })
  async findAll(@Query() query: QuerySessionDto) {
    return this.sessionService.findAll(query.page ?? 1, query.pageSize ?? 20);
  }

  @Get('stats')
  @RequirePermissions('system:session:list')
  @ApiOperation({ summary: '在线会话统计' })
  async getStats() {
    return this.sessionService.getStats();
  }

  @Post('kick/:id')
  @RequirePermissions('system:session:kick')
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
  @RequirePermissions('system:session:kick')
  @HttpCode(HttpStatus.OK)
  @OperationLog({
    operationType: OperationType.UPDATE,
    description: '强制下线用户全部会话',
  })
  @ApiOperation({ summary: '强制下线用户全部会话' })
  async kickByUser(@Param('userId', ParseIntPipe) userId: number) {
    return this.sessionService.kickByUser(userId);
  }
}
