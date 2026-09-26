/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service';
import { SessionService } from '@/modules/session/session.service';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  const findUnique = jest.fn();
  const menuFindMany = jest.fn();
  const roleMenuFindMany = jest.fn();
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
        menu: { findMany: menuFindMany },
        roleMenu: { findMany: roleMenuFindMany },
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

  it('loads permissions from enabled button menus for a system admin', async () => {
    findUnique.mockResolvedValue({
      id: 1,
      username: 'admin',
      isDeleted: false,
      status: 1,
      roles: [{ role: { id: 1, code: 'ADMIN', isSystem: true } }],
    });
    menuFindMany.mockResolvedValue([
      { permission: 'system:user:list' },
      { permission: 'system:user:create' },
    ]);

    await expect(
      strategy.validate({ id: 1, username: 'admin', type: 'access' }),
    ).resolves.toEqual({
      userId: 1,
      username: 'admin',
      jti: undefined,
      platform: 'admin',
      roles: ['ADMIN'],
      permissions: ['system:user:list', 'system:user:create'],
    });
  });

  it('loads role-assigned button permissions for a normal user', async () => {
    findUnique.mockResolvedValue({
      id: 2,
      username: 'operator',
      isDeleted: false,
      status: 1,
      roles: [{ role: { id: 3, code: 'USER', isSystem: false } }],
    });
    roleMenuFindMany.mockResolvedValue([
      { menu: { permission: 'system:user:list' } },
      { menu: { permission: 'system:user:list' } },
      { menu: { permission: 'system:dict:list' } },
      { menu: { permission: null } },
    ]);

    await expect(
      strategy.validate({ id: 2, username: 'operator', type: 'access' }),
    ).resolves.toEqual({
      userId: 2,
      username: 'operator',
      jti: undefined,
      platform: 'admin',
      roles: ['USER'],
      permissions: ['system:user:list', 'system:dict:list'],
    });
    expect(menuFindMany).not.toHaveBeenCalled();
  });

  it('filters roles and permissions by the token platform', async () => {
    findUnique.mockResolvedValue({
      id: 2,
      username: 'operator',
      isDeleted: false,
      status: 1,
      roles: [{ role: { id: 3, code: 'APP', isSystem: false } }],
    });
    roleMenuFindMany.mockResolvedValue([
      { menu: { permission: 'app:report:generate' } },
      { menu: { permission: 'app:report:download' } },
    ]);

    await expect(
      strategy.validate({
        id: 2,
        username: 'operator',
        platform: 'app',
        type: 'access',
      }),
    ).resolves.toMatchObject({
      platform: 'app',
      roles: ['APP'],
      permissions: ['app:report:generate', 'app:report:download'],
    });

    // 角色按端过滤（本端 + 共享端）
    const userQuery = findUnique.mock.calls[0][0] as {
      select: { roles: { where: { role: unknown } } };
    };
    expect(userQuery.select.roles.where.role).toEqual({
      isDeleted: false,
      platform: { in: ['app', 'common'] },
    });

    // 按钮权限同样按端过滤
    const menuQuery = roleMenuFindMany.mock.calls[0][0] as {
      where: { menu: unknown };
    };
    expect(menuQuery.where.menu).toMatchObject({
      type: 'BUTTON',
      platform: { in: ['app', 'common'] },
    });
  });
});
