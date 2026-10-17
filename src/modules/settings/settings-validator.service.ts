import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import {
  allSettingKeys,
  getSettingDef,
  isSettingKey,
  SETTING_GROUP_ORDER,
} from './registry';
import {
  checkDefaultValue,
  parseSettingValue,
  serializeSettingValue,
  validateSettingValue,
} from './registry/value.util';

/**
 * 设置注册表启动校验。
 *
 * 目的:让"声明与实现不一致"或"库里残留已删除的设置"在启动阶段暴露,
 * 而不是等运营改了没反应。
 *
 * - 静态:默认值类型 / 必填项 / secret 规则 / 分组白名单 / min≤max
 * - 动态:DB 覆盖值里存在未声明的 key(ERROR)、无法解析或不合法的值(WARN)、env 项缺失(WARN)
 *
 * `SETTINGS_STRICT=true` 时 ERROR 直接阻止启动(生产建议开启)。
 */
@Injectable()
export class SettingsValidatorService implements OnModuleInit {
  private readonly logger = new Logger(SettingsValidatorService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    const errors: string[] = [];
    const warnings: string[] = [];

    this.validateRegistry(errors, warnings);
    await this.validateOverrides(errors, warnings);

    for (const warning of warnings) this.logger.warn(warning);

    if (errors.length > 0) {
      const message = `设置注册表校验失败:\n  - ${errors.join('\n  - ')}`;
      if (process.env.SETTINGS_STRICT === 'true') throw new Error(message);
      this.logger.error(message);
    }
  }

  private validateRegistry(errors: string[], warnings: string[]) {
    for (const key of allSettingKeys()) {
      const def = getSettingDef(key);
      const label = `设置 ${key}`;

      errors.push(
        ...checkDefaultValue(def).map((error) => `${label}: ${error}`),
      );

      if (!def.consumer) errors.push(`${label}: 未声明 consumer(消费方)`);
      if (!def.label) errors.push(`${label}: 缺少 label`);
      if (!SETTING_GROUP_ORDER.includes(def.group)) {
        errors.push(`${label}: 分组 ${def.group} 不在白名单内`);
      }
      if (def.expose === 'secret' && (def.source !== 'env' || !def.envKey)) {
        errors.push(`${label}: secret 必须由环境变量提供(source=env + envKey)`);
      }
      if (def.source === 'env' && !def.envKey) {
        errors.push(`${label}: source=env 必须声明 envKey`);
      }
      if (def.type === 'select' && !def.dictCode) {
        errors.push(`${label}: type=select 必须声明 dictCode`);
      }
      if (def.min !== undefined && def.max !== undefined && def.min > def.max) {
        errors.push(`${label}: min 大于 max`);
      }
      if (def.source === 'env' && def.envKey && !process.env[def.envKey]) {
        warnings.push(
          `${label}: 环境变量 ${def.envKey} 未配置,将使用默认值 ${serializeSettingValue(def, def.default)}`,
        );
      }
    }
  }

  private async validateOverrides(errors: string[], warnings: string[]) {
    let rows: { key: string; value: string | null }[];
    try {
      rows = await this.prisma.settingOverride.findMany({
        select: { key: true, value: true },
      });
    } catch {
      warnings.push('setting_override 表尚不可读,跳过覆盖值校验');
      return;
    }

    const orphans = rows.filter((row) => !isSettingKey(row.key));
    if (orphans.length > 0) {
      errors.push(
        `数据库存在未在注册表声明的设置(是否漏了声明?): ${orphans
          .map((row) => row.key)
          .join(', ')}`,
      );
    }

    for (const row of rows) {
      if (!isSettingKey(row.key) || row.value === null) continue;
      const def = getSettingDef(row.key);
      const parsed = parseSettingValue(def, row.value);
      if (parsed === undefined) {
        warnings.push(
          `设置 ${row.key} 的覆盖值无法按 ${def.type} 解析,已回退默认值`,
        );
        continue;
      }
      const valueErrors = validateSettingValue(def, parsed);
      if (valueErrors.length > 0) {
        warnings.push(
          `设置 ${row.key} 的覆盖值不合法(${valueErrors.join('; ')}),已回退默认值`,
        );
      }
    }
  }
}
