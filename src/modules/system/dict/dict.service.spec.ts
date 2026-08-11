/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Test, TestingModule } from '@nestjs/testing';
import { DictService } from './dict.service';
import { PrismaService } from '@/prisma/prisma.service';

describe('DictService', () => {
  let service: DictService;
  let prisma: jest.Mocked<PrismaService>;

  const mockType = {
    id: 1,
    code: 'sex',
    name: '性别',
    status: 1,
    remark: null,
    isDeleted: false,
    createdTime: new Date(),
    updatedTime: new Date(),
  };

  const mockItem = {
    id: 1,
    typeId: 1,
    code: 'MALE',
    label: '男',
    sortOrder: 1,
    status: 1,
    isDeleted: false,
    createdTime: new Date(),
    updatedTime: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DictService,
        {
          provide: PrismaService,
          useValue: {
            dictType: {
              findFirst: jest.fn(),
              findMany: jest.fn(),
              count: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
            dictItem: {
              findFirst: jest.fn(),
              findMany: jest.fn(),
              count: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              updateMany: jest.fn(),
            },
            $transaction: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<DictService>(DictService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createType', () => {
    it('should create type when code is unique', async () => {
      prisma.dictType.findFirst.mockResolvedValue(null);
      prisma.dictType.create.mockResolvedValue(mockType);

      const result = await service.createType({ code: 'sex', name: '性别' });

      expect(result.code).toBe('sex');
      expect(prisma.dictType.create.mock.calls[0][0]).toEqual({
        data: { code: 'sex', name: '性别', status: 1, remark: undefined },
      });
    });

    it('should reject when code already exists', async () => {
      prisma.dictType.findFirst.mockResolvedValue(mockType);

      await expect(
        service.createType({ code: 'sex', name: '性别' }),
      ).rejects.toThrow('字典类型编码「sex」已存在');
      expect(prisma.dictType.create.mock.calls).toHaveLength(0);
    });
  });

  describe('itemsByCode', () => {
    it('should return enabled items ordered by sortOrder', async () => {
      prisma.dictType.findFirst.mockResolvedValue(mockType);
      prisma.dictItem.findMany.mockResolvedValue([
        { id: 2, code: 'FEMALE', label: '女', sortOrder: 2 },
        { id: 1, code: 'MALE', label: '男', sortOrder: 1 },
      ]);

      const items = await service.itemsByCode('sex');

      expect(items).toHaveLength(2);
      expect(prisma.dictItem.findMany.mock.calls[0][0]).toEqual(
        expect.objectContaining({
          where: { typeId: 1, isDeleted: false, status: 1 },
        }),
      );
    });

    it('should return empty array when type not found', async () => {
      prisma.dictType.findFirst.mockResolvedValue(null);

      await expect(service.itemsByCode('unknown')).resolves.toEqual([]);
      expect(prisma.dictItem.findMany.mock.calls).toHaveLength(0);
    });
  });

  describe('createItem', () => {
    it('should reject when type does not exist', async () => {
      prisma.dictType.findFirst.mockResolvedValue(null);

      await expect(
        service.createItem({ typeId: 99, code: 'X', label: '测试' }),
      ).rejects.toThrow('字典类型 ID 99 不存在');
    });

    it('should reject when item code already exists in same type', async () => {
      prisma.dictType.findFirst.mockResolvedValue(mockType);
      prisma.dictItem.findFirst.mockResolvedValue(mockItem);

      await expect(
        service.createItem({ typeId: 1, code: 'MALE', label: '男' }),
      ).rejects.toThrow('字典项编码「MALE」在该类型下已存在');
    });
  });

  describe('removeType', () => {
    it('should soft-delete type and its items in a transaction', async () => {
      prisma.dictType.findFirst.mockResolvedValue(mockType);
      prisma.$transaction.mockResolvedValue([{ count: 1 }, { id: 1 }]);

      const result = await service.removeType(1);

      expect(result.id).toBe(1);
      expect(prisma.dictItem.updateMany.mock.calls[0][0]).toEqual({
        where: { typeId: 1, isDeleted: false },
        data: { isDeleted: true },
      });
      expect(prisma.dictType.update.mock.calls[0][0]).toEqual({
        where: { id: 1 },
        data: { isDeleted: true },
      });
    });

    it('should reject when type not found', async () => {
      prisma.dictType.findFirst.mockResolvedValue(null);

      await expect(service.removeType(99)).rejects.toThrow(
        '字典类型 ID 99 不存在',
      );
    });
  });
});
