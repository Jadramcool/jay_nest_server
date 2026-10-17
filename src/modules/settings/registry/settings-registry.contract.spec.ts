import * as fs from 'fs';
import * as path from 'path';
import {
  allSettingKeys,
  publicSettingKeys,
  SETTING_GROUP_ORDER,
  settings,
} from './index';
import { checkDefaultValue } from './value.util';

/**
 * 设置注册表契约测试。
 *
 * 注册表是设置的唯一事实来源，一旦声明写错（少了 consumer、secret 写成 db、
 * 默认值类型不对），后果是运行期才暴露，所以这里全部前置到 CI。
 */

const REGISTRY_DIR = __dirname;
const NAMESPACED_KEY_RE = /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)+$/;

/** 扫源码里声明的 key，用于抓"同名 key 静默覆盖" */
function declaredKeys(): string[] {
  const keys: string[] = [];
  for (const file of fs.readdirSync(REGISTRY_DIR)) {
    if (!file.endsWith('.ts') || file.endsWith('.spec.ts')) continue;
    if (file === 'types.ts' || file === 'value.util.ts') continue;
    const source = fs.readFileSync(path.join(REGISTRY_DIR, file), 'utf8');
    for (const match of source.matchAll(/^\s*'([\w.]+)':\s*\{/gm)) {
      keys.push(match[1]);
    }
  }
  return keys;
}

describe('设置注册表契约', () => {
  const keys = allSettingKeys();

  it('至少声明了一项设置（避免注册表被清空后静默通过）', () => {
    expect(keys.length).toBeGreaterThan(0);
  });

  it('声明处没有重复 key（重复会被对象字面量静默覆盖）', () => {
    const declared = declaredKeys();
    const duplicated = declared.filter(
      (key, index) => declared.indexOf(key) !== index,
    );
    expect([...new Set(duplicated)]).toEqual([]);
    expect(new Set(declared).size).toBe(keys.length);
  });

  it('key 命名空间化', () => {
    const bad = keys.filter((key) => !NAMESPACED_KEY_RE.test(key));
    expect(bad).toEqual([]);
  });

  it('每项都有 label / group / default / consumer', () => {
    const problems = keys.flatMap((key) => {
      const def = settings[key];
      const missing: string[] = [];
      if (!def.label) missing.push('label');
      if (!def.group) missing.push('group');
      if (def.default === undefined) missing.push('default');
      if (!def.consumer) missing.push('consumer');
      return missing.length ? [`${key}: 缺少 ${missing.join('/')}`] : [];
    });
    expect(problems).toEqual([]);
  });

  it('group 必须在分组白名单内', () => {
    const bad = keys.filter(
      (key) => !SETTING_GROUP_ORDER.includes(settings[key].group),
    );
    expect(bad).toEqual([]);
  });

  it('默认值类型与声明类型一致', () => {
    const problems = keys.flatMap((key) => {
      const def = settings[key];
      return checkDefaultValue(def).map((error) => `${key}: ${error}`);
    });
    expect(problems).toEqual([]);
  });

  it('secret 必须来自环境变量（密钥不入库、不回读）', () => {
    const bad = keys.filter((key) => {
      const def = settings[key];
      if (def.expose !== 'secret') return false;
      return def.source !== 'env' || !def.envKey;
    });
    expect(bad).toEqual([]);
  });

  it('source=env 必须声明 envKey', () => {
    const bad = keys.filter((key) => {
      const def = settings[key];
      return def.source === 'env' && !def.envKey;
    });
    expect(bad).toEqual([]);
  });

  it('type=select 必须声明 dictCode（选项交给数据字典维护）', () => {
    const bad = keys.filter((key) => {
      const def = settings[key];
      return def.type === 'select' && !def.dictCode;
    });
    expect(bad).toEqual([]);
  });

  it('min 不大于 max', () => {
    const bad = keys.filter((key) => {
      const def = settings[key];
      return (
        def.min !== undefined && def.max !== undefined && def.min > def.max
      );
    });
    expect(bad).toEqual([]);
  });

  it('public 白名单只包含 expose=public 的项', () => {
    const publicKeys = publicSettingKeys();
    expect(publicKeys.every((key) => settings[key].expose === 'public')).toBe(
      true,
    );
    expect(publicKeys.length).toBeGreaterThan(0);
  });
});
