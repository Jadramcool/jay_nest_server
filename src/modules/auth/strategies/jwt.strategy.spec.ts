import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service';
import { SessionService } from '@/modules/session/session.service';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  const findUnique = jest.fn();
  let strategy: JwtStrategy;

  beforeEach(() => {
    jest.clearAllMocks();
    strategy = new JwtStrategy(
      {
        getOrThrow: jest.fn(
          () => 'test-jwt-secret-with-at-least-32-characters',
        ),
      } as unknown as ConfigService,
      {
        user: { findUnique },
      } as unknown as PrismaService,
      {
        isAccessRevoked: jest.fn(() => false),
      } as unknown as SessionService,
    );
  });

  it('rejects a refresh token used as an access token', async () => {
    await expect(
      strategy.validate({
        id: 1,
        username: 'admin',
        type: 'refresh',
      } as never),
    ).rejects.toThrow(UnauthorizedException);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('loads roles and permissions for an active access token', async () => {
    findUnique.mockResolvedValue({
      id: 1,
      username: 'admin',
      isDeleted: false,
      status: 1,
      roles: [
        {
          role: {
            code: 'ADMIN',
            menus: [
              { menu: { permission: 'system:user:list' } },
              { menu: { permission: null } },
            ],
          },
        },
      ],
    });

    await expect(
      strategy.validate({ id: 1, username: 'admin', type: 'access' }),
    ).resolves.toEqual({
      userId: 1,
      username: 'admin',
      roles: ['ADMIN'],
      permissions: ['system:user:list'],
    });
  });
});
