/**
 * 认证控制器
 *
 * 提供用户认证相关的 HTTP 接口，包括：
 * - 用户登录 /auth/login
 * - 用户注册 /auth/register
 * - Token 刷新 /auth/refresh
 * - 用户登出 /auth/logout
 * - 获取用户信息 /auth/user/info
 * - 获取用户菜单 /auth/user/menu
 * - 更新用户信息 /auth/user/update
 * - 验证密码 /auth/user/checkPassword
 * - 修改密码 /auth/user/updatePassword
 */
import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService, TokenPair } from './auth.service';
import {
  LoginDto,
  RegisterDto,
  RefreshTokenDto,
  UpdateUserDto,
  CheckPasswordDto,
  UpdatePasswordDto,
} from './dto';
import { Public, CurrentUser, OperationLog } from '@/common/decorators';
import { OperationType } from '@prisma/client';

/**
 * 认证模块 API 标签
 */
@ApiTags('认证模块')
@ApiBearerAuth()
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * 用户登录接口
   *
   * @param loginDto - 登录参数，包含用户名和密码
   * @returns 返回 Token 对（访问令牌和刷新令牌）
   * @note 该接口公开访问，无需认证
   */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @OperationLog({ operationType: OperationType.LOGIN, description: '用户登录' })
  @ApiOperation({ summary: '用户登录' })
  @ApiResponse({ status: 200, description: '登录成功' })
  @ApiResponse({ status: 401, description: '用户名或密码错误' })
  async login(@Body() loginDto: LoginDto): Promise<TokenPair> {
    return this.authService.login(loginDto.username, loginDto.password);
  }

  /**
   * 用户注册接口
   *
   * @param registerDto - 注册参数
   * @returns 返回新创建用户的 ID 和用户名
   * @note 该接口公开访问，无需认证
   */
  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '用户注册' })
  @ApiResponse({ status: 201, description: '注册成功' })
  @ApiResponse({ status: 409, description: '用户名已存在' })
  async register(
    @Body() registerDto: RegisterDto,
  ): Promise<{ userId: number; username: string }> {
    return this.authService.register(registerDto);
  }

  /**
   * 刷新访问令牌接口
   *
   * @param refreshTokenDto - 包含刷新令牌的参数
   * @returns 返回新的 Token 对
   * @note 该接口公开访问，无需认证
   */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '刷新Token' })
  @ApiResponse({ status: 200, description: '刷新成功' })
  @ApiResponse({ status: 401, description: 'Token已过期' })
  async refresh(@Body() refreshTokenDto: RefreshTokenDto): Promise<TokenPair> {
    return this.authService.refresh(refreshTokenDto.refreshToken);
  }

  /**
   * 用户登出接口
   *
   * @returns 返回登出成功消息
   * @note 该接口公开访问，无需认证
   */
  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @OperationLog({ operationType: OperationType.LOGOUT, description: '用户登出' })
  @ApiOperation({ summary: '用户登出' })
  @ApiResponse({ status: 200, description: '登出成功' })
  logout() {
    return this.authService.logout();
  }

  /**
   * 获取当前用户信息接口
   *
   * @param user - 从 JWT Token 中解析出的当前用户信息
   * @returns 返回当前用户的完整信息
   * @note 该接口需要认证
   */
  @Get('user/info')
  @ApiOperation({ summary: '获取当前用户信息' })
  async getUserInfo(@CurrentUser() user: { userId: number; username: string }) {
    return this.authService.getUserInfo(user.userId);
  }

  /**
   * 获取当前用户菜单接口
   *
   * @param user - 从 JWT Token 中解析出的当前用户信息
   * @returns 返回当前用户的菜单树
   * @note 该接口需要认证
   */
  @Get('user/menu')
  @ApiOperation({ summary: '获取当前用户菜单' })
  async getUserMenu(@CurrentUser() user: { userId: number; username: string }) {
    return this.authService.getUserMenusFlat(user.userId);
  }

  /**
   * 更新当前用户信息接口
   *
   * @param user - 从 JWT Token 中解析出的当前用户信息
   * @param data - 要更新的用户信息
   * @returns 返回更新后的用户基本信息
   * @note 该接口需要认证
   */
  @Put('user/update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '更新当前用户信息' })
  async updateUser(
    @CurrentUser() user: { userId: number; username: string },
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.authService.updateUser(user.userId, updateUserDto);
  }

  /**
   * 验证密码接口
   *
   * @param user - 从 JWT Token 中解析出的当前用户信息
   * @param password - 要验证的密码
   * @returns 返回密码是否正确
   * @note 该接口需要认证
   */
  @Post('user/checkPassword')
  @HttpCode(HttpStatus.OK)
  @OperationLog({ operationType: OperationType.VIEW, description: '验证密码' })
  @ApiOperation({ summary: '验证密码' })
  async checkPassword(
    @CurrentUser() user: { userId: number; username: string },
    @Body() dto: CheckPasswordDto,
  ): Promise<boolean> {
    return this.authService.checkPassword(user.userId, dto.password);
  }

  /**
   * 修改密码接口
   *
   * @param user - 从 JWT Token 中解析出的当前用户信息
   * @param oldPassword - 原密码
   * @param newPassword - 新密码
   * @returns 返回修改成功消息
   * @note 该接口需要认证
   */
  @Post('user/updatePassword')
  @HttpCode(HttpStatus.OK)
  @OperationLog({ operationType: OperationType.UPDATE, description: '修改密码' })
  @ApiOperation({ summary: '修改密码' })
  async updatePassword(
    @CurrentUser() user: { userId: number; username: string },
    @Body() dto: UpdatePasswordDto,
  ): Promise<void> {
    await this.authService.updatePassword(
      user.userId,
      dto.oldPassword,
      dto.newPassword,
    );
  }
}
