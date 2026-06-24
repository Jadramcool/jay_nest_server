import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { Menu, Prisma, MenuType } from '@prisma/client';
import { CreateMenuDto, UpdateMenuDto, QueryMenuDto } from './dto';
import { buildQueryWhere } from '@/common/utils/query-where.util';

export interface MenuTreeNode {
  id: number;
  name: string;
  code: string;
  permission: string | null;
  type: MenuType;
  pid: number | null;
  path: string | null;
  redirect: string | null;
  icon: string | null;
  component: string | null;
  layout: string;
  keepAlive: boolean;
  method: string | null;
  description: string | null;
  show: boolean;
  enable: boolean;
  order: number;
  isFrame: boolean;
  frameSrc: string | null;
  target: string;
  affix: boolean;
  alwaysShow: boolean | null;
  badge: string | null;
  badgeType: string | null;
  needLogin: boolean | null;
  extraData: Prisma.JsonValue | null;
  createdTime: Date;
  updatedTime: Date | null;
  children?: MenuTreeNode[];
}

@Injectable()
export class MenuService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createMenuDto: CreateMenuDto) {
    const { code } = createMenuDto;

    const existingMenu = await this.prisma.menu.findUnique({
      where: { code },
    });

    if (existingMenu) {
      throw new BadRequestException('菜单编码已存在');
    }

    const menu = await this.prisma.menu.create({
      data: {
        name: createMenuDto.name,
        code: createMenuDto.code,
        permission: createMenuDto.permission,
        type: createMenuDto.type,
        pid: createMenuDto.pid,
        path: createMenuDto.path,
        redirect: createMenuDto.redirect,
        icon: createMenuDto.icon,
        component: createMenuDto.component,
        layout: createMenuDto.layout || 'normal',
        keepAlive: createMenuDto.keepAlive ?? false,
        method: createMenuDto.method,
        description: createMenuDto.description,
        show: createMenuDto.show ?? true,
        enable: createMenuDto.enable ?? true,
        order: createMenuDto.order ?? 0,
        isFrame: createMenuDto.isFrame ?? false,
        frameSrc: createMenuDto.frameSrc,
        target: createMenuDto.target || '_self',
        affix: createMenuDto.affix ?? false,
        alwaysShow: createMenuDto.alwaysShow,
        badge: createMenuDto.badge,
        badgeType: createMenuDto.badgeType,
        needLogin: createMenuDto.needLogin ?? true,
        extraData: createMenuDto.extraData as Prisma.InputJsonValue,
      },
    });

    // 新菜单自动分配给超级管理员角色（role_id = 1）
    await this.prisma.roleMenu.upsert({
      where: { roleId_menuId: { roleId: 1, menuId: menu.id } },
      update: {},
      create: { roleId: 1, menuId: menu.id },
    });

    return this.formatMenu(menu);
  }

  async findAll(queryMenuDto: QueryMenuDto) {
    const where: Prisma.MenuWhereInput = {
      ...buildQueryWhere(queryMenuDto, {
        name: 'contains',
        code: 'contains',
        permission: 'contains',
        type: 'eq',
        pid: 'eq',
        show: 'eq',
        enable: 'eq',
      }),
    };

    const menus = await this.prisma.menu.findMany({
      where,
      orderBy: { order: 'asc' },
    });

    return {
      list: menus.map((menu) => this.formatMenu(menu)),
      total: menus.length,
    };
  }

  async findOne(id: number) {
    const menu = await this.prisma.menu.findUnique({
      where: { id },
    });

    if (!menu) {
      throw new NotFoundException(`菜单 ID ${id} 不存在`);
    }

    return this.formatMenu(menu);
  }

  async findTree() {
    const menus = await this.prisma.menu.findMany({
      orderBy: { order: 'asc' },
    });

    return this.buildTree(menus);
  }

  async update(id: number, updateMenuDto: Partial<UpdateMenuDto>) {
    const menu = await this.prisma.menu.findUnique({
      where: { id },
    });

    if (!menu) {
      throw new NotFoundException(`菜单 ID ${id} 不存在`);
    }

    if (updateMenuDto.code) {
      const existingMenu = await this.prisma.menu.findFirst({
        where: {
          id: { not: id },
          code: updateMenuDto.code,
        },
      });

      if (existingMenu) {
        throw new BadRequestException('菜单编码已存在');
      }
    }

    const { extraData, ...rest } = updateMenuDto;
    const updatedMenu = await this.prisma.menu.update({
      where: { id },
      data: {
        ...rest,
        ...(extraData !== undefined && {
          extraData: extraData as Prisma.InputJsonValue,
        }),
      },
    });

    return this.formatMenu(updatedMenu);
  }

  async remove(id: number) {
    const menu = await this.prisma.menu.findUnique({
      where: { id },
    });

    if (!menu) {
      throw new NotFoundException(`菜单 ID ${id} 不存在`);
    }

    const childMenus = await this.prisma.menu.findMany({
      where: { pid: id },
    });

    if (childMenus.length > 0) {
      throw new BadRequestException('该菜单存在子菜单，无法删除');
    }

    await this.prisma.roleMenu.deleteMany({
      where: { menuId: id },
    });

    await this.prisma.menu.delete({
      where: { id },
    });

    return { id };
  }

  async findOnlineMenus() {
    const menus = await this.prisma.menu.findMany({
      where: { enable: true, show: true, needLogin: false },
      orderBy: { order: 'asc' },
    });
    return this.buildTree(menus);
  }

  async batchRemove(ids: number[]) {
    const childMenus = await this.prisma.menu.findMany({
      where: { pid: { in: ids } },
    });
    if (childMenus.length > 0) {
      throw new BadRequestException('选中的菜单中存在子菜单，无法删除');
    }
    await this.prisma.roleMenu.deleteMany({
      where: { menuId: { in: ids } },
    });
    await this.prisma.menu.deleteMany({
      where: { id: { in: ids } },
    });
    return { ids };
  }

  private formatMenu(menu: Menu): MenuTreeNode {
    return {
      id: menu.id,
      name: menu.name,
      code: menu.code,
      permission: menu.permission,
      type: menu.type,
      pid: menu.pid,
      path: menu.path,
      redirect: menu.redirect,
      icon: menu.icon,
      component: menu.component,
      layout: menu.layout,
      keepAlive: menu.keepAlive,
      method: menu.method,
      description: menu.description,
      show: menu.show,
      enable: menu.enable,
      order: menu.order,
      isFrame: menu.isFrame,
      frameSrc: menu.frameSrc,
      target: menu.target,
      affix: menu.affix,
      alwaysShow: menu.alwaysShow,
      badge: menu.badge,
      badgeType: menu.badgeType,
      needLogin: menu.needLogin,
      extraData: menu.extraData,
      createdTime: menu.createdTime,
      updatedTime: menu.updatedTime,
    };
  }

  private buildTree(menus: Menu[], pid: number | null = null): MenuTreeNode[] {
    return menus
      .filter((menu) => menu.pid === pid)
      .map((menu): MenuTreeNode => {
        const formatted = this.formatMenu(menu);
        const children: MenuTreeNode[] = this.buildTree(menus, menu.id);
        if (children.length > 0) {
          return { ...formatted, children };
        }
        return formatted;
      });
  }
}
