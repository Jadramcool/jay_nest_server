import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PublicService, TABLE_SORT_CONFIG } from './public.service';
import { PrismaService } from '@/prisma/prisma.service';

describe('PublicService', () => {
  let service: PublicService;
  let prisma: jest.Mocked<PrismaService>;

  const mockModel = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PublicService,
        {
          provide: PrismaService,
          useValue: {
            $transaction: jest.fn((cb: unknown) => cb),
            department: mockModel,
          },
        },
      ],
    }).compile();

    service = module.get<PublicService>(PublicService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sort', () => {
    it('should throw BadRequestException for unsupported table', async () => {
      await expect(
        service.sort({ tableName: 'invalid', id: 1 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for table without sort semantics', async () => {
      // user/role 等表已从白名单移除
      await expect(service.sort({ tableName: 'user', id: 1 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when record not found', async () => {
      mockModel.findUnique.mockResolvedValue(null);

      await expect(
        service.sort({ tableName: 'department', id: 999 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should place item at first position', async () => {
      mockModel.findUnique.mockResolvedValue({ id: 3, sortOrder: 30 });
      mockModel.findFirst.mockResolvedValue({ id: 1, sortOrder: 10 });

      const result = await service.sort({
        tableName: 'department',
        id: 3,
        position: 'first',
      });

      expect(result.sortOrder).toBe(0);
      expect(mockModel.update).toHaveBeenCalledWith({
        where: { id: 3 },
        data: { sortOrder: 0 },
      });
    });

    it('should place item at last position', async () => {
      mockModel.findUnique.mockResolvedValue({ id: 1, sortOrder: 10 });
      mockModel.findFirst.mockResolvedValue({ id: 3, sortOrder: 30 });

      const result = await service.sort({
        tableName: 'department',
        id: 1,
        position: 'last',
      });

      expect(result.sortOrder).toBe(40);
    });

    it('should place item before a target', async () => {
      mockModel.findUnique
        .mockResolvedValueOnce({ id: 3, sortOrder: 30 }) // current record
        .mockResolvedValueOnce({ id: 1, sortOrder: 10 }); // target record
      mockModel.findFirst.mockResolvedValue(null); // nothing before target

      const result = await service.sort({
        tableName: 'department',
        id: 3,
        position: 'before',
        targetId: 1,
      });

      expect(result.sortOrder).toBe(0);
    });

    it('should place item after a target', async () => {
      mockModel.findUnique
        .mockResolvedValueOnce({ id: 1, sortOrder: 10 }) // current record
        .mockResolvedValueOnce({ id: 3, sortOrder: 30 }); // target record
      mockModel.findFirst.mockResolvedValue(null); // nothing after target

      const result = await service.sort({
        tableName: 'department',
        id: 1,
        position: 'after',
        targetId: 3,
      });

      expect(result.sortOrder).toBe(40);
    });

    it('should place item in the middle of two records when after', async () => {
      mockModel.findUnique
        .mockResolvedValueOnce({ id: 2, sortOrder: 20 }) // current record
        .mockResolvedValueOnce({ id: 1, sortOrder: 10 }); // target record
      mockModel.findFirst.mockResolvedValue({ id: 3, sortOrder: 30 }); // record after target

      const result = await service.sort({
        tableName: 'department',
        id: 2,
        position: 'after',
        targetId: 1,
      });

      expect(result.sortOrder).toBe(20);
    });

    it('should throw when targetId is missing for before position', async () => {
      mockModel.findUnique.mockResolvedValue({ id: 1, sortOrder: 10 });

      await expect(
        service.sort({ tableName: 'department', id: 1, position: 'before' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should filter by parent field for hierarchical table', async () => {
      mockModel.findUnique.mockResolvedValue({ id: 1, sortOrder: 10 });
      mockModel.findFirst.mockResolvedValue({ id: 3, sortOrder: 30 });

      const result = await service.sort({
        tableName: 'department',
        id: 1,
        position: 'last',
        parentIdField: 'parentId',
        parentId: 5,
      });

      expect(mockModel.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { parentId: 5 },
        }),
      );
      expect(result.sortOrder).toBe(40);
    });

    it('should throw for parent field not in table whitelist', async () => {
      // 平表没有任何层级字段 → 传任何 parentIdField 都应被拒
      TABLE_SORT_CONFIG.flatTest = {
        model: 'department',
        permission: 'system:department:update',
        parentFields: [],
      };
      await expect(
        service.sort({
          tableName: 'flatTest',
          id: 1,
          parentIdField: 'parentId',
        }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.sort({
          tableName: 'flatTest',
          id: 1,
          parentIdField: 'managerId',
        }),
      ).rejects.toThrow(BadRequestException);
      delete TABLE_SORT_CONFIG.flatTest;
    });
  });

  describe('resetSort', () => {
    it('should reset sort orders sequentially for flat table', async () => {
      // 平表分支:原先用 sysConfig 覆盖,该表已随设置重构移除,
      // 这里注册一个测试专用平表,避免为了测试保留生产白名单里的死配置
      TABLE_SORT_CONFIG.flatTest = {
        model: 'department',
        permission: 'system:department:update',
        parentFields: [],
      };
      mockModel.findMany.mockResolvedValue([
        { id: 1, sortOrder: 100 },
        { id: 2, sortOrder: 50 },
        { id: 3, sortOrder: 200 },
      ]);
      prisma.$transaction.mockImplementation(async (updates: unknown[]) =>
        Promise.all(updates),
      );

      const result = await service.resetSort({ tableName: 'flatTest' });
      delete TABLE_SORT_CONFIG.flatTest;

      expect(result).toEqual({ resetCount: 3 });
      expect(mockModel.update).toHaveBeenCalledTimes(3);
      expect(mockModel.update).toHaveBeenNthCalledWith(1, {
        where: { id: 1 },
        data: { sortOrder: 10 },
      });
      expect(mockModel.update).toHaveBeenNthCalledWith(2, {
        where: { id: 2 },
        data: { sortOrder: 20 },
      });
      expect(mockModel.update).toHaveBeenNthCalledWith(3, {
        where: { id: 3 },
        data: { sortOrder: 30 },
      });
    });

    it('should throw BadRequestException for unsupported table', async () => {
      await expect(service.resetSort({ tableName: 'invalid' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should require parent scope for hierarchical table', async () => {
      // 层级表不带父级范围 → 防止全表重写
      await expect(
        service.resetSort({ tableName: 'department' }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.resetSort({
          tableName: 'department',
          parentIdField: 'parentId',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reset only within parent scope for hierarchical table', async () => {
      mockModel.findMany.mockResolvedValue([{ id: 7, sortOrder: 5 }]);
      prisma.$transaction.mockImplementation(async (updates: unknown[]) =>
        Promise.all(updates),
      );

      const result = await service.resetSort({
        tableName: 'department',
        parentIdField: 'parentId',
        parentId: 5,
      });

      expect(mockModel.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { parentId: 5 } }),
      );
      expect(result).toEqual({ resetCount: 1 });
    });
  });
});
