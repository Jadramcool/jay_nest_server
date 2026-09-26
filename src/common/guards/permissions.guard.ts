import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { ClientPlatform } from '../constants/platform';
import {
  PERMISSIONS_KEY,
  PermissionMeta,
  extractPermissionCodes,
} from '../decorators/permissions.decorator';
import { PLATFORM_KEY } from '../decorators/platform.decorator';

interface UserWithPermissions {
  platform?: ClientPlatform;
  permissions?: string[];
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredMetas = this.reflector.getAllAndOverride<PermissionMeta[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    const { user } = context
      .switchToHttp()
      .getRequest<{ user?: UserWithPermissions }>();

    // 端校验:声明了 @Platform 的接口只接受对应端签发的 token
    const requiredPlatforms = this.reflector.getAllAndOverride<
      ClientPlatform[]
    >(PLATFORM_KEY, [context.getHandler(), context.getClass()]);
    if (requiredPlatforms?.length) {
      if (!user?.platform || !requiredPlatforms.includes(user.platform)) {
        return false;
      }
    }

    const requiredPermissions = extractPermissionCodes(requiredMetas);
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    if (!user || !user.permissions) {
      return false;
    }

    return requiredPermissions.some((permission) =>
      user.permissions!.includes(permission),
    );
  }
}
