/**
 * 认证服务模块
 *
 * 提供用户认证相关的核心业务逻辑，包括：
 * - 用户登录验证
 * - 用户注册
 * - Token 刷新
 * - 用户登出
 * - 获取用户信息
 * - 获取用户菜单
 * - 用户信息更新
 * - 密码验证与修改
 */
import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service';
import { Sex } from '@prisma/client';
import * as bcrypt from 'bcrypt';

/**
 * JWT Token 载荷接口
 * 定义 Token 中存储的用户信息
 */
export interface TokenPayload {
  /** 用户ID */
  id: number;
  /** 用户名 */
  username: string;
}

/**
 * Token 对接口
 * 包含访问令牌和刷新令牌
 */
export interface TokenPair {
  /** 访问令牌 */
  accessToken: string;
  /** 刷新令牌 */
  refreshToken: string;
  /** 过期时间（秒） */
  expiresIn: number;
  /** 令牌类型 */
  tokenType: string;
}

/**
 * 用户信息接口
 * 用于在认证流程中传递用户基本信息
 */
export interface UserInfo {
  /** 用户ID */
  id: number;
  /** 用户名 */
  username: string;
}

/**
 * 菜单格式化接口
 * 用于规范化菜单数据的结构
 */
export interface MenuFormat {
  /** 菜单ID */
  id: number;
  /** 菜单名称 */
  name: string;
  /** 路由路径 */
  path: string | null;
  /** 组件路径 */
  component: string | null;
  /** 重定向路径 */
  redirect: string | null;
  /** 图标 */
  icon: string | null;
  /** 菜单类型 */
  type: string;
  /** 是否缓存 */
  keepAlive: boolean | null;
  /** 是否显示 */
  show: boolean | null;
  /** 是否启用 */
  enable: boolean | null;
  /** 排序 */
  order: number | null;
  /** 父菜单ID */
  pid: number | null;
  /** 菜单编码 */
  code: string;
}

/**
 * 菜单树节点接口
 * 支持嵌套的菜单结构
 */
export interface MenuTreeNode extends MenuFormat {
  /** 子菜单 */
  children?: MenuTreeNode[];
}

/**
 * 认证服务类
 * 处理所有与用户认证相关的业务逻辑
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * 验证用户凭证
   *
   * @param username - 用户名
   * @param password - 密码
   * @returns 返回用户基本信息（id 和 username）
   * @throws UnauthorizedException - 用户不存在、已删除、已禁用或密码错误
   */
  async validateUser(username: string, password: string): Promise<UserInfo> {
    const user = await this.prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    if (user.isDeleted) {
      throw new UnauthorizedException('用户已被删除');
    }

    if (user.status !== 1) {
      throw new UnauthorizedException('用户已被禁用');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    return {
      id: user.id,
      username: user.username,
    };
  }

  /**
   * 用户登录
   *
   * @param username - 用户名
   * @param password - 密码
   * @returns 返回 Token 对（访问令牌和刷新令牌）
   */
  async login(username: string, password: string): Promise<TokenPair> {
    const user = await this.validateUser(username, password);
    const tokens = this.generateTokens(user);
    return tokens;
  }

  /**
   * 用户注册
   *
   * @param data - 注册信息，包含 username, password, confirmPassword, phone, email
   * @returns 返回新创建用户的 id 和 username
   * @throws BadRequestException - 两次密码输入不一致
   * @throws ConflictException - 用户名、邮箱或手机号已被注册
   */
  async register(data: {
    username: string;
    password: string;
    confirmPassword: string;
    phone?: string;
    email?: string;
  }): Promise<{ userId: number; username: string }> {
    if (data.password !== data.confirmPassword) {
      throw new BadRequestException('两次密码输入不一致');
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { username: data.username },
    });

    if (existingUser) {
      throw new ConflictException('用户名已存在');
    }

    if (data.email) {
      const existingEmail = await this.prisma.user.findUnique({
        where: { email: data.email },
      });
      if (existingEmail) {
        throw new ConflictException('邮箱已被注册');
      }
    }

    if (data.phone) {
      const existingPhone = await this.prisma.user.findUnique({
        where: { phone: data.phone },
      });
      if (existingPhone) {
        throw new ConflictException('手机号已被注册');
      }
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const user = await this.prisma.user.create({
      data: {
        username: data.username,
        password: hashedPassword,
        phone: data.phone,
        email: data.email,
        status: 1,
      },
    });

    return {
      userId: user.id,
      username: user.username,
    };
  }

  /**
   * 刷新访问令牌
   *
   * @param refreshToken - 刷新令牌
   * @returns 返回新的 Token 对
   * @throws UnauthorizedException - 令牌无效或已过期
   */
  async refresh(refreshToken: string): Promise<TokenPair> {
    try {
      const payload = this.jwtService.verify<TokenPayload & { type: string }>(
        refreshToken,
        {
          secret:
            this.configService.get<string>('JWT_SECRET') || 'your-secret-key',
        },
      );

      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('无效的刷新令牌');
      }

      const user = await this.prisma.user.findUnique({
        where: { id: payload.id },
      });

      if (!user || user.isDeleted) {
        throw new UnauthorizedException('用户不存在或已删除');
      }

      return this.generateTokens({
        id: user.id,
        username: user.username,
      });
    } catch {
      throw new UnauthorizedException('Token 已过期，请重新登录');
    }
  }

  /**
   * 用户登出
   *
   * @returns 返回登出成功消息
   * @note 当前实现为同步操作，实际的 token 注销需要在客户端完成
   */
  logout(): { message: string } {
    return { message: '登出成功' };
  }

  /**
   * 获取当前用户信息
   *
   * @param userId - 用户ID
   * @returns 返回完整的用户信息，包括部门、角色等关联数据
   * @throws NotFoundException - 用户不存在
   */
  async getUserInfo(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        department: {
          select: { id: true, name: true },
        },
        roles: {
          include: {
            role: {
              select: { id: true, name: true, code: true },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    return {
      id: user.id,
      username: user.username,
      name: user.name,
      phone: user.phone,
      email: user.email,
      sex: user.sex,
      avatar: user.avatar,
      birthday: user.birthday,
      city: user.city,
      address: user.address,
      addressDetail: user.addressDetail,
      status: user.status,
      roleType: user.roleType,
      position: user.position,
      joinedAt: user.joinedAt,
      departmentId: user.departmentId,
      departmentName: user.department?.name,
      roles: user.roles.map((ur) => ur.role),
    };
  }

  private async getRawUserMenus(userId: number): Promise<MenuFormat[]> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: {
        role: {
          include: {
            menus: {
              include: {
                menu: true,
              },
            },
          },
        },
      },
    });

    const menuMap = new Map<number, MenuFormat>();
    for (const userRole of userRoles) {
      for (const roleMenu of userRole.role.menus) {
        const menu = roleMenu.menu;
        if (menu.enable && menu.show && !menuMap.has(menu.id)) {
          menuMap.set(menu.id, {
            id: menu.id,
            name: menu.name,
            path: menu.path,
            component: menu.component,
            redirect: menu.redirect,
            icon: menu.icon,
            type: menu.type,
            keepAlive: menu.keepAlive,
            show: menu.show,
            enable: menu.enable,
            order: menu.order,
            pid: menu.pid,
            code: menu.code,
          });
        }
      }
    }

    return Array.from(menuMap.values());
  }

  /**
   * 获取当前用户的菜单权限（树形结构）
   */
  async getUserMenu(userId: number): Promise<MenuTreeNode[]> {
    const menus = await this.getRawUserMenus(userId);
    return this.buildMenuTree(menus);
  }

  /**
   * 获取当前用户的菜单权限（平铺数据）
   */
  async getUserMenusFlat(userId: number): Promise<MenuFormat[]> {
    const menus = await this.getRawUserMenus(userId);
    return menus.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  /**
   * 更新当前用户信息
   *
   * @param userId - 用户ID
   * @param data - 要更新的用户信息
   * @returns 返回更新后的用户基本信息
   * @throws NotFoundException - 用户不存在
   * @throws ConflictException - 邮箱或手机号已被他人注册
   */
  async updateUser(
    userId: number,
    data: {
      name?: string;
      phone?: string;
      email?: string;
      sex?: string;
      avatar?: string;
      birthday?: Date;
      city?: string;
      address?: string;
      addressDetail?: string;
      position?: string;
    },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    if (data.email && data.email !== user.email) {
      const existingEmail = await this.prisma.user.findFirst({
        where: { email: data.email, id: { not: userId } },
      });
      if (existingEmail) {
        throw new ConflictException('邮箱已被注册');
      }
    }

    if (data.phone && data.phone !== user.phone) {
      const existingPhone = await this.prisma.user.findFirst({
        where: { phone: data.phone, id: { not: userId } },
      });
      if (existingPhone) {
        throw new ConflictException('手机号已被注册');
      }
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.sex !== undefined && { sex: data.sex as Sex }),
        ...(data.avatar !== undefined && { avatar: data.avatar }),
        ...(data.birthday !== undefined && { birthday: data.birthday }),
        ...(data.city !== undefined && { city: data.city }),
        ...(data.address !== undefined && { address: data.address }),
        ...(data.addressDetail !== undefined && {
          addressDetail: data.addressDetail,
        }),
        ...(data.position !== undefined && { position: data.position }),
      },
    });

    return {
      id: updatedUser.id,
      name: updatedUser.name,
      phone: updatedUser.phone,
      email: updatedUser.email,
    };
  }

  /**
   * 验证用户密码
   *
   * @param userId - 用户ID
   * @param password - 要验证的密码
   * @returns 返回密码是否正确
   * @throws NotFoundException - 用户不存在
   */
  async checkPassword(userId: number, password: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    return bcrypt.compare(password, user.password);
  }

  /**
   * 修改用户密码
   *
   * @param userId - 用户ID
   * @param oldPassword - 原密码
   * @param newPassword - 新密码
   * @returns 返回修改成功消息
   * @throws NotFoundException - 用户不存在
   * @throws BadRequestException - 原密码错误
   */
  async updatePassword(
    userId: number,
    oldPassword: string,
    newPassword: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    const isOldPasswordValid = await bcrypt.compare(oldPassword, user.password);
    if (!isOldPasswordValid) {
      throw new BadRequestException('原密码错误');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    return { message: '密码修改成功' };
  }

  /**
   * 生成 Token 对
   *
   * @param user - 用户信息
   * @returns 返回包含 accessToken 和 refreshToken 的 Token 对
   * @description 生成访问令牌和刷新令牌，访问令牌短期有效，刷新令牌长期有效
   */
  private generateTokens(user: { id: number; username: string }): TokenPair {
    const accessExpiresIn = Number(
      this.configService.get<string>('JWT_EXPIRES_IN', '7200'),
    );
    const refreshExpiresIn = Number(
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '604800'),
    );

    const accessPayload: TokenPayload = {
      id: user.id,
      username: user.username,
    };

    const refreshPayload: TokenPayload & { type: string } = {
      id: user.id,
      username: user.username,
      type: 'refresh',
    };

    const accessToken = this.jwtService.sign(accessPayload, {
      expiresIn: accessExpiresIn,
    });

    const refreshToken = this.jwtService.sign(refreshPayload, {
      expiresIn: refreshExpiresIn,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: accessExpiresIn,
      tokenType: 'Bearer',
    };
  }

  /**
   * 构建菜单树形结构
   *
   * @param menus - 菜单列表
   * @param parentId - 父菜单ID，默认为 null（表示根菜单）
   * @returns 返回树形结构的菜单
   * @description 递归地将扁平菜单列表转换为树形结构
   */
  private buildMenuTree(
    menus: MenuFormat[],
    parentId: number | null = null,
  ): MenuTreeNode[] {
    return menus
      .filter((menu) => menu.pid === parentId)
      .map((menu) => {
        const children = this.buildMenuTree(menus, menu.id);
        const node: MenuTreeNode = {
          id: menu.id,
          name: menu.name,
          path: menu.path,
          component: menu.component,
          redirect: menu.redirect,
          icon: menu.icon,
          type: menu.type,
          keepAlive: menu.keepAlive,
          show: menu.show,
          enable: menu.enable,
          order: menu.order,
          pid: menu.pid,
          code: menu.code,
        };
        if (children.length > 0) {
          node.children = children;
        }
        return node;
      })
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }
}
