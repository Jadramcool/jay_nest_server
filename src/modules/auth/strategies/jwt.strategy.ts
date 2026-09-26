import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service';
import {
  resolveClientPlatform,
  visiblePlatforms,
} from '@/common/constants/platform';
import { getJwtSecret } from '@/common/utils/jwt-config.util';
import { SessionService } from '@/modules/session/session.service';

export interface JwtPayload {
  id: number;
  username: string;
  /** 登录端：admin | app | mp */
  platform?: string;
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

    const platform = resolveClientPlatform(payload.platform);
    const platforms = visiblePlatforms(platform);

    const user = await this.prisma.user.findUnique({
      where: { id: payload.id },
      select: {
        id: true,
        username: true,
        isDeleted: true,
        status: true,
        roles: {
          where: {
            role: { isDeleted: false, platform: { in: platforms } },
          },
          select: {
            role: {
              select: {
                id: true,
                code: true,
                isSystem: true,
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

    // 功能权限从菜单表 BUTTON 行的 permission 字段收集（按钮权限由菜单管理界面维护）
    // 只收集本端(含共享端 common)的权限，这是端之间天然隔离的关键
    let permissions: string[];
    if (isSystemAdmin) {
      const buttonMenus = await this.prisma.menu.findMany({
        where: {
          type: 'BUTTON',
          enable: true,
          permission: { not: null },
          platform: { in: platforms },
        },
        select: { permission: true },
      });
      permissions = [
        ...new Set(buttonMenus.map((menu) => menu.permission as string)),
      ];
    } else {
      const roleIds = user.roles.map((ur) => ur.role.id);
      const roleMenuRows = await this.prisma.roleMenu.findMany({
        where: {
          roleId: { in: roleIds },
          menu: {
            type: 'BUTTON',
            enable: true,
            permission: { not: null },
            platform: { in: platforms },
          },
        },
        select: { menu: { select: { permission: true } } },
      });
      permissions = [
        ...new Set(
          roleMenuRows
            .map((row) => row.menu.permission)
            .filter((permission): permission is string => Boolean(permission)),
        ),
      ];
    }

    return {
      userId: user.id,
      username: user.username,
      jti: payload.jti,
      platform,
      roles,
      permissions,
    };
  }
}
