import * as fs from 'fs';
import * as path from 'path';
import { plainToInstance } from 'class-transformer';

/**
 * 布尔查询参数契约测试。
 *
 * 全局 ValidationPipe 打开了 enableImplicitConversion，class-transformer 对
 * Boolean 目标类型直接 `Boolean(value)`，于是查询串里的 'false' / '0' 会变成 true。
 * 只有用 @QueryBoolean() 显式转换才正确。
 *
 * 该测试扫描所有 query-*.dto.ts，对其中每个 `xxx: boolean` 字段断言字符串
 * 'false' 必须解析为 false —— 以后新增布尔查询字段忘了用装饰器会直接失败。
 */

const SRC_ROOT = path.resolve(__dirname, '../..');

/** 'false' / '0' 这类「假值」字符串必须解析成 false */
const FALSY_STRINGS = ['false', '0'];

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.name.startsWith('query-') && entry.name.endsWith('.dto.ts')
      ? [full]
      : [];
  });
}

/** 按 export class 切分文件，取出每个类自己声明的布尔字段 */
function collectBooleanFields(source: string): Map<string, string[]> {
  const result = new Map<string, string[]>();
  const classMatches = [...source.matchAll(/export class (\w+)[^{]*\{/g)];

  classMatches.forEach((match, index) => {
    const bodyStart = (match.index ?? 0) + match[0].length;
    const bodyEnd =
      index + 1 < classMatches.length
        ? (classMatches[index + 1].index ?? source.length)
        : source.length;
    const body = source.slice(bodyStart, bodyEnd);
    const fields = [...body.matchAll(/^ {2}(\w+)\??:\s*boolean\b/gm)].map(
      (field) => field[1],
    );
    if (fields.length > 0) result.set(match[1], fields);
  });

  return result;
}

describe('布尔查询参数契约', () => {
  const dtoFiles = walk(SRC_ROOT).filter(
    (file) => !file.endsWith('.spec.ts') && !file.endsWith('.d.ts'),
  );

  it('至少扫到一个 query DTO 文件(避免扫描逻辑失效后静默通过)', () => {
    expect(dtoFiles.length).toBeGreaterThan(0);
  });

  it.each(dtoFiles)('%s 的布尔字段能把 "false" 解析为 false', (file) => {
    const source = fs.readFileSync(file, 'utf8');
    const exported = jest.requireActual<Record<string, unknown>>(file);

    for (const [className, fields] of collectBooleanFields(source)) {
      const dtoClass = exported[className] as
        | (new () => Record<string, unknown>)
        | undefined;
      expect(dtoClass).toBeDefined();

      for (const field of fields) {
        for (const falsy of FALSY_STRINGS) {
          const instance = plainToInstance(
            dtoClass!,
            { [field]: falsy },
            {
              enableImplicitConversion: true,
            },
          );
          // 断言里带上文件/字段/输入，失败时一眼看出是谁漏了 @QueryBoolean()
          expect({
            file: path.basename(file),
            field,
            input: falsy,
            parsed: instance[field],
          }).toEqual({
            file: path.basename(file),
            field,
            input: falsy,
            parsed: false,
          });
        }

        expect(
          plainToInstance(
            dtoClass!,
            { [field]: 'true' },
            {
              enableImplicitConversion: true,
            },
          )[field],
        ).toBe(true);
      }
    }
  });
});
