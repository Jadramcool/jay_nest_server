/**
 * JWT 刷新令牌策略
 *
 * 该策略用于验证刷新令牌（refreshToken），
 * 刷新令牌用于在访问令牌过期后获取新的访问令牌，
 * 而无需用户重新登录。
 */
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { getJwtSecret } from '@/common/utils/jwt-config.util';

/**
 * 刷新令牌载荷接口
 * 定义刷新令牌中存储的信息结构
 */
export interface RefreshPayload {
  /** 用户ID */
  id: number;
  /** 令牌类型，固定为 'refresh' */
  type: 'refresh';
  /** 签发时间 */
  iat?: number;
  /** 过期时间 */
  exp?: number;
}

/**
 * JWT 刷新令牌策略
 *
 * @description
 * 从请求体（body）中提取 refreshToken 字段，
 * 验证令牌的有效性和类型（必须为 'refresh'），
 * 用于刷新访问令牌的场景。
 *
 * @note
 * 该策略使用 passReqToCallback: true 将请求对象传递给 validate 方法，
 * 以便在需要时访问请求的其他信息。
 */
@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),
      ignoreExpiration: false,
      secretOrKey: getJwtSecret(configService),
      passReqToCallback: true,
    });
  }

  /**
   * 验证刷新令牌
   *
   * @param req - HTTP 请求对象
   * @param payload - 解码后的刷新令牌载荷
   * @returns 返回用户信息对象（仅包含 userId）
   * @throws UnauthorizedException - 令牌无效或类型错误
   *
   * @description
   * 该方法验证刷新令牌的有效性，
   * 确保令牌类型为 'refresh'，
   * 并返回用户 ID 用于生成新的访问令牌。
   */
  validate(req: Request, payload: RefreshPayload) {
    if (!payload.id || payload.type !== 'refresh') {
      throw new UnauthorizedException('无效的刷新令牌');
    }
    return {
      userId: payload.id,
    };
  }
}
