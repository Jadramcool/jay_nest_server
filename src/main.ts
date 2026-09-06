import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { OperationLogInterceptor } from './common/interceptors/operation-log.interceptor';
import { OperationLogService } from './modules/system/operation-log/operation-log.service';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as helmet from 'helmet';
import * as path from 'path';
import { getAllowedOrigins } from './common/utils/cors.util';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // 静态文件服务 — 上传文件访问
  app.useStaticAssets(path.join(process.cwd(), 'uploads'), {
    prefix: '/uploads',
  });

  // 全局验证管道
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // 全局响应拦截器
  app.useGlobalInterceptors(new TransformInterceptor());

  // 全局操作日志拦截器
  const reflector = app.get(Reflector);
  const operationLogService = app.get(OperationLogService);
  app.useGlobalInterceptors(
    new OperationLogInterceptor(reflector, operationLogService),
  );

  // 全局异常过滤器
  app.useGlobalFilters(new PrismaExceptionFilter(), new HttpExceptionFilter());

  // 基础安全响应头(关闭 CSP 以免影响 Swagger UI;生产入口如需 CSP 请在网关配置)
  app.use(helmet({ contentSecurityPolicy: false }));

  // 启用 CORS:通过 CORS_ORIGINS 配置来源白名单(逗号分隔),未配置时保持放开(本地开发)
  app.enableCors({ origin: getAllowedOrigins(), credentials: true });

  // 设置全局前缀
  app.setGlobalPrefix('api');

  // Swagger API 文档配置
  // Swagger API 文档配置(生产环境关闭,不暴露接口地图)
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('JDM Server API')
      .setDescription('企业级管理系统 API 文档')
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'JWT',
          description: 'Enter JWT token',
          in: 'header',
        },
        'JWT-auth',
      )
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api-docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });
  }

  const port = Number(process.env.PORT) || 3000;
  await app.listen(port);

  console.log('\n' + '='.repeat(60));
  console.log('🚀 JDM NestJS Server 启动成功!');
  console.log('='.repeat(60));
  console.log(`📍 服务地址: http://localhost:${port}/api`);
  console.log(`🏥 健康检查: http://localhost:${port}/api/health`);
  console.log(`📚 API文档: http://localhost:${port}/api-docs`);
  console.log('='.repeat(60) + '\n');
}
void bootstrap();
