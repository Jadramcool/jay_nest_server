import * as fs from 'fs';
import * as path from 'path';

/**
 * DTO 类名唯一性契约测试。
 *
 * Swagger 按**类名**生成 components.schemas，两个模块出现同名 DTO 时，
 * 后注册的会覆盖先注册的，openapi.json 里就少了一份契约：
 * 前端 `typings/` 生成的类型会指向错误的字段集合，编译期完全看不出来。
 *
 * 已经踩过一次:auth 的 UpdateUserDto 覆盖了 system/user 的同名类,
 * 导致 `System.UserUpdatePayload` 描述的是「个人资料 + id」而真实接口收
 * `UpdateUserWithIdDto`(含 roleIds/status/departmentId)。
 */

const SRC_ROOT = path.resolve(__dirname, '../..');

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    if (!entry.name.endsWith('.ts')) return [];
    if (entry.name.endsWith('.spec.ts') || entry.name.endsWith('.d.ts'))
      return [];
    return [full];
  });
}

/** 收集每个导出 DTO 类名及其定义位置 */
function collectDtoClasses(): Map<string, string[]> {
  const byName = new Map<string, string[]>();

  for (const file of walk(SRC_ROOT)) {
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(/export class (\w*Dto)\b/g)) {
      const name = match[1];
      const location = path.relative(SRC_ROOT, file).replace(/\\/g, '/');
      byName.set(name, [...(byName.get(name) ?? []), location]);
    }
  }

  return byName;
}

describe('DTO 类名唯一性契约', () => {
  const byName = collectDtoClasses();

  it('至少扫到 DTO(避免扫描逻辑失效后静默通过)', () => {
    expect(byName.size).toBeGreaterThan(10);
  });

  it('不存在同名 DTO 类(同名会让 Swagger 覆盖其中一份)', () => {
    const collisions = [...byName.entries()]
      .filter(([, files]) => files.length > 1)
      .map(([name, files]) => `${name} → ${files.join(' , ')}`);

    expect(collisions).toEqual([]);
  });
});
