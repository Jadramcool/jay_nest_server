import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import {
  CreateDictTypeDto,
  UpdateDictTypeDto,
  QueryDictTypeDto,
} from './dto/dict-type.dto';
import {
  CreateDictItemDto,
  UpdateDictItemDto,
  QueryDictItemDto,
} from './dto/dict-item.dto';

@Injectable()
export class DictService {
  constructor(private readonly prisma: PrismaService) {}

  // ═══════════ 字典类型 ═══════════

  async findTypes(query: QueryDictTypeDto) {
    const { page = 1, pageSize = 20, code, name, status } = query;
    const where: Prisma.DictTypeWhereInput = {
      isDeleted: false,
      ...(code ? { code: { contains: code } } : {}),
      ...(name ? { name: { contains: name } } : {}),
      ...(status !== undefined ? { status } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.dictType.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { id: 'asc' },
        include: {
          _count: { select: { items: { where: { isDeleted: false } } } },
        },
      }),
      this.prisma.dictType.count({ where }),
    ]);

    return {
      items: items.map(({ _count, ...type }) => ({
        ...type,
        itemCount: _count.items,
      })),
      total,
      page,
      pageSize,
    };
  }

  async findAllTypes() {
    return this.prisma.dictType.findMany({
      where: { isDeleted: false, status: 1 },
      orderBy: { id: 'asc' },
      select: { id: true, code: true, name: true },
    });
  }

  async createType(dto: CreateDictTypeDto) {
    // 查重包含软删记录：唯一索引仍被其占用，放行会在 DB 层触发 P2002(409)
    const existing = await this.prisma.dictType.findFirst({
      where: { code: dto.code },
    });
    if (existing) {
      throw new BadRequestException(
        existing.isDeleted
          ? `字典类型编码「${dto.code}」已被已删除数据占用，请更换编码或联系管理员清理`
          : `字典类型编码「${dto.code}」已存在`,
      );
    }
    return this.prisma.dictType.create({
      data: {
        code: dto.code,
        name: dto.name,
        status: dto.status ?? 1,
        remark: dto.remark,
      },
    });
  }

  async updateType(dto: UpdateDictTypeDto) {
    const { id, ...data } = dto;
    const type = await this.prisma.dictType.findFirst({
      where: { id, isDeleted: false },
    });
    if (!type) {
      throw new NotFoundException(`字典类型 ID ${id} 不存在`);
    }
    if (data.code) {
      const conflict = await this.prisma.dictType.findFirst({
        where: { code: data.code, id: { not: id } },
      });
      if (conflict) {
        throw new BadRequestException(
          conflict.isDeleted
            ? `字典类型编码「${data.code}」已被已删除数据占用，请更换编码或联系管理员清理`
            : `字典类型编码「${data.code}」已存在`,
        );
      }
    }
    return this.prisma.dictType.update({ where: { id }, data });
  }

  /** 软删类型及其字典项 */
  async removeType(id: number) {
    const type = await this.prisma.dictType.findFirst({
      where: { id, isDeleted: false },
    });
    if (!type) {
      throw new NotFoundException(`字典类型 ID ${id} 不存在`);
    }
    await this.prisma.$transaction([
      this.prisma.dictItem.updateMany({
        where: { typeId: id, isDeleted: false },
        data: { isDeleted: true },
      }),
      this.prisma.dictType.update({
        where: { id },
        data: { isDeleted: true },
      }),
    ]);
    return { id };
  }

  async updateTypeStatus(id: number, status: number) {
    const type = await this.prisma.dictType.findFirst({
      where: { id, isDeleted: false },
    });
    if (!type) {
      throw new NotFoundException(`字典类型 ID ${id} 不存在`);
    }
    return this.prisma.dictType.update({ where: { id }, data: { status } });
  }

  // ═══════════ 字典项 ═══════════

  async findItems(query: QueryDictItemDto) {
    const {
      page = 1,
      pageSize = 20,
      typeId,
      typeCode,
      keyword,
      status,
    } = query;
    const where: Prisma.DictItemWhereInput = {
      isDeleted: false,
      ...(typeId !== undefined ? { typeId } : {}),
      ...(typeCode ? { type: { code: typeCode, isDeleted: false } } : {}),
      ...(keyword
        ? {
            OR: [
              { code: { contains: keyword } },
              { label: { contains: keyword } },
            ],
          }
        : {}),
      ...(status !== undefined ? { status } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.dictItem.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        include: { type: { select: { id: true, code: true, name: true } } },
      }),
      this.prisma.dictItem.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  /** 按类型编码取启用项(前端字典下拉使用) */
  async itemsByCode(code: string) {
    const type = await this.prisma.dictType.findFirst({
      where: { code, isDeleted: false, status: 1 },
    });
    if (!type) {
      return [];
    }
    return this.prisma.dictItem.findMany({
      where: { typeId: type.id, isDeleted: false, status: 1 },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      select: { id: true, code: true, label: true, sortOrder: true },
    });
  }

  async createItem(dto: CreateDictItemDto) {
    const type = await this.prisma.dictType.findFirst({
      where: { id: dto.typeId, isDeleted: false },
    });
    if (!type) {
      throw new BadRequestException(`字典类型 ID ${dto.typeId} 不存在`);
    }
    const existing = await this.prisma.dictItem.findFirst({
      where: { typeId: dto.typeId, code: dto.code },
    });
    if (existing) {
      throw new BadRequestException(
        existing.isDeleted
          ? `字典项编码「${dto.code}」在该类型下已被已删除数据占用，请更换编码或联系管理员清理`
          : `字典项编码「${dto.code}」在该类型下已存在`,
      );
    }
    return this.prisma.dictItem.create({
      data: {
        typeId: dto.typeId,
        code: dto.code,
        label: dto.label,
        sortOrder: dto.sortOrder ?? 0,
        status: dto.status ?? 1,
      },
    });
  }

  async updateItem(dto: UpdateDictItemDto) {
    const { id, ...data } = dto;
    const item = await this.prisma.dictItem.findFirst({
      where: { id, isDeleted: false },
    });
    if (!item) {
      throw new NotFoundException(`字典项 ID ${id} 不存在`);
    }
    if (data.code) {
      const conflict = await this.prisma.dictItem.findFirst({
        where: {
          typeId: item.typeId,
          code: data.code,
          id: { not: id },
        },
      });
      if (conflict) {
        throw new BadRequestException(
          conflict.isDeleted
            ? `字典项编码「${data.code}」在该类型下已被已删除数据占用，请更换编码或联系管理员清理`
            : `字典项编码「${data.code}」在该类型下已存在`,
        );
      }
    }
    return this.prisma.dictItem.update({ where: { id }, data });
  }

  async removeItem(id: number) {
    const item = await this.prisma.dictItem.findFirst({
      where: { id, isDeleted: false },
    });
    if (!item) {
      throw new NotFoundException(`字典项 ID ${id} 不存在`);
    }
    return this.prisma.dictItem.update({
      where: { id },
      data: { isDeleted: true },
    });
  }

  async updateItemStatus(id: number, status: number) {
    const item = await this.prisma.dictItem.findFirst({
      where: { id, isDeleted: false },
    });
    if (!item) {
      throw new NotFoundException(`字典项 ID ${id} 不存在`);
    }
    return this.prisma.dictItem.update({ where: { id }, data: { status } });
  }
}
