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
import * as path from 'path';

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

  // 启用 CORS
  app.enableCors();

  // 设置全局前缀
  app.setGlobalPrefix('api');

  // Swagger API 文档配置
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
