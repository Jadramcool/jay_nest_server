import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DiscoveryService, Reflector } from '@nestjs/core';
import { PrismaService } from '@/prisma/prisma.service';
import { MenuType } from '@prisma/client';
import {
  PERMISSIONS_KEY,
  PermissionMeta,
  normalizePermissionMeta,
} from '../decorators/permissions.decorator';
import {
  MENU_TYPE_LABEL,
  MENU_TYPE_RULES,
} from '@/modules/system/menu/menu-type.rules';

interface PermissionSeed {
  code: string;
  name: string;
  controller: string;
  method: string;
  route: string;
}

interface MenuBrief {
  id: number;
  name: string;
  code: string;
  type: MenuType;
  pid: number | null;
}

/**
 * 权限审计服务
 *
 * 按钮权限的增删改由管理员在「菜单管理」界面维护（menu 表 BUTTON 行），
 * 代码中的 @RequirePermissions 装饰器是接口的鉴权契约，不再自动写库。
 * 启动时仅做对照审计：
 * 1. 代码声明但菜单表缺失的权限码 → warn（该接口会对普通角色 403，需在菜单管理补建按钮）
 * 2. 菜单表存在但代码未声明的权限码 → info（预留权限，接口尚未挂接）
 * 3. 菜单树结构体检 → warn（悬空父级/非法父子类型/成环的节点会从树中静默消失）
 */
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
      await this.auditMenuTree();

      const seeds = this.scanPermissions();
      if (seeds.length === 0) {
        this.logger.warn('未发现任何 @RequirePermissions 装饰器');
        return;
      }
      await this.auditPermissions(seeds);
    } catch (error) {
      this.logger.error(
        '权限审计失败',
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
        const metas = this.reflector.get<PermissionMeta[]>(
          PERMISSIONS_KEY,
          method,
        );

        if (!metas || metas.length === 0) continue;

        const methodPath = this.getPath(
          this.reflector.get<string | string[]>('path', method),
        );
        const route = `/${controllerPath}/${methodPath}`.replace(/\/+/g, '/');

        for (const meta of metas) {
          const normalized = normalizePermissionMeta(meta);
          seeds.push({
            code: normalized.code,
            name: normalized.name,
            controller: controllerName,
            method: methodName,
            route,
          });
        }
      }
    }

    return seeds;
  }

  /** 对照菜单表按钮权限做审计，不写库 */
  private async auditPermissions(seeds: PermissionSeed[]) {
    const uniqueSeeds = [
      ...new Map(seeds.map((seed) => [seed.code, seed])).values(),
    ];
    const declaredCodes = new Set(uniqueSeeds.map((seed) => seed.code));

    // 权限码只声明在菜单表的 BUTTON 行（目录/菜单行的 permission 恒为 null）
    const menus = await this.prisma.menu.findMany({
      where: { type: 'BUTTON', permission: { not: null } },
      select: { code: true, name: true, permission: true },
    });
    const menuPermissionCodes = new Set(
      menus
        .map((menu) => menu.permission)
        .filter((permission): permission is string => Boolean(permission)),
    );

    const missing = uniqueSeeds.filter((seed) => !menuPermissionCodes.has(seed.code));
    if (missing.length > 0) {
      this.logger.warn(
        `以下 ${missing.length} 个接口权限码在菜单管理中不存在（普通角色将无法访问，请在菜单管理对应菜单下新建按钮）：`
        + missing.map((seed) => `\n  - ${seed.code}（${seed.name}，${seed.route}）`).join(''),
      );
    }

    const unused = menus.filter(
      (menu) => menu.permission && !declaredCodes.has(menu.permission),
    );
    if (unused.length > 0) {
      this.logger.log(
        `菜单管理中有 ${unused.length} 个按钮权限码暂未挂接任何接口：`
        + unused.map((menu) => `\n  - ${menu.permission}（${menu.name}）`).join(''),
      );
    }

    this.logger.log(
      `权限审计完成：接口声明 ${uniqueSeeds.length} 个权限码，菜单按钮 ${menus.length} 个`,
    );
  }

  /**
   * 菜单树结构体检
   *
   * 树是用 pid 自关联拼出来的，`buildTree` 只从根节点向下递归，
   * 因此「父级不存在」的节点不会报错，而是**从树上消失**——
   * 管理界面看不到它，角色授权树也勾不到它，等于一个谁也拿不到的权限。
   * 这里把这些静默失效的结构显式打出来。
   */
  private async auditMenuTree(): Promise<void> {
    const menus = await this.prisma.menu.findMany({
      select: { id: true, name: true, code: true, type: true, pid: true },
    });

    if (menus.length === 0) return;

    const menuMap = new Map(menus.map((menu) => [menu.id, menu]));
    const issues: string[] = [];
    const describe = (menu: MenuBrief) =>
      `${MENU_TYPE_LABEL[menu.type]}「${menu.name}」(${menu.code})`;

    for (const menu of menus) {
      if (menu.pid === null) {
        if (!MENU_TYPE_RULES[menu.type].allowRoot) {
          issues.push(`${describe(menu)} 没有父级，不会出现在菜单树中`);
        }
        continue;
      }

      const parent = menuMap.get(menu.pid);
      if (!parent) {
        issues.push(
          `${describe(menu)} 的父级 ID ${menu.pid} 不存在，节点会从菜单树中丢失`,
        );
        continue;
      }

      if (!MENU_TYPE_RULES[menu.type].parentTypes.includes(parent.type)) {
        issues.push(
          `${describe(menu)} 挂在${MENU_TYPE_LABEL[parent.type]}「${parent.name}」下，不符合父子类型约束`,
        );
      }
    }

    const cyclicIds = new Set<number>();
    for (const menu of menus) {
      const path = new Set<number>();
      let cursor: MenuBrief | undefined = menu;
      while (cursor) {
        if (path.has(cursor.id)) {
          cyclicIds.add(cursor.id);
          break;
        }
        path.add(cursor.id);
        cursor = cursor.pid === null ? undefined : menuMap.get(cursor.pid);
      }
    }
    if (cyclicIds.size > 0) {
      issues.push(`${cyclicIds.size} 个节点处于循环引用中，整条链都无法展示`);
    }

    if (issues.length > 0) {
      const lines = [
        `菜单树体检发现 ${issues.length} 处结构问题：`,
        ...issues.map((issue) => `  - ${issue}`),
      ];
      this.logger.warn(lines.join('\n'));
      return;
    }

    this.logger.log(`菜单树体检通过：${menus.length} 个节点结构合法`);
  }

  private getPath(path: string | string[] | undefined): string {
    return Array.isArray(path) ? (path[0] ?? '') : (path ?? '');
  }
}
