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
      throw error;
    }
  }

  private scanPermissions(): PermissionSeed[] {
    const seeds: PermissionSeed[] = [];
    const controllers = this.discoveryService.getControllers();

    for (const wrapper of controllers) {
      if (!wrapper.metatype) continue;

      const controller = wrapper.metatype;
      const controllerName = controller.name;
      const controllerPath = this.getPath(
        this.reflector.get<string | string[]>('path', controller),
      );

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

        const methodPath = this.getPath(
          this.reflector.get<string | string[]>('path', method),
        );

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
    const uniqueSeeds = [
      ...new Map(seeds.map((seed) => [seed.code, seed])).values(),
    ];
    const codes = uniqueSeeds.map((seed) => seed.code);
    const existingMenus = await this.prisma.menu.findMany({
      where: {
        OR: [{ code: { in: codes } }, { permission: { in: codes } }],
      },
      select: { id: true, code: true, permission: true },
    });

    const permissionMenuIds: number[] = [];
    let createdCount = 0;
    for (const seed of uniqueSeeds) {
      const existing = existingMenus.find(
        (menu) => menu.permission === seed.code || menu.code === seed.code,
      );
      if (existing) {
        permissionMenuIds.push(existing.id);
        if (existing.permission !== seed.code) {
          await this.prisma.menu.update({
            where: { id: existing.id },
            data: { permission: seed.code },
          });
        }
        continue;
      }

      const created = await this.prisma.menu.create({
        data: {
          name: seed.code,
          code: seed.code,
          permission: seed.code,
          type: 'BUTTON',
          pid: null,
          path: null,
          method: '',
          layout: 'normal',
          enable: true,
          show: false,
          needLogin: true,
          order: 0,
        },
        select: { id: true },
      });
      permissionMenuIds.push(created.id);
      createdCount += 1;
    }

    const adminRole = await this.prisma.role.findUnique({
      where: { code: 'ADMIN' },
      select: { id: true },
    });
    if (!adminRole) {
      throw new Error('缺少 ADMIN 角色，无法初始化权限');
    }

    await this.prisma.roleMenu.createMany({
      data: permissionMenuIds.map((menuId) => ({
        roleId: adminRole.id,
        menuId,
      })),
      skipDuplicates: true,
    });

    this.logger.log(
      `权限种子同步完成：共 ${uniqueSeeds.length} 个权限码，新增 ${createdCount} 个`,
    );
  }

  private getPath(path: string | string[] | undefined): string {
    return Array.isArray(path) ? (path[0] ?? '') : (path ?? '');
  }
}
