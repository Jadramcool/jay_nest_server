import { ConfigService } from '@nestjs/config';

const MIN_JWT_SECRET_LENGTH = 32;

export function getJwtSecret(configService: ConfigService): string {
  const secret = configService.getOrThrow<string>('JWT_SECRET');
  if (secret === 'your-secret-key' || secret.length < MIN_JWT_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET 必须是至少 ${MIN_JWT_SECRET_LENGTH} 个字符的随机字符串`,
    );
  }
  return secret;
}
