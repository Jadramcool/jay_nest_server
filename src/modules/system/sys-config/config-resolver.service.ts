import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { parseConfigValue } from './config-type.util';

/**
 * 系统配置解析器(业务消费方使用)
 *
 * - 类型化读取:value 按配置 type 解析为强类型(NUMBER→number、JSON→object...)
 * - 内存缓存:读取走缓存,写入/删除由 SysConfigService 调用 invalidate 失效
 * - 单实例有效(与限流/会话一致);多实例部署需替换 Redis
 */
const CACHE_TTL = 5 * 60 * 1000; // 5 分钟

@Injectable()
export class ConfigResolverService {
  private readonly cache = new Map<
    string,
    { value: unknown; expiresAt: number }
  >();

  constructor(private readonly prisma: PrismaService) {}

  /** 类型化读取单个配置(不存在或解析失败时返回 fallback ?? null) */
  async get<T = unknown>(key: string, fallback?: T): Promise<T> {
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value as T;
    }

    const config = await this.prisma.sysConfig.findUnique({ where: { key } });
    const value = config
      ? parseConfigValue(config.type, config.value)
      : (fallback ?? null);
    this.cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL });
    return value as T;
  }

  /** 批量类型化读取 */
  async getMany<T = Record<string, unknown>>(keys: string[]): Promise<T> {
    const result: Record<string, unknown> = {};
    for (const key of keys) {
      result[key] = await this.get(key);
    }
    return result as T;
  }

  /** 失效缓存(配置写入/删除后调用;不传 key 清空全部) */
  invalidate(key?: string) {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }
}
