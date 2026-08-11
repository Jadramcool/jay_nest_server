/**
 * 导出 OpenAPI 文档为 JSON(无需数据库连接)
 *
 * 用法: npx ts-node scripts/export-openapi.ts [输出路径]
 *   - 默认输出到 ./openapi.json
 *   - 通过打桩 PrismaService.$connect 跳过数据库,仅用于生成契约文档
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

async function main() {
  const output = process.argv[2]
    ? resolve(process.argv[2])
    : resolve('openapi.json');

  const app = await NestFactory.create(AppModule, { logger: false });

  // 打桩数据库连接:导出文档只需路由元数据,不访问数据库
  const prisma = app.get(PrismaService);
  prisma.$connect = async () => {};
  prisma.$disconnect = async () => {};

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
  writeFileSync(output, JSON.stringify(document, null, 2), 'utf-8');
  console.log(`OpenAPI 文档已导出: ${output}`);

  await app.close();
  process.exit(0);
}

main().catch((error) => {
  console.error('导出失败:', error);
  process.exit(1);
});
