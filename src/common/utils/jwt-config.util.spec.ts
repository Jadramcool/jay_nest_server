import { ConfigService } from '@nestjs/config';
import { getJwtSecret } from './jwt-config.util';

describe('getJwtSecret', () => {
  it('returns a sufficiently long configured secret', () => {
    const secret = 'a-secure-random-jwt-secret-with-32-chars';
    const config = {
      getOrThrow: jest.fn(() => secret),
    } as unknown as ConfigService;

    expect(getJwtSecret(config)).toBe(secret);
  });

  it.each(['your-secret-key', 'too-short'])(
    'rejects weak secret %s',
    (secret) => {
      const config = {
        getOrThrow: jest.fn(() => secret),
      } as unknown as ConfigService;

      expect(() => getJwtSecret(config)).toThrow(/JWT_SECRET/);
    },
  );
});
