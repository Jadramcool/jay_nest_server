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
import { CurrentUser, OperationLog } from '@/common/decorators';
import { OperationType } from '@prisma/client';
import { TodoService } from './todo.service';
import { CreateTodoDto, UpdateTodoDto, QueryTodoDto } from './dto/todo.dto';

@ApiTags('待办事项')
@ApiBearerAuth()
@Controller('todo')
export class TodoController {
  constructor(private readonly todoService: TodoService) {}

  @Get('list')
  @ApiOperation({ summary: '获取我的待办列表(平铺,前端转树)' })
  async findAll(
    @CurrentUser() user: { userId: number },
    @Query() query: QueryTodoDto,
  ) {
    return this.todoService.findAll(user.userId, query);
  }

  @Get('stats')
  @ApiOperation({ summary: '待办统计' })
  async getStats(@CurrentUser() user: { userId: number }) {
    return this.todoService.getStats(user.userId);
  }

  @Post('create')
  @OperationLog({
    operationType: OperationType.CREATE,
    description: '新增待办',
  })
  @ApiOperation({ summary: '创建待办' })
  async create(
    @CurrentUser() user: { userId: number },
    @Body() dto: CreateTodoDto,
  ) {
    return this.todoService.create(user.userId, dto);
  }

  @Put('update')
  @OperationLog({
    operationType: OperationType.UPDATE,
    description: '更新待办',
  })
  @ApiOperation({ summary: '更新待办' })
  async update(
    @CurrentUser() user: { userId: number },
    @Body() dto: UpdateTodoDto,
  ) {
    return this.todoService.update(user.userId, dto);
  }

  @Put('toggle/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '完成/取消完成' })
  async toggle(
    @CurrentUser() user: { userId: number },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.todoService.toggle(user.userId, id);
  }

  @Delete('delete/:id')
  @HttpCode(HttpStatus.OK)
  @OperationLog({
    operationType: OperationType.DELETE,
    description: '删除待办',
  })
  @ApiOperation({ summary: '删除待办(级联子任务)' })
  async remove(
    @CurrentUser() user: { userId: number },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.todoService.remove(user.userId, id);
  }
}
