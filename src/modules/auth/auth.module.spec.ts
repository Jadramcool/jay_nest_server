import 'reflect-metadata';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { APP_GUARD } from '@nestjs/core';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { AuthModule } from './auth.module';

describe('AuthModule', () => {
  it('registers PermissionsGuard globally', () => {
    const providers = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      AuthModule,
    ) as unknown[];

    expect(providers).toEqual(
      expect.arrayContaining([
        {
          provide: APP_GUARD,
          useClass: PermissionsGuard,
        },
      ]),
    );
  });
});
