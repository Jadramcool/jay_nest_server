# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在操作此仓库时提供指导。

## 开发命令

```bash
# 启动开发服务器（热重载）
npm run start:dev

# 构建
npm run build

# 生产模式启动
npm run start:prod

# 代码检查 (ESLint + TypeScript 严格模式)
npm run lint

# 代码格式化 (Prettier)
npm run format

# 单元测试 (Jest, rootDir: src, 匹配 *.spec.ts)
npm run test

# E2E 测试 (配置在 test/jest-e2e.json)
npm run test:e2e

# 测试覆盖率
npm run test:cov

# Prisma: schema 变更后重新生成客户端
npm run prisma:generate

# Prisma: 创建并应用迁移
npm run prisma:migrate -- --name <迁移名称>

# Prisma: 打开 Studio 图形化管理界面 (localhost:5555)
npm run prisma:studio

# Prisma: 填充种子数据
npm run prisma:seed
```

## 项目结构

```
src/
├── main.ts                    # 入口：全局管道、拦截器、过滤器、CORS、Swagger 配置
├── app.module.ts              # 根模块：导入所有功能模块
├── prisma/                    # 全局 PrismaModule (PrismaService 继承 PrismaClient)
│   ├── prisma.module.ts
│   ├── prisma.service.ts      # onModuleInit 自动连接，checkHealth() 健康检查
│   └── prisma.controller.ts
├── common/                    # 共享的横切关注点
│   ├── decorators/            # @Public, @CurrentUser, @Roles, @RequirePermissions, @OperationLog
│   ├── guards/                # JwtAuthGuard(全局), RolesGuard, PermissionsGuard
│   ├── interceptors/          # TransformInterceptor(统一 {code,message,data}), OperationLogInterceptor(自动记录操作日志)
│   ├── filters/               # HttpExceptionFilter(统一异常格式), PrismaExceptionFilter(Prisma错误码转换)
│   └── dto/                   # 通用 PaginationDto(分页参数)
├── modules/
│   ├── auth/                  # JWT 登录/注册/刷新令牌, 用户信息/菜单/密码管理
│   ├── system/                # 用户/角色/菜单/部门/系统配置/操作日志 CRUD
│   │   ├── user/              # 用户管理(列表/创建/更新/删除/批量删除/状态切换/角色分配/密码重置)
│   │   ├── role/              # 角色管理(含菜单权限分配)
│   │   ├── menu/              # 菜单管理
│   │   ├── department/        # 部门管理(层级结构)
│   │   ├── sys-config/        # 系统配置(key-value 多类型)
│   │   └── operation-log/     # 操作日志查询
│   ├── upload/                # 文件上传(ali-oss + multer)
│   └── public/                # 通用拖拽排序 & 重置排序(泛型 Prisma 模型操作)
prisma/
├── schema.prisma              # 15个数据模型, 5个枚举, MySQL 数据源
├── seed.ts                    # 种子数据入口
├── initData/                  # 按模型拆分的初始化数据(user/role/menu/department/sysConfig/operationLog)
└── migrations/                # 数据库迁移历史
```

## 架构约定

- **统一响应格式**：所有控制器统一返回 `{ code, message, data }`，由 TransformInterceptor 全局包装。若返回对象已包含 `code` 和 `message` 字段则透传。
- **认证机制**：基于 Passport 的 JWT 认证。全局注册 JwtAuthGuard 默认保护所有路由，使用 `@Public()` 装饰器跳过认证。
- **JWT Payload**: `{ userId: number, username: string }`，通过 `@CurrentUser()` 装饰器获取。刷新令牌额外携带 `type: 'refresh'` 字段。
- **角色/权限守卫**：未全局注册，按需使用 `@Roles('admin')` / `@RequirePermissions('user:create')` 装饰在 handler 上。
- **操作日志**：全局 OperationLogInterceptor 自动记录所有非 OPTIONS 请求（通过 EXCLUDE_PATHS 过滤）。可通过 `@OperationLog({ module, description, operationType })` 自定义。
- **Prisma**：使用 `@prisma/adapter-mariadb` 驱动适配器连接 MySQL。schema 中使用 `@map` 将字段映射为 snake_case 列名。软删除采用 `isDeleted` + `deletedTime` 模式（User、Role、Department、Notice、Navigation、NavigationGroup）。
- **数据验证**：全局 ValidationPipe 配置了 `whitelist: true`、`transform: true`、`forbidNonWhitelisted: true`。DTO 统一使用 class-validator + class-transformer。
- **路由前缀**：所有接口以 `/api` 开头，如 `POST /api/auth/login`。
- **Swagger 文档**：自动生成，访问 `/api-docs`。预配置 JWT Bearer 认证，启用 `persistAuthorization` 避免每次刷新页面重新输入 token。
- **路径别名**：`@/` → `./src/`。
- **包管理**：使用 npm 管理依赖。

## 数据库

- MySQL + Prisma ORM。共 15 个模型：User、Department、Role、Menu、RoleMenu、UserRole、RoleDepartment、SysConfig、OperationLog、Notice、UserNotice、Todo、Navigation、NavigationGroup、NavigationGroupNavigation。
- 枚举类型：ConfigType(STRING/NUMBER/BOOLEAN/JSON 等)、Sex(MALE/FEMALE/OTHER)、NoticeType(NOTICE/INFO/ACTIVITY)、OperationType(CREATE/UPDATE/DELETE/VIEW/LOGIN 等)、OperationStatus(SUCCESS/FAILED/PENDING)。
- 时间字段统一使用 `created_time` / `updated_time` 蛇形命名。
- 数据库连接配置在 `.env` 的 `DATABASE_URL` 中，支持通过 `DB_CONNECTION_LIMIT` 等环境变量配置连接池。

## 模块开发规范

- 每个功能模块遵循 NestJS 标准结构：`xxx.module.ts` + `xxx.controller.ts` + `xxx.service.ts` + `dto/` 目录
- 复杂模块(如 system)采用父模块 + 子模块结构，父模块负责聚合导入导出
- Service 层使用 TypeScript JSDoc 注释描述方法功能、参数、返回值、异常
- DTO 统一使用 class-validator 装饰器做输入验证，配合 `@ApiProperty` 生成 Swagger 文档
