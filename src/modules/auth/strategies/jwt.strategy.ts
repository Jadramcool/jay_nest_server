import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service';
import { getJwtSecret } from '@/common/utils/jwt-config.util';
import { SessionService } from '@/modules/session/session.service';

export interface JwtPayload {
  id: number;
  username: string;
  type: 'access';
  jti?: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private sessionService: SessionService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: getJwtSecret(configService),
    });
  }

  async validate(payload: JwtPayload) {
    if (!payload.id || payload.type !== 'access') {
      throw new UnauthorizedException('无效的Token');
    }

    // 强制下线黑名单检查
    if (this.sessionService.isAccessRevoked(payload.jti)) {
      throw new UnauthorizedException('登录状态已失效，请重新登录');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.id },
      select: {
        id: true,
        username: true,
        isDeleted: true,
        status: true,
        roles: {
          where: {
            role: { isDeleted: false },
          },
          include: {
            role: {
              select: {
                code: true,
                isSystem: true,
                menus: {
                  where: { menu: { enable: true } },
                  include: {
                    menu: { select: { permission: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user || user.isDeleted) {
      throw new UnauthorizedException('用户不存在或已删除');
    }

    if (user.status !== 1) {
      throw new UnauthorizedException('用户已被禁用');
    }

    const roles = user.roles.map((ur) => ur.role.code);

    const isSystemAdmin = user.roles.some((ur) => ur.role.isSystem);

    let permissions: string[];
    if (isSystemAdmin) {
      const menus = await this.prisma.menu.findMany({
        where: { enable: true, permission: { not: null } },
        select: { permission: true },
      });
      permissions = [
        ...new Set(
          menus
            .map((menu) => menu.permission)
            .filter((permission): permission is string => Boolean(permission)),
        ),
      ];
    } else {
      permissions = [
        ...new Set(
          user.roles.flatMap((ur) =>
            ur.role.menus
              .map((rm) => rm.menu.permission)
              .filter((permission): permission is string =>
                Boolean(permission),
              ),
          ),
        ),
      ];
    }

    return {
      userId: user.id,
      username: user.username,
      roles,
      permissions,
    };
  }
}
