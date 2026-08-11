import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { SystemModule } from './modules/system/system.module';
import { NoticeModule } from './modules/notice/notice.module';
import { UploadModule } from './modules/upload/upload.module';
import { PublicModule } from './modules/public/public.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { TodoModule } from './modules/todo/todo.module';
import { MetricsModule } from './modules/metrics/metrics.module';
import { SessionModule } from './modules/session/session.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),
    PrismaModule,
    AuthModule,
    SystemModule,
    NoticeModule,
    UploadModule,
    PublicModule,
    DashboardModule,
    TodoModule,
    MetricsModule,
    SessionModule,
  ],
})
export class AppModule {}
