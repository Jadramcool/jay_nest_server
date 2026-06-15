type QueryOperator =
  | 'eq'
  | 'contains'
  | 'startsWith'
  | 'endsWith'
  | 'in'
  | 'notIn'
  | 'not'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte';

export type FieldConfig =
  | QueryOperator
  | {
      operator?: QueryOperator;
      /** 映射到不同的字段名 */
      field?: string;
      /** 值转换函数，对原始值做预处理再传给操作符 */
      transform?: (value: any) => any;
      /**
       * 关联查询路径，配合 relationField 生成 Prisma relation 过滤。
       * 例: { relation: 'roles', relationField: 'roleId', operator: 'in' }
       * → roles: { some: { roleId: { in: [1,2] } } }
       */
      relation?: string;
      /** 关联模型上的查询字段，默认取 key */
      relationField?: string;
    };

type FieldMap<T> = Partial<Record<keyof T, FieldConfig>>;

const OPERATOR_HANDLERS: Record<
  QueryOperator,
  (value: unknown) => Record<string, unknown>
> = {
  eq: (value) => value as Record<string, unknown>,
  contains: (value) => ({ contains: value }),
  startsWith: (value) => ({ startsWith: value }),
  endsWith: (value) => ({ endsWith: value }),
  in: (value) => ({ in: toArray(value) }),
  notIn: (value) => ({ notIn: toArray(value) }),
  not: (value) => ({ not: value }),
  gt: (value) => ({ gt: value }),
  gte: (value) => ({ gte: value }),
  lt: (value) => ({ lt: value }),
  lte: (value) => ({ lte: value }),
};

/** 将值统一转为数组：数组直接返回，逗号分隔字符串拆分，单个值包装为数组 */
function toArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.includes(',')) {
    return value.split(',').map((s) => {
      const trimmed = s.trim();
      return /^\d+$/.test(trimmed) ? Number(trimmed) : trimmed;
    });
  }
  return [value];
}

/** 从 key 中解析出可能的 __ 操作符后缀，如 role__in → { field: 'role', operator: 'in' } */
function parseKey(key: string): { field: string; operator?: QueryOperator } {
  const idx = key.lastIndexOf('__');
  if (idx === -1) return { field: key };
  const suffix = key.slice(idx + 2) as QueryOperator;
  if (suffix in OPERATOR_HANDLERS) {
    return { field: key.slice(0, idx), operator: suffix };
  }
  return { field: key };
}

export function buildQueryWhere<T extends object>(
  dto: T,
  fieldMap: FieldMap<T>,
  extra?: Record<string, unknown>,
): Record<string, unknown> {
  const where: Record<string, unknown> = { ...extra };

  for (const key of Object.keys(fieldMap)) {
    const { field: actualField, operator: keyOperator } = parseKey(key);
    const config = fieldMap[key as keyof T];
    if (config === undefined) continue;

    // 检查 DTO 上是否有 __ 后缀覆盖（如 dto.username__eq）
    let operator =
      keyOperator ??
      (typeof config === 'string' ? config : (config.operator ?? 'eq'));
    let value = dto[actualField as keyof T];

    const dtoKey = Object.keys(dto).find((k) =>
      k.startsWith(actualField + '__'),
    );
    if (dtoKey) {
      const parsed = parseKey(dtoKey);
      value = dto[dtoKey as keyof T] ?? value;
      operator = parsed.operator ?? operator;
    }

    if (value === undefined || value === null || value === '') {
      continue;
    }

    const resolved: FieldConfig = config;
    if (typeof resolved === 'object' && resolved.relation) {
      const relationField = resolved.relationField ?? actualField;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const finalValue = resolved.transform ? resolved.transform(value) : value;
      const handler = OPERATOR_HANDLERS[operator];
      where[resolved.relation] = {
        some: { [relationField]: handler(finalValue) } as Record<
          string,
          unknown
        >,
      };
      continue;
    }

    const targetField =
      typeof resolved === 'object' && resolved.field
        ? resolved.field
        : actualField;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const finalValue =
      typeof resolved === 'object' && resolved.transform
        ? resolved.transform(value)
        : value;

    const handler = OPERATOR_HANDLERS[operator];
    where[targetField] = handler(finalValue);
  }

  return where;
}
