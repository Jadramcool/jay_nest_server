import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import {
  getSettingDef,
  isSettingKey,
  publicSettingKeys,
  SETTING_GROUP_ORDER,
  settings,
  sortedSettingKeys,
} from './registry';
import type { SettingDef, SettingKey, SettingValue } from './registry';
import {
  parseSettingValue,
  serializeSettingValue,
  validateSettingValue,
} from './registry/value.util';

/** 多实例失效:每实例最多这么久核对一次 setting_revision */
const REVISION_CHECK_TTL = 10_000;

/** 进程内单例修订号 id */
const REVISION_ROW_ID = 1;

export interface SettingView {
  key: string;
  label: string;
  group: string;
  type: string;
  description?: string;
  expose: 'public' | 'admin' | 'secret';
  source: 'default' | 'db' | 'env';
  readonly: boolean;
  overridden: boolean;
  /** expose=secret 时不回传值,只给是否已配置 */
  value: unknown;
  configured: boolean;
  defaultValue: unknown;
  version: number;
  updatedBy: number | null;
  updatedName: string | null;
  updatedTime: string | null;
  /** 覆盖值解析/校验失败(已回退默认值) */
  invalid: boolean;
}

export interface SettingHistoryItem {
  id: number;
  key: string;
  oldValue: string | null;
  newValue: string | null;
  version: number;
  source: string;
  reason: string | null;
  changedBy: number | null;
  changedName: string | null;
  changedTime: string;
}

export interface SettingSchemaGroup {
  group: string;
  items: {
    key: string;
    label: string;
    type: string;
    description?: string;
    expose: 'public' | 'admin' | 'secret';
    source: 'db' | 'env';
    readonly: boolean;
    default: unknown;
    min?: number;
    max?: number;
    dictCode?: string;
    order: number;
  }[];
}

export interface Actor {
  userId?: number;
  username?: string;
}

interface WriteOptions {
  actor?: Actor;
  reason?: string;
  expectedVersion?: number;
  source?: 'api' | 'rollback';
}

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);
  /** key → 生效值(已解析) */
  private readonly cache = new Map<string, unknown>();
  private cachedRevision = 0;
  private revisionCheckedAt = 0;

  constructor(private readonly prisma: PrismaService) {}

  // ───────────────────────── 读 ─────────────────────────

  /** 类型化读取设置(消费方使用) */
  async get<K extends SettingKey>(key: K): Promise<SettingValue<K>> {
    const def = getSettingDef(key);

    if (def.source === 'env') {
      const raw = def.envKey ? process.env[def.envKey] : undefined;
      const value =
        raw === undefined || raw === ''
          ? def.default
          : this.coerceEnvValue(def, raw);
      return value as SettingValue<K>;
    }

    await this.ensureCacheFresh();
    if (this.cache.has(key)) return this.cache.get(key) as SettingValue<K>;

    const row = await this.prisma.settingOverride.findUnique({
      where: { key },
    });
    const { value } = this.resolveValue(def, row?.value);
    this.cache.set(key, value);
    return value as SettingValue<K>;
  }

  /** 批量读取(单次查询,避免 N+1) */
  async getMany<K extends SettingKey>(
    keys: K[],
  ): Promise<{ [P in K]: SettingValue<P> }> {
    await this.ensureCacheFresh();
    const missing = keys.filter((key) => !this.cache.has(key));

    if (missing.length > 0) {
      const rows = await this.prisma.settingOverride.findMany({
        where: { key: { in: missing } },
      });
      const byKey = new Map(rows.map((row) => [row.key, row.value]));
      for (const key of missing) {
        const def = getSettingDef(key);
        const { value } = this.resolveValue(def, byKey.get(key));
        this.cache.set(key, value);
      }
    }

    const result = {} as { [P in K]: SettingValue<P> };
    for (const key of keys) {
      result[key] = this.cache.get(key) as never;
    }
    return result;
  }

  /** 管理页列表:全部注册项的生效值 + 来源 + 版本 */
  async listViews(group?: string): Promise<SettingView[]> {
    const rows = await this.prisma.settingOverride.findMany();
    const byKey = new Map(rows.map((row) => [row.key, row]));

    return sortedSettingKeys()
      .map((key) => this.toView(key, getSettingDef(key), byKey.get(key)))
      .filter((view) => !group || view.group === group);
  }

  /** 初始化管理的元数据(前端按注册表渲染,新增设置无需改前端) */
  schema(): { groups: SettingSchemaGroup[]; revision: number } {
    const groups: SettingSchemaGroup[] = [];
    for (const key of sortedSettingKeys()) {
      const def = getSettingDef(key);
      let bucket = groups.find((item) => item.group === def.group);
      if (!bucket) {
        bucket = { group: def.group, items: [] };
        groups.push(bucket);
      }
      bucket.items.push({
        key,
        label: def.label,
        type: def.type,
        description: def.description,
        expose: def.expose ?? 'admin',
        source: def.source ?? 'db',
        readonly: (def.source ?? 'db') === 'env',
        default: def.default,
        min: def.min,
        max: def.max,
        dictCode: def.dictCode,
        order: def.order ?? 99,
      });
    }
    groups.sort(
      (a, b) =>
        SETTING_GROUP_ORDER.indexOf(a.group as never) -
        SETTING_GROUP_ORDER.indexOf(b.group as never),
    );
    return { groups, revision: this.cachedRevision };
  }

  /** 匿名可读白名单(登录页/布局用) */
  async publicView(): Promise<Record<string, string>> {
    const result: Record<string, string> = {};
    for (const key of publicSettingKeys()) {
      const def = getSettingDef(key);
      const value = await this.get(key);
      result[key] = serializeSettingValue(def, value);
    }
    return result;
  }

  // ───────────────────────── 写 ─────────────────────────

  async set(
    key: string,
    value: unknown,
    options: WriteOptions = {},
  ): Promise<SettingView> {
    const def = this.requireWritable(key);
    const errors = await this.validateValue(def, value);
    if (errors.length > 0) {
      throw new BadRequestException(`设置值校验失败: ${errors.join('; ')}`);
    }

    const serialized = serializeSettingValue(def, value);
    const actor = options.actor;

    const { row, revision } = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.settingOverride.findUnique({ where: { key } });

      if (
        options.expectedVersion !== undefined &&
        existing &&
        existing.version !== options.expectedVersion
      ) {
        throw new ConflictException(
          `该设置已被他人修改(当前版本 ${existing.version})，请刷新后重试`,
        );
      }

      const nextVersion = await this.nextVersion(tx, key, existing?.version);
      const updated = await tx.settingOverride.upsert({
        where: { key },
        create: {
          key,
          value: serialized,
          version: nextVersion,
          updatedBy: actor?.userId ?? null,
          updatedName: actor?.username ?? null,
        },
        update: {
          value: serialized,
          version: nextVersion,
          updatedBy: actor?.userId ?? null,
          updatedName: actor?.username ?? null,
        },
      });

      await tx.settingHistory.create({
        data: {
          key,
          oldValue: existing ? this.historyValue(def, existing.value) : null,
          newValue: this.historyValue(def, serialized),
          version: nextVersion,
          source: options.source ?? 'api',
          reason: options.reason ?? null,
          changedBy: actor?.userId ?? null,
          changedName: actor?.username ?? null,
        },
      });

      const revisionRow = await tx.settingRevision.upsert({
        where: { id: REVISION_ROW_ID },
        create: { id: REVISION_ROW_ID, revision: 2n },
        update: { revision: { increment: 1 } },
      });

      return { row: updated, revision: revisionRow.revision };
    });

    this.invalidate(key, revision);
    this.logger.log(`设置已更新: ${key} (v${row.version})`);
    return this.toView(key, def, row);
  }

  /** 重置为注册表默认值(删除覆盖行) */
  async reset(key: string, options: WriteOptions = {}): Promise<SettingView> {
    const def = this.requireWritable(key);
    const actor = options.actor;

    const { revision } = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.settingOverride.findUnique({ where: { key } });
      if (!existing) return { revision: null as bigint | null };

      if (
        options.expectedVersion !== undefined &&
        existing.version !== options.expectedVersion
      ) {
        throw new ConflictException(
          `该设置已被他人修改(当前版本 ${existing.version})，请刷新后重试`,
        );
      }

      await tx.settingOverride.delete({ where: { key } });
      const resetVersion = await this.nextVersion(tx, key, existing.version);
      await tx.settingHistory.create({
        data: {
          key,
          oldValue: this.historyValue(def, existing.value),
          newValue: null,
          version: resetVersion,
          source: options.source ?? 'api',
          reason: options.reason ?? '重置为默认值',
          changedBy: actor?.userId ?? null,
          changedName: actor?.username ?? null,
        },
      });

      const revisionRow = await tx.settingRevision.upsert({
        where: { id: REVISION_ROW_ID },
        create: { id: REVISION_ROW_ID, revision: 2n },
        update: { revision: { increment: 1 } },
      });
      return { revision: revisionRow.revision };
    });

    if (revision !== null) this.invalidate(key, revision);
    return this.toView(key, def, undefined);
  }

  /**
   * 回滚某次修改:恢复到该版本**变更前**的值。
   *
   * 为什么不重放"变更后的值":历史里最新一条的变更后值就是当前值,
   * 重放它等于什么都没做(第一次修改后点回滚会"回滚成刚改的值")。
   * 变更前值为 null 表示当时用的是注册表默认值 → 等价于重置。
   */
  async rollback(
    key: string,
    version: number,
    options: WriteOptions = {},
  ): Promise<SettingView> {
    const def = this.requireWritable(key);
    const target = await this.prisma.settingHistory.findFirst({
      where: { key, version },
      orderBy: { changedTime: 'desc' },
    });
    if (!target) {
      throw new NotFoundException(`设置 ${key} 不存在版本 ${version} 的记录`);
    }

    const parsed = parseSettingValue(def, target.oldValue);
    if (parsed === undefined) {
      return this.reset(key, {
        ...options,
        source: 'rollback',
        reason: options.reason ?? `回滚 v${version} 的修改(恢复默认值)`,
      });
    }

    const restored = validateSettingValue(def, parsed);
    if (restored.length > 0) {
      throw new BadRequestException(
        `历史值不合法，无法回滚(${restored.join('; ')})`,
      );
    }

    return this.set(key, parsed, {
      ...options,
      source: 'rollback',
      expectedVersion: undefined,
      reason: options.reason ?? `回滚 v${version} 的修改`,
    });
  }

  async history(
    key: string,
    page = 1,
    pageSize = 20,
  ): Promise<{
    items: SettingHistoryItem[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    if (!isSettingKey(key)) {
      throw new NotFoundException(`设置 ${key} 未在注册表中声明`);
    }
    const safePageSize = Math.min(Math.max(pageSize, 1), 100);

    const [rows, total] = await Promise.all([
      this.prisma.settingHistory.findMany({
        where: { key },
        orderBy: { changedTime: 'desc' },
        skip: (Math.max(page, 1) - 1) * safePageSize,
        take: safePageSize,
      }),
      this.prisma.settingHistory.count({ where: { key } }),
    ]);

    return {
      items: rows.map((row) => ({
        id: row.id,
        key: row.key,
        oldValue: row.oldValue,
        newValue: row.newValue,
        version: row.version,
        source: row.source,
        reason: row.reason,
        changedBy: row.changedBy,
        changedName: row.changedName,
        changedTime: row.changedTime.toISOString(),
      })),
      total,
      page: Math.max(page, 1),
      pageSize: safePageSize,
    };
  }

  // ───────────────────────── 内部 ─────────────────────────

  /**
   * 该 key 的下一个版本号:覆盖值版本与历史最大版本取大者 +1。
   *
   * 必须把历史算进来 —— 重置会删掉覆盖值行,若只看覆盖值,重置后再保存会重新从 v1 计数,
   * 导致历史里同一 key 出现重复版本号,回滚按 (key, version) 就会命中错误的记录。
   */
  private async nextVersion(
    tx: Prisma.TransactionClient,
    key: string,
    currentVersion = 0,
  ): Promise<number> {
    const maxHistory = await tx.settingHistory.aggregate({
      where: { key },
      _max: { version: true },
    });
    return Math.max(currentVersion, maxHistory._max.version ?? 0) + 1;
  }

  private requireWritable(key: string): SettingDef {
    if (!isSettingKey(key)) {
      throw new NotFoundException(`设置 ${key} 未在注册表中声明`);
    }
    const def = getSettingDef(key);
    if ((def.source ?? 'db') === 'env') {
      throw new BadRequestException(
        `设置 ${key} 由环境变量${def.envKey ? ` ${def.envKey}` : ''}管理，不支持在线修改`,
      );
    }
    return def;
  }

  private async validateValue(
    def: SettingDef,
    value: unknown,
  ): Promise<string[]> {
    const allowed = def.dictCode
      ? await this.dictValues(def.dictCode)
      : undefined;
    return validateSettingValue(def, value, { allowed });
  }

  /** type=select 时从数据字典取允许值 */
  private async dictValues(dictCode: string): Promise<(string | number)[]> {
    const items = await this.prisma.dictItem.findMany({
      where: { type: { code: dictCode }, status: 1 },
      select: { code: true },
    });
    return items.map((item) => item.code);
  }

  private resolveValue(
    def: SettingDef,
    raw: string | null | undefined,
  ): { value: unknown; invalid: boolean } {
    if (raw === null || raw === undefined) {
      return { value: def.default, invalid: false };
    }
    const parsed = parseSettingValue(def, raw);
    if (parsed === undefined) {
      this.logger.warn(
        `设置 ${def.label} 的覆盖值无法解析，已回退默认值: ${String(raw).slice(0, 60)}`,
      );
      return { value: def.default, invalid: true };
    }
    const errors = validateSettingValue(def, parsed);
    if (errors.length > 0) {
      this.logger.warn(
        `设置 ${def.label} 的覆盖值不合法(${errors.join('; ')})，已回退默认值`,
      );
      return { value: def.default, invalid: true };
    }
    return { value: parsed, invalid: false };
  }

  private coerceEnvValue(def: SettingDef, raw: string): unknown {
    switch (def.type) {
      case 'number': {
        const num = Number(raw);
        return Number.isNaN(num) ? def.default : num;
      }
      case 'boolean':
        return raw === 'true' || raw === '1';
      case 'json':
      case 'string[]': {
        try {
          return JSON.parse(raw);
        } catch {
          return def.default;
        }
      }
      default:
        return raw;
    }
  }

  /** secret 设置的值不落库,历史里只存哈希 */
  private historyValue(def: SettingDef, value: string | null): string | null {
    if (value === null) return null;
    if (def.expose !== 'secret') return value;
    return `sha256:${createHash('sha256').update(value).digest('hex')}`;
  }

  private toView(
    key: string,
    def: SettingDef,
    row?: {
      key: string;
      value: string | null;
      version: number;
      updatedBy: number | null;
      updatedName: string | null;
      updatedTime: Date;
    },
  ): SettingView {
    const source: SettingView['source'] =
      (def.source ?? 'db') === 'env' ? 'env' : row ? 'db' : 'default';
    const resolved =
      source === 'env'
        ? { value: def.default, invalid: false }
        : this.resolveValue(def, row?.value);

    const isSecret = def.expose === 'secret';
    return {
      key,
      label: def.label,
      group: def.group,
      type: def.type,
      description: def.description,
      expose: def.expose ?? 'admin',
      source,
      readonly: source === 'env',
      overridden: Boolean(row),
      value: isSecret ? null : resolved.value,
      configured: isSecret
        ? Boolean(def.envKey && process.env[def.envKey])
        : true,
      defaultValue: def.default,
      version: row?.version ?? 0,
      updatedBy: row?.updatedBy ?? null,
      updatedName: row?.updatedName ?? null,
      updatedTime: row?.updatedTime ? row.updatedTime.toISOString() : null,
      invalid: resolved.invalid,
    };
  }

  /** 写入后失效缓存(单实例精确失效) */
  private invalidate(key: string, revision?: bigint) {
    this.cache.delete(key);
    if (revision !== undefined) this.cachedRevision = Number(revision);
    this.revisionCheckedAt = Date.now();
  }

  /** 多实例:按 TTL 核对修订号,变化则整体失效 */
  private async ensureCacheFresh() {
    if (Date.now() - this.revisionCheckedAt < REVISION_CHECK_TTL) return;
    this.revisionCheckedAt = Date.now();
    const row = await this.prisma.settingRevision.findUnique({
      where: { id: REVISION_ROW_ID },
    });
    const current = Number(row?.revision ?? 0);
    if (current !== this.cachedRevision) {
      this.cache.clear();
      this.cachedRevision = current;
    }
  }

  /** 供启动校验与测试使用 */
  registrySnapshot(): { key: SettingKey; def: SettingDef }[] {
    return (Object.keys(settings) as SettingKey[]).map((key) => ({
      key,
      def: getSettingDef(key),
    }));
  }
}
