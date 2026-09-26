import type { ClientPlatform } from '../constants/platform';
import { SetMetadata } from '@nestjs/common';

export const PLATFORM_KEY = 'platform';

/**
 * 端访问限制装饰器
 *
 * 声明后，只有对应端签发的 token 才能访问该接口（由 PermissionsGuard 统一校验）。
 * 端隔离的主要保障是"token 里只包含本端权限"，本装饰器用于显式声明与二次兜底。
 *
 * @example
 * @Platform('app')
 */
export const Platform = (...platforms: ClientPlatform[]) =>
  SetMetadata(PLATFORM_KEY, platforms);
