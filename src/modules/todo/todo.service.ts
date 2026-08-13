import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateTodoDto, UpdateTodoDto, QueryTodoDto } from './dto/todo.dto';

@Injectable()
export class TodoService {
  constructor(private readonly prisma: PrismaService) {}

  /** 当前用户的待办(平铺,按创建时间倒序;前端 arrayToTree 转树) */
  async findAll(userId: number, query: QueryTodoDto) {
    const { onlyUndone, keyword } = query;
    return this.prisma.todo.findMany({
      where: {
        userId,
        isDone: onlyUndone === 1 ? false : undefined,
        ...(keyword ? { title: { contains: keyword } } : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
  }

  /** 待办统计(未完成/已完成/总数) */
  async getStats(userId: number) {
    const [total, undone, done] = await Promise.all([
      this.prisma.todo.count({ where: { userId } }),
      this.prisma.todo.count({ where: { userId, isDone: false } }),
      this.prisma.todo.count({ where: { userId, isDone: true } }),
    ]);
    return { total, undone, done };
  }

  async create(userId: number, dto: CreateTodoDto) {
    if (dto.pid) {
      await this.assertOwnTodo(userId, dto.pid, '父待办');
    }
    const maxOrder = await this.prisma.todo.aggregate({
      where: { userId, pid: dto.pid ?? null },
      _max: { sortOrder: true },
    });
    return this.prisma.todo.create({
      data: {
        userId,
        title: dto.title,
        content: dto.content,
        pid: dto.pid ?? null,
        sortOrder: dto.sortOrder ?? (maxOrder._max.sortOrder ?? 0) + 1,
      },
    });
  }

  async update(userId: number, dto: UpdateTodoDto) {
    const { id, ...data } = dto;
    await this.assertOwnTodo(userId, id, '待办');
    if (data.pid) {
      await this.assertOwnTodo(userId, data.pid, '父待办');
    }
    return this.prisma.todo.update({ where: { id }, data });
  }

  async remove(userId: number, id: number) {
    await this.assertOwnTodo(userId, id, '待办');
    // 级联删除子任务
    await this.prisma.todo.deleteMany({
      where: { OR: [{ id }, { pid: id }] },
    });
    return { id };
  }

  /** 切换完成状态,完成时记录 doneTime */
  async toggle(userId: number, id: number) {
    const todo = await this.assertOwnTodo(userId, id, '待办');
    return this.prisma.todo.update({
      where: { id },
      data: {
        isDone: !todo.isDone,
        doneTime: todo.isDone ? null : new Date(),
      },
    });
  }

  private async assertOwnTodo(userId: number, id: number, label: string) {
    const todo = await this.prisma.todo.findFirst({ where: { id, userId } });
    if (!todo) {
      throw new NotFoundException(`${label} ID ${id} 不存在`);
    }
    return todo;
  }
}
