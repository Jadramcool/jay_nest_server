import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DiscoveryService, Reflector } from '@nestjs/core';
import { PrismaService } from '@/prisma/prisma.service';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

interface PermissionSeed {
  code: string;
  controller: string;
  method: string;
  route: string;
}

@Injectable()
export class PermissionSeedService implements OnModuleInit {
  private readonly logger = new Logger(PermissionSeedService.name);

  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    try {
      const seeds = this.scanPermissions();
      if (seeds.length === 0) {
        this.logger.warn('未发现任何 @RequirePermissions 装饰器');
        return;
      }
      await this.syncToDatabase(seeds);
    } catch (error) {
      this.logger.error(
        '权限种子同步失败',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private scanPermissions(): PermissionSeed[] {
    const seeds: PermissionSeed[] = [];
    const controllers = this.discoveryService.getControllers();

    for (const wrapper of controllers) {
      if (!wrapper.metatype) continue;

      const controller = wrapper.metatype;
      const controllerName = controller.name;
      const controllerPath =
        this.reflector.get<string[]>('path', controller)?.[0] || '';

      const prototype = controller.prototype as Record<
        string,
        (...args: unknown[]) => unknown
      >;
      const methodNames = Object.getOwnPropertyNames(prototype).filter(
        (name) =>
          name !== 'constructor' && typeof prototype[name] === 'function',
      );

      for (const methodName of methodNames) {
        const method = prototype[methodName];
        const permissions = this.reflector.get<string[]>(
          PERMISSIONS_KEY,
          method,
        );

        if (!permissions || permissions.length === 0) continue;

        const methodPath =
          this.reflector.get<string[]>('path', method)?.[0] || '';

        for (const code of permissions) {
          seeds.push({
            code,
            controller: controllerName,
            method: methodName,
            route: `/${controllerPath}/${methodPath}`.replace(/\/+/g, '/'),
          });
        }
      }
    }

    return seeds;
  }

  private async syncToDatabase(seeds: PermissionSeed[]) {
    const existingMenus = await this.prisma.menu.findMany({
      where: { code: { in: seeds.map((s) => s.code) } },
      select: { id: true, code: true, name: true, type: true },
    });

    const existingCodeSet = new Set(existingMenus.map((m) => m.code));
    const missingSeeds = seeds.filter((s) => !existingCodeSet.has(s.code));

    if (missingSeeds.length === 0) {
      this.logger.log(`权限种子同步完成：${seeds.length} 个权限码均已存在`);
      return;
    }

    const uniqueMissing = [
      ...new Map(missingSeeds.map((s) => [s.code, s])).values(),
    ];

    for (const seed of uniqueMissing) {
      await this.prisma.menu.create({
        data: {
          name: seed.code,
          code: seed.code,
          type: 'BUTTON',
          pid: null,
          path: null,
          method: '',
          layout: '',
          enable: true,
          show: false,
          needLogin: true,
          order: 0,
        },
      });
    }

    this.logger.log(
      `权限种子同步完成：新增 ${uniqueMissing.length} 个权限码 [${uniqueMissing.map((s) => s.code).join(', ')}]`,
    );
  }
}
