import { paginate } from '@/common/utils/pagination.util';
import { buildQueryWhere } from '@/common/utils/query-where.util';
import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { Prisma, SysConfig } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import {
  CreateSysConfigDto,
  UpdateSysConfigDto,
  QuerySysConfigDto,
} from './dto';

@Injectable()
export class SysConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createSysConfigDto: CreateSysConfigDto) {
    const { key } = createSysConfigDto;

    const existingConfig = await this.prisma.sysConfig.findUnique({
      where: { key },
    });

    if (existingConfig) {
      throw new BadRequestException('配置键已存在');
    }

    const config = await this.prisma.sysConfig.create({
      data: createSysConfigDto,
    });

    return this.formatConfig(config);
  }

  async findAll(querySysConfigDto: QuerySysConfigDto) {
    const { page = 1, pageSize = 20 } = querySysConfigDto;

    const where: Prisma.SysConfigWhereInput = {
      ...buildQueryWhere(querySysConfigDto, {
        name: 'contains',
        key: 'contains',
        type: 'eq',
        category: 'eq',
        isPublic: 'eq',
        isSystem: 'eq',
      }),
    };

    const [configs, total] = await Promise.all([
      this.prisma.sysConfig.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.sysConfig.count({ where }),
    ]);

    return paginate(
      configs.map((config) => this.formatConfig(config)),
      { page, pageSize, total },
    );
  }

  async findOne(id: number) {
    const config = await this.prisma.sysConfig.findUnique({
      where: { id },
    });

    if (!config) {
      throw new NotFoundException(`配置 ID ${id} 不存在`);
    }

    return this.formatConfig(config);
  }

  async findByKey(key: string) {
    const config = await this.prisma.sysConfig.findUnique({
      where: { key },
    });

    if (!config) {
      throw new NotFoundException(`配置键 ${key} 不存在`);
    }

    return this.formatConfig(config);
  }

  async findByCategory(category: string) {
    const configs = await this.prisma.sysConfig.findMany({
      where: { category },
      orderBy: { sortOrder: 'asc' },
    });

    return configs.map((config) => this.formatConfig(config));
  }

  async update(id: number, updateSysConfigDto: UpdateSysConfigDto) {
    const config = await this.prisma.sysConfig.findUnique({
      where: { id },
    });

    if (!config) {
      throw new NotFoundException(`配置 ID ${id} 不存在`);
    }

    if (updateSysConfigDto.key) {
      const existingConfig = await this.prisma.sysConfig.findFirst({
        where: {
          id: { not: id },
          key: updateSysConfigDto.key,
        },
      });

      if (existingConfig) {
        throw new BadRequestException('配置键已存在');
      }
    }

    const updatedConfig = await this.prisma.sysConfig.update({
      where: { id },
      data: updateSysConfigDto,
    });

    return this.formatConfig(updatedConfig);
  }

  async remove(id: number) {
    const config = await this.prisma.sysConfig.findUnique({
      where: { id },
    });

    if (!config) {
      throw new NotFoundException(`配置 ID ${id} 不存在`);
    }

    if (config.isSystem) {
      throw new BadRequestException('系统配置无法删除');
    }

    await this.prisma.sysConfig.delete({
      where: { id },
    });

    return { id };
  }

  async findPublic() {
    const configs = await this.prisma.sysConfig.findMany({
      where: { isPublic: true },
      orderBy: { sortOrder: 'asc' },
    });
    return configs.map((config) => this.formatConfig(config));
  }

  async batchRemove(ids: number[]) {
    const systemConfigs = await this.prisma.sysConfig.findMany({
      where: { id: { in: ids }, isSystem: true },
    });
    if (systemConfigs.length > 0) {
      throw new BadRequestException('包含系统配置，无法删除');
    }
    await this.prisma.sysConfig.deleteMany({
      where: { id: { in: ids } },
    });
    return { ids };
  }

  async updateStatus(id: number, status: number) {
    const config = await this.prisma.sysConfig.findUnique({
      where: { id },
    });
    if (!config) {
      throw new NotFoundException(`配置 ID ${id} 不存在`);
    }
    await this.prisma.sysConfig.update({
      where: { id },
      data: { isPublic: status === 1 },
    });
    return { id, status };
  }

  async validatePassword(password: string) {
    const defaultPassword = process.env.DEFAULT_PASSWORD || '';
    if (!defaultPassword) {
      return { valid: false };
    }
    const valid = await bcrypt.compare(password, defaultPassword);
    return { valid };
  }

  private formatConfig(config: SysConfig) {
    return {
      id: config.id,
      name: config.name,
      key: config.key,
      value: config.value,
      type: config.type,
      description: config.description,
      category: config.category,
      isPublic: config.isPublic,
      isSystem: config.isSystem,
      sortOrder: config.sortOrder,
      createdTime: config.createdTime,
      updatedTime: config.updatedTime,
    };
  }
}
