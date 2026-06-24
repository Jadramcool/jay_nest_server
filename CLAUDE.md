# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# 启动开发服务器（热重载）
npm run dev

# 构建
npm run build

# 生产模式启动
npm run start:prod

# 代码检查 + 自动修复
npm run lint

# 代码格式化
npm run format

# 单元测试（Jest, rootDir: src, 匹配 *.spec.ts）
npm run test

# 单个文件测试
npx jest src/path/to/file.spec.ts

# E2E 测试（配置在 test/jest-e2e.json）
npm run test:e2e

# 测试覆盖率
npm run test:cov

# 调试测试
npm run test:debug

# Prisma: schema 变更后重新生成客户端
npm run prisma:generate

# Prisma: 创建并应用迁移
npm run prisma:migrate -- --name <迁移名称>

# Prisma: 打开 Studio 图形化管理界面 (localhost:5555)
npm run prisma:studio

# Prisma: 填充种子数据
npm run prisma:seed
```

## Key Architecture Patterns

- **全局 JWT 认证**：`JwtAuthGuard` 在 `AuthModule` 中通过 `APP_GUARD` 全局注册，默认保护所有路由。使用 `@Public()` 跳过认证。`RolesGuard` 同样全局注册，但仅在被 `@Roles()` 或 `@RequirePermissions()` 装饰的 handler 上生效。

- **JWT 策略（`JwtStrategy`）**：每次请求从 Header 解析 token 后，会查询数据库验证用户状态（未删除、已启用），并收集用户的 `roles`（角色 code 列表）和 `permissions`（菜单 permission 列表）挂载到 `request.user` 上。变更角色/权限需要重新登录。

- **统一响应格式**：`TransformInterceptor` 全局包装响应为 `{ code: 200, message: "操作成功", data }`。若返回对象已包含 `code` 和 `message` 则透传。

- **操作日志**：`OperationLogInterceptor` **自动**记录所有 POST/PUT/PATCH/DELETE 请求（GET/OPTIONS 跳过，路径白名单 `EXCLUDE_PATHS` 跳过）。通过 `@OperationLog({operationType, module, description})` 自定义日志内容。日志写入是 fire-and-forget 异步调用（`createLogAsync`），不阻塞响应。

- **自定义查询参数解析**：使用 `@QueryWithOps(Dto)` 装饰器（而非 `@Query()`）支持的 DTO 字段查询 + `field__operator` 后缀的高级过滤（如 `username__eq=admin`、`status__in=0,1`）。DTO 仅校验标准字段，`__` 后缀参数透传。

- **路由前缀**：所有接口以 `/api` 开头，如 `POST /api/auth/login`，在 `main.ts` 通过 `setGlobalPrefix('api')` 设置。

- **Swagger 文档**：`/api-docs`，预配置 Bearer JWT 认证 + `persistAuthorization: true`。

- **Prisma 适配**：使用 `@prisma/adapter-mariadb` 作为驱动适配器连接 MySQL（`PrismaService` 构造函数中传入连接字符串）。时间字段使用 `created_time` / `updated_time` 蛇形命名（通过 `@map` 映射）。

- **软删除**：User、Role、Department、Notice、Navigation、NavigationGroup 使用 `isDeleted` + `deletedTime` 模式。

- **路径别名**：`@/` → `./src/`

## Module Structure

```
src/
├── main.ts              # 入口：全局管道/拦截器/过滤器/CORS/Swagger
├── app.module.ts        # 根模块：ConfigModule + PrismaModule + AuthModule + SystemModule + UploadModule + PublicModule
├── prisma/              # 全局 PrismaModule
├── common/              # 共享横切关注点
│   ├── decorators/      # @Public, @CurrentUser, @Roles, @RequirePermissions, @OperationLog, @QueryWithOps
│   ├── guards/          # JwtAuthGuard(全局), RolesGuard, PermissionsGuard
│   ├── interceptors/    # TransformInterceptor, OperationLogInterceptor
│   ├── filters/         # HttpExceptionFilter, PrismaExceptionFilter
│   ├── dto/             # PaginationDto
│   └── utils/           # module-resolver.util(路由→中文模块名映射), param-sanitizer.util, ip.util
├── modules/
│   ├── auth/            # JWT登录/注册/刷新/登出 + 用户信息/菜单/密码管理
│   ├── system/
│   │   ├── user/        # CRUD + 批量删除 + 状态切换 + 角色分配 + 密码重置
│   │   ├── role/        # CRUD + 菜单权限分配
│   │   ├── menu/        # 菜单树 + CRUD
│   │   ├── department/  # 部门层级树 + CRUD
│   │   ├── sys-config/  # 系统配置(key-value 多类型存储)
│   │   └── operation-log/ # 操作日志查询
│   ├── upload/          # 阿里云 OSS 文件上传(multer + ali-oss)
│   └── public/          # 泛型拖拽排序 & 重置排序(任意 Prisma 模型)
prisma/
├── schema.prisma        # 15个模型, 5个枚举, MySQL数据源
├── seed.ts              # 种子数据入口
└── initData/            # 按模型拆分的初始化数据
```

## Module Development Conventions

- 每个模块遵循 NestJS 标准结构：`xxx.module.ts` + `xxx.controller.ts` + `xxx.service.ts` + `dto/` 目录
- 复杂模块（如 system）采用父模块聚合子模块，父模块负责导入和导出
- DTO 使用 class-validator 做输入验证 + `@ApiProperty` 生成 Swagger 文档。全局 ValidationPipe 配置了 `whitelist: true`、`transform: true`、`forbidNonWhitelisted: true`
- Controller 中使用 `@RequirePermissions('module:action')` 做权限控制（如 `'system:user:create'`），权限标识与前端路由表定义保持一致
- Service 层使用 JSDoc 注释描述方法功能、参数、返回值

## Database

- MySQL + Prisma ORM，使用 `@prisma/adapter-mariadb` 驱动
- 15 个模型：User、Department、Role、Menu、RoleMenu、UserRole、RoleDepartment、SysConfig、OperationLog、Notice、UserNotice、Todo、Navigation、NavigationGroup、NavigationGroupNavigation
- 5 个枚举：ConfigType (STRING/NUMBER/BOOLEAN/JSON/ARRAY/FILE/EMAIL/URL/PASSWORD)、Sex (MALE/FEMALE/OTHER)、NoticeType (NOTICE/INFO/ACTIVITY)、OperationType (CREATE/UPDATE/DELETE/VIEW/LOGIN/LOGOUT/EXPORT/IMPORT/OTHER)、OperationStatus (SUCCESS/FAILED/PENDING)
- 软删除模型使用 `isDeleted: Boolean` + `deletedTime: DateTime?`
- 多对多关联表（RoleMenu、UserRole、RoleDepartment、UserNotice、NavigationGroupNavigation）使用复合唯一索引避免重复

## API Conventions

- 列表接口：`GET /api/system/xxx/list`，支持分页参数 `page`/`pageSize`（通过 `PaginationDto`）
- 详情接口：`GET /api/system/xxx/detail/:id`
- 创建接口：`POST /api/system/xxx/create`
- 更新接口：`PUT /api/system/xxx/update`
- 删除接口：`PUT /api/system/xxx/delete/:id`（注意用 PUT 而非 DELETE）
- 批量删除：`PUT /api/system/xxx/batchDelete`
- 拖拽排序：`POST /api/public/sort` + `POST /api/public/resetSort`（泛型，支持任意 Prisma 模型）
