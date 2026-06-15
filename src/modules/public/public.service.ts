import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { SortDto, ResetSortDto } from './dto';

type PrismaDelegate = {
  findUnique: (args: {
    where: Record<string, unknown>;
  }) => Promise<Record<string, unknown> | null>;
  findFirst: (args: {
    where?: Record<string, unknown>;
    orderBy?: Record<string, string>;
  }) => Promise<Record<string, unknown> | null>;
  findMany: (args: {
    where?: Record<string, unknown>;
    orderBy?: Record<string, string>;
  }) => Promise<Record<string, unknown>[]>;
  update: (args: {
    where: { id: number };
    data: Record<string, unknown>;
  }) => Promise<Record<string, unknown>>;
};

const TABLE_MODEL_MAP: Record<string, keyof PrismaService> = {
  sysConfig: 'sysConfig',
  user: 'user',
  role: 'role',
  department: 'department',
  menu: 'menu',
  navigation: 'navigation',
  navigationGroup: 'navigationGroup',
  notice: 'notice',
  todo: 'todo',
  operationLog: 'operationLog',
};

function getPrismaDelegate(
  prisma: PrismaService,
  tableName: string,
): PrismaDelegate {
  const key = TABLE_MODEL_MAP[tableName];
  if (!key) {
    throw new BadRequestException(`不支持的表名: ${tableName}`);
  }
  return prisma[key] as unknown as PrismaDelegate;
}

@Injectable()
export class PublicService {
  constructor(private readonly prisma: PrismaService) {}

  async sort(dto: SortDto) {
    const model = getPrismaDelegate(this.prisma, dto.tableName);

    const currentRecord = await model.findUnique({ where: { id: dto.id } });
    if (!currentRecord) {
      throw new BadRequestException(`记录 ID ${dto.id} 不存在`);
    }

    const where: Record<string, unknown> = {};
    if (dto.parentIdField && dto.parentId !== undefined) {
      where[dto.parentIdField] = dto.parentId;
    }

    let newSortOrder: number;

    switch (dto.position) {
      case 'first': {
        const firstRecord = await model.findFirst({
          where,
          orderBy: { sortOrder: 'asc' },
        });
        newSortOrder = ((firstRecord?.sortOrder as number) ?? 0) - 10;
        break;
      }
      case 'last': {
        const lastRecord = await model.findFirst({
          where,
          orderBy: { sortOrder: 'desc' },
        });
        newSortOrder = ((lastRecord?.sortOrder as number) ?? 0) + 10;
        break;
      }
      case 'before': {
        if (!dto.targetId) {
          throw new BadRequestException('before 位置需要 targetId');
        }
        const targetRecord = await model.findUnique({
          where: { id: parseInt(dto.targetId, 10) },
        });
        if (!targetRecord) {
          throw new BadRequestException(`目标记录 ID ${dto.targetId} 不存在`);
        }
        const beforeTarget = await model.findFirst({
          where: { ...where, sortOrder: { lt: targetRecord.sortOrder } },
          orderBy: { sortOrder: 'desc' },
        });
        const targetSortOrder = targetRecord.sortOrder as number;
        newSortOrder =
          beforeTarget && beforeTarget.sortOrder !== undefined
            ? Math.floor(
                ((beforeTarget.sortOrder as number) + targetSortOrder) / 2,
              )
            : targetSortOrder - 10;
        break;
      }
      case 'after':
      default: {
        if (dto.targetId) {
          const targetRecord = await model.findUnique({
            where: { id: parseInt(dto.targetId, 10) },
          });
          if (!targetRecord) {
            throw new BadRequestException(`目标记录 ID ${dto.targetId} 不存在`);
          }
          const afterTarget = await model.findFirst({
            where: { ...where, sortOrder: { gt: targetRecord.sortOrder } },
            orderBy: { sortOrder: 'asc' },
          });
          const targetSortOrder = targetRecord.sortOrder as number;
          newSortOrder =
            afterTarget && afterTarget.sortOrder !== undefined
              ? Math.floor(
                  (targetSortOrder + (afterTarget.sortOrder as number)) / 2,
                )
              : targetSortOrder + 10;
        } else {
          const lastRecord = await model.findFirst({
            where,
            orderBy: { sortOrder: 'desc' },
          });
          newSortOrder = ((lastRecord?.sortOrder as number) ?? 0) + 10;
        }
        break;
      }
    }

    if (newSortOrder < 0) {
      newSortOrder = 0;
    }

    await model.update({
      where: { id: dto.id },
      data: { sortOrder: newSortOrder },
    });

    return { id: dto.id, sortOrder: newSortOrder };
  }

  async resetSort(dto: ResetSortDto) {
    const model = getPrismaDelegate(this.prisma, dto.tableName);
    const where: Record<string, unknown> = {};
    if (dto.parentIdField && dto.parentId !== undefined) {
      where[dto.parentIdField] = dto.parentId;
    }

    const records = await model.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
    });

    await this.prisma.$transaction(
      records.map((record: Record<string, unknown>, index: number) =>
        model.update({
          where: { id: record.id as number },
          data: { sortOrder: (index + 1) * 10 },
        }),
      ) as unknown as [],
    );

    return { resetCount: records.length };
  }
}
