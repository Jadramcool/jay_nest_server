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

/**
 * 允许拖拽排序的表白名单（唯一事实来源）。
 *
 * 只收录确实拥有 sortOrder 字段、且排序属于其管理语义的表；
 * permission 为操作该表排序所需的权限码（在 controller 校验），
 * parentFields 为该表允许的层级字段（为空表示平表）。
 * user/role/menu/notice/todo/operationLog 等表无排序语义或有独立权限模型，一律拒绝。
 */
export const TABLE_SORT_CONFIG: Record<
  string,
  { model: keyof PrismaService; permission: string; parentFields: string[] }
> = {
  sysConfig: {
    model: 'sysConfig',
    permission: 'system:config:update',
    parentFields: [],
  },
  department: {
    model: 'department',
    permission: 'system:department:update',
    parentFields: ['parentId'],
  },
};

function getSortConfig(tableName: string) {
  const config = TABLE_SORT_CONFIG[tableName];
  if (!config) {
    throw new BadRequestException(`不支持的表名: ${tableName}`);
  }
  return config;
}

function getPrismaDelegate(
  prisma: PrismaService,
  config: { model: keyof PrismaService },
): PrismaDelegate {
  return prisma[config.model] as unknown as PrismaDelegate;
}

@Injectable()
export class PublicService {
  constructor(private readonly prisma: PrismaService) {}

  async sort(dto: SortDto) {
    const config = getSortConfig(dto.tableName);
    this.assertParentField(config, dto.parentIdField);
    const model = getPrismaDelegate(this.prisma, config);

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
        if (dto.targetId === undefined) {
          throw new BadRequestException('before 位置需要 targetId');
        }
        const targetRecord = await model.findUnique({
          where: { id: dto.targetId },
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
        if (dto.targetId !== undefined) {
          const targetRecord = await model.findUnique({
            where: { id: dto.targetId },
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
    const config = getSortConfig(dto.tableName);
    this.assertParentField(config, dto.parentIdField);
    const model = getPrismaDelegate(this.prisma, config);

    // 层级表必须限定父级范围，防止空条件全表重写；平表整表重置即其语义
    const where: Record<string, unknown> = {};
    if (config.parentFields.length > 0) {
      if (!dto.parentIdField || dto.parentId === undefined) {
        throw new BadRequestException(
          '层级表重置排序必须指定 parentIdField 与 parentId',
        );
      }
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

  /** 校验 parentIdField 是否在该表白名单内（parentIdField 为空时跳过） */
  private assertParentField(
    config: { parentFields: string[] },
    parentIdField?: string,
  ) {
    if (parentIdField && !config.parentFields.includes(parentIdField)) {
      throw new BadRequestException(
        `不支持的父级字段: ${parentIdField}，允许的字段：${config.parentFields.join(', ') || '无'}`,
      );
    }
  }
}
