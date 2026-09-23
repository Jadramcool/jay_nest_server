import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  PERMISSIONS_KEY,
  PermissionMeta,
  extractPermissionCodes,
} from '../decorators/permissions.decorator';

interface UserWithPermissions {
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

    const requiredPermissions = extractPermissionCodes(requiredMetas);
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const { user } = context
      .switchToHttp()
      .getRequest<{ user?: UserWithPermissions }>();

    if (!user || !user.permissions) {
      return false;
    }

    return requiredPermissions.some((permission) =>
      user.permissions!.includes(permission),
    );
  }
}
