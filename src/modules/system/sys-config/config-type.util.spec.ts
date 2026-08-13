import {
  parseConfigValue,
  serializeConfigValue,
  validateConfigValue,
} from './config-type.util';

describe('config-type.util', () => {
  describe('parseConfigValue(读取转强类型)', () => {
    it('should parse NUMBER to number', () => {
      expect(parseConfigValue('NUMBER', '42')).toBe(42);
      expect(parseConfigValue('NUMBER', 'abc')).toBeNull();
    });

    it('should parse BOOLEAN to boolean', () => {
      expect(parseConfigValue('BOOLEAN', 'true')).toBe(true);
      expect(parseConfigValue('BOOLEAN', '0')).toBe(false);
    });

    it('should parse JSON/ARRAY to object/array', () => {
      expect(parseConfigValue('JSON', '{"a":1}')).toEqual({ a: 1 });
      expect(parseConfigValue('ARRAY', '[1,2]')).toEqual([1, 2]);
      expect(parseConfigValue('JSON', 'invalid')).toBeNull();
    });

    it('should return raw string for STRING/EMAIL/URL/PASSWORD', () => {
      expect(parseConfigValue('STRING', 'hello')).toBe('hello');
      expect(parseConfigValue('PASSWORD', 'secret')).toBe('secret');
    });

    it('should return null for empty value', () => {
      expect(parseConfigValue('NUMBER', '')).toBeNull();
      expect(parseConfigValue('STRING', null)).toBeNull();
    });
  });

  describe('validateConfigValue(写入校验)', () => {
    it('should accept valid values', () => {
      expect(validateConfigValue('NUMBER', '42')).toEqual([]);
      expect(validateConfigValue('BOOLEAN', 'true')).toEqual([]);
      expect(validateConfigValue('JSON', '{"a":1}')).toEqual([]);
      expect(validateConfigValue('ARRAY', '[1]')).toEqual([]);
      expect(validateConfigValue('EMAIL', 'a@b.com')).toEqual([]);
      expect(validateConfigValue('URL', 'https://example.com')).toEqual([]);
    });

    it('should reject invalid values', () => {
      expect(validateConfigValue('NUMBER', 'abc')).toContain('必须是数字');
      expect(validateConfigValue('BOOLEAN', 'yes')).toContain(
        '必须是 true/false',
      );
      expect(validateConfigValue('JSON', '{bad}')).toContain(
        '必须是合法的 JSON',
      );
      expect(validateConfigValue('EMAIL', 'not-an-email')).toContain(
        '邮箱格式不正确',
      );
      expect(validateConfigValue('URL', 'ftp://x')).toContain('URL 格式不正确');
    });

    it('should apply options constraints', () => {
      expect(validateConfigValue('NUMBER', '5', { min: 1, max: 10 })).toEqual(
        [],
      );
      expect(validateConfigValue('NUMBER', '50', { max: 10 })).toContain(
        '不能大于 10',
      );
      expect(
        validateConfigValue('STRING', 'abc', { pattern: '^[0-9]+$' }),
      ).toContain('不符合格式要求');
      expect(
        validateConfigValue('STRING', 'x', { enum: ['a', 'b'] }),
      ).toContain('只能是: a / b');
    });

    it('should allow empty value', () => {
      expect(validateConfigValue('NUMBER', '')).toEqual([]);
      expect(validateConfigValue('EMAIL', null)).toEqual([]);
    });
  });

  describe('serializeConfigValue(写入转字符串)', () => {
    it('should stringify objects', () => {
      expect(serializeConfigValue({ a: 1 })).toBe('{"a":1}');
      expect(serializeConfigValue([1, 2])).toBe('[1,2]');
    });

    it('should stringify others', () => {
      expect(serializeConfigValue(42)).toBe('42');
      expect(serializeConfigValue(true)).toBe('true');
    });
  });
});
