import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NoticeService } from './notice.service';
import { NoticeController } from './notice.controller';
import { NoticeGateway } from './notice.gateway';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'your-secret-key',
        signOptions: {
          expiresIn: parseInt(
            configService.get<string>('JWT_EXPIRES_IN') || '7200',
            10,
          ),
        },
      }),
    }),
  ],
  controllers: [NoticeController],
  providers: [NoticeService, NoticeGateway],
  exports: [NoticeService, NoticeGateway],
})
export class NoticeModule {}
