/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Test, TestingModule } from '@nestjs/testing';
import { TodoService } from './todo.service';
import { PrismaService } from '@/prisma/prisma.service';

describe('TodoService', () => {
  let service: TodoService;
  let prisma: jest.Mocked<PrismaService>;

  const mockTodo = {
    id: 1,
    pid: null,
    title: '完成周报',
    content: null,
    sortOrder: 1,
    isDone: false,
    doneTime: null,
    createdTime: new Date(),
    updatedTime: new Date(),
    userId: 1,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TodoService,
        {
          provide: PrismaService,
          useValue: {
            todo: {
              findFirst: jest.fn(),
              findMany: jest.fn(),
              count: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              deleteMany: jest.fn(),
              aggregate: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<TodoService>(TodoService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('数据隔离', () => {
    it('should reject when todo belongs to another user', async () => {
      prisma.todo.findFirst.mockResolvedValue(null);

      await expect(service.toggle(2, 1)).rejects.toThrow('待办 ID 1 不存在');
      await expect(service.remove(2, 1)).rejects.toThrow('待办 ID 1 不存在');
      await expect(service.update(2, { id: 1, title: 'x' })).rejects.toThrow(
        '待办 ID 1 不存在',
      );
    });

    it('should reject when parent todo does not belong to current user', async () => {
      prisma.todo.findFirst.mockResolvedValue(null);

      await expect(
        service.create(1, { title: '子任务', pid: 99 }),
      ).rejects.toThrow('父待办 ID 99 不存在');
    });
  });

  describe('create', () => {
    it('should assign next sortOrder under the same parent', async () => {
      prisma.todo.findFirst.mockResolvedValue(mockTodo);
      prisma.todo.aggregate.mockResolvedValue({
        _max: { sortOrder: 3 },
      });
      prisma.todo.create.mockResolvedValue({ ...mockTodo, id: 2 });

      const result = await service.create(1, { title: '子任务', pid: 1 });

      expect(prisma.todo.create.mock.calls[0][0]).toEqual(
        expect.objectContaining({
          data: expect.objectContaining({ pid: 1, sortOrder: 4 }),
        }),
      );
      expect(result.id).toBe(2);
    });
  });

  describe('toggle', () => {
    it('should set doneTime when completing', async () => {
      prisma.todo.findFirst.mockResolvedValue(mockTodo);
      prisma.todo.update.mockResolvedValue({
        ...mockTodo,
        isDone: true,
      });

      await service.toggle(1, 1);

      const updateArg = prisma.todo.update.mock.calls[0][0] as any;
      expect(updateArg.data.isDone).toBe(true);
      expect(updateArg.data.doneTime).toBeInstanceOf(Date);
    });

    it('should clear doneTime when reopening', async () => {
      const doneTodo = {
        ...mockTodo,
        isDone: true,
        doneTime: new Date(),
      };
      prisma.todo.findFirst.mockResolvedValue(doneTodo);
      prisma.todo.update.mockResolvedValue(mockTodo);

      await service.toggle(1, 1);

      const updateArg = prisma.todo.update.mock.calls[0][0] as any;
      expect(updateArg.data.isDone).toBe(false);
      expect(updateArg.data.doneTime).toBeNull();
    });
  });

  describe('remove', () => {
    it('should cascade delete children', async () => {
      prisma.todo.findFirst.mockResolvedValue(mockTodo);
      prisma.todo.deleteMany.mockResolvedValue({ count: 2 });

      const result = await service.remove(1, 1);

      expect(result.id).toBe(1);
      expect(prisma.todo.deleteMany.mock.calls[0][0]).toEqual({
        where: { OR: [{ id: 1 }, { pid: 1 }] },
      });
    });
  });
});
