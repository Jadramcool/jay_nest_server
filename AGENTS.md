# 仓库指南

## 项目结构与模块组织

`jdm-nest-server` 是基于 NestJS、Prisma 和 MySQL 的后端 API。主源码位于 `src/`，业务模块位于 `src/modules/`，公共装饰器、守卫、拦截器、过滤器、DTO 和工具位于 `src/common/`，Prisma 集成代码位于 `src/prisma/`。数据库 schema、迁移、种子入口和初始化数据位于 `prisma/`。端到端测试位于 `test/`，单元测试与源码同目录并命名为 `*.spec.ts`。

## 构建、测试与开发命令

请在 `jdm-nest-server/` 目录执行命令。

- `npm run dev`：以 watch 模式启动 NestJS。
- `npm run build`：编译后端到 `dist/`。
- `npm run start:prod`：运行已编译应用。
- `npm run lint`：执行 ESLint 并自动修复。
- `npm run format`：格式化 `src/**/*.ts` 和 `test/**/*.ts`。
- `npm run test`：运行 Jest 单元测试。
- `npm run test:e2e`：按 `test/jest-e2e.json` 运行端到端测试。
- `npm run test:cov`：生成测试覆盖率。
- `npm run prisma:generate`：重新生成 Prisma Client。
- `npm run prisma:migrate -- --name <name>`：创建并应用迁移。
- `npm run prisma:seed`：写入初始化数据。

## 编码风格与命名约定

使用 TypeScript 和标准 NestJS 模块结构：`xxx.module.ts`、`xxx.controller.ts`、`xxx.service.ts`，DTO 放在 `dto/` 目录。DTO 应按需使用 `class-validator` 和 Swagger 装饰器。测试文件使用 `*.spec.ts`。优先使用已配置别名：`@/`、`@modules/`、`@common/`、`@config/`、`@utils/`，避免过长相对路径。

## 测试要求

Jest 配置为 `rootDir: src`，匹配规则为 `.*\\.spec\\.ts$`。修改服务、守卫、拦截器或控制器行为时，应补充聚焦单元测试。跨模块 API 流程变更应运行 `npm run test:e2e`。评估覆盖率影响时运行 `npm run test:cov`。

## 提交与 Pull Request 规范

提交信息使用历史中已有的 Conventional Commit 前缀：`feat:`、`fix:`、`refactor:`、`docs:`、`chore:`，或 `fix(notice):` 这类作用域写法。PR 应说明 API 或 schema 变更、列出验证命令、注明迁移或种子数据要求，并在有相关 issue 时建立关联。

## 安全与配置提示

不要提交密钥、数据库地址、JWT 配置、OSS 凭据或本地 `.env` 覆盖文件。修改 `prisma/schema.prisma` 后，保持 `prisma/migrations/` 同步，并运行 `npm run prisma:generate`。公开路由必须显式使用 `@Public()`；受保护接口应复用现有角色和权限装饰器。
