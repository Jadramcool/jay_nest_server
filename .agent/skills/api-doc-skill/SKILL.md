---
name: nest-api-doc
description: |
  生成 NestJS 后端 API 请求逻辑文档，供前端开发者参考。当用户提到"生成API文档"、"前后端接口文档"、"请求逻辑文档"、"后端接口说明"、"前端对接文档"、"API接口文档"、"接口清单"、"请求文档"时，务必使用此 Skill。即使用户只是想了解后端有哪些接口、某个模块的请求方式、或者需要一份给前端同事的接口说明，也应触发此 Skill。
---

# NestJS 后端 API 请求逻辑文档生成器

你是一个专门为前端开发者生成后端 API 文档的助手。你的任务是扫描 NestJS 后端项目的源码，分析所有控制器、DTO、守卫、拦截器等，生成一份结构清晰、信息完整的 API 请求逻辑文档。

## 核心目标

前端开发者拿到这份文档后，应该能够：
1. 知道每一个接口的完整请求路径、HTTP 方法
2. 知道哪些接口需要认证、哪些是公开的
3. 知道每个请求需要传什么参数、参数的类型和校验规则
4. 知道响应数据的统一格式
5. 理解全局的请求/响应约定（前缀、拦截器、异常格式等）

## 文档生成流程

### 第一步：扫描项目基础设施

1. 读取 `src/main.ts`，获取：
   - 全局路由前缀（`app.setGlobalPrefix()`）
   - 全局管道配置（ValidationPipe 的 whitelist、transform 等选项）
   - 全局拦截器（响应格式转换、操作日志等）
   - 全局过滤器（异常处理格式）
   - CORS 配置
   - Swagger 配置

2. 读取 `src/app.module.ts`，获取所有注册的模块列表

3. 读取 `src/common/` 目录下的：
   - `decorators/` — 所有自定义装饰器（Public、Roles、Permissions、CurrentUser、OperationLog 等）
   - `guards/` — 所有守卫（JwtAuthGuard、RolesGuard、PermissionsGuard）
   - `interceptors/` — 所有拦截器（TransformInterceptor 等）
   - `filters/` — 所有异常过滤器
   - `dto/` — 公共 DTO（如 PaginationDto）

### 第二步：逐模块扫描控制器和 DTO

对每个模块：

1. 找到所有 `*.controller.ts` 文件，解析：
   - 控制器路由前缀（`@Controller('xxx')`）
   - API 标签（`@ApiTags('xxx')`）
   - 是否需要全局认证（`@ApiBearerAuth()`）
   - 每个路由方法的：
     - HTTP 方法（@Get、@Post、@Put、@Delete）
     - 路由路径
     - 是否公开（@Public()）
     - 是否需要角色（@Roles()）
     - 是否需要权限（@RequirePermissions()）
     - 请求参数来源（@Body、@Query、@Param）
     - 对应的 DTO 类型
     - API 描述（@ApiOperation）
     - HTTP 状态码（@HttpCode）

2. 找到所有 `*.dto.ts` 文件，解析每个 DTO 的：
   - 字段名称
   - 字段类型（从 @IsString、@IsInt、@IsEnum、@IsBoolean、@IsEmail、@IsOptional 等装饰器推断）
   - 是否必填（有无 @IsOptional()）
   - 校验规则（@MinLength、@MaxLength、@Min、@IsEmail 等）
   - API 描述（@ApiProperty / @ApiPropertyOptional 的 description）
   - 默认值

3. 如果 DTO 继承了 PaginationDto，标注分页参数

### 第三步：生成文档

按照下面的模板结构生成完整的 Markdown 文档。

---

## 文档模板

生成文档时，严格按以下结构输出：

### 文档结构

1. **标题与说明** — 项目名称 + 文档用途说明
2. **目录导航** — 可点击跳转的目录
3. **全局约定** — 基础信息、认证方式、响应格式、分页约定、管道配置
4. **各模块文档** — 按模块分章节，每个模块包含模块信息表 + 接口列表
5. **附录** — 请求类型速查表

### 全局约定模板

```markdown
## 一、全局约定

### 1.1 基础信息

| 项目 | 值 |
|------|------|
| 基础地址 | `http://{host}:{port}/{全局前缀}` |
| 全局前缀 | `{从 main.ts 中读取}` |
| 数据库 | `{从 schema.prisma 中读取}` |

### 1.2 认证方式

- **认证类型**：JWT Bearer Token
- **请求头格式**：`Authorization: Bearer {accessToken}`
- **公开接口**：标注了 @Public() 的接口无需认证
- **需要认证的接口**：未标注 @Public() 的接口必须在请求头中携带有效 Token
- **Token 刷新**：使用 refreshToken 调用刷新接口获取新的 Token 对

### 1.3 统一响应格式

所有接口的响应数据由 TransformInterceptor 统一包装：

**成功响应**：
```json
{
  "code": 200,
  "message": "操作成功",
  "data": {}
}
```

**错误响应**（由 HttpExceptionFilter 统一处理）：
```json
{
  "code": 400,
  "message": "错误描述",
  "errMsg": "ERROR_CODE",
  "data": null,
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/xxx"
}
```

### 1.4 分页参数约定

分页查询接口统一支持以下 Query 参数：

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| page | number | 否 | 1 | 页码，最小值 1 |
| pageSize | number | 否 | 10 | 每页数量，最小值 1 |

### 1.5 全局管道配置

- `whitelist: true` — 自动剥离 DTO 中未定义的属性
- `forbidNonWhitelisted: true` — 如果传入 DTO 中未定义的属性，会抛出验证错误
- `transform: true` — 自动将输入数据转换为 DTO 中定义的类型
- `enableImplicitConversion: true` — 启用隐式类型转换

> **前端注意**：请求参数必须严格匹配后端 DTO 定义的字段，多余字段会被拒绝。
```

### 单个接口的文档格式

每个接口必须包含以下信息：

```markdown
#### {HTTP方法} {完整路径} — {接口名称}

| 项目 | 值 |
|------|------|
| 认证 | 🔓 公开 / 🔒 需认证 / 🔒 需认证+角色(xxx) |
| Content-Type | application/json / multipart/form-data |

**请求参数（Body/Query/Path）**：

| 字段 | 类型 | 必填 | 校验规则 | 说明 |
|------|------|------|----------|------|
| xxx | string | 是 | 不能为空 | xxx |

**响应数据**：
（展示完整的统一响应格式 JSON 示例）
```

---

## 关键注意事项

### 路由模式识别

这个项目有一些特殊的路由模式，需要在文档中准确体现：

1. **删除操作可能用 PUT 而非 DELETE**：部分模块的删除和批量删除使用 `@Put('delete/:id')` 和 `@Put('batchDelete')`，而非 HTTP DELETE 方法。务必如实记录，不要擅自改为 DELETE。

2. **更新操作的 id 在 Body 中**：更新接口（`@Put('update')`）的 id 字段放在请求体中，而非路径参数。DTO 类型为 `UpdateXxxDto & { id: number }`。

3. **认证装饰器的组合**：
   - `@Public()` — 接口无需认证
   - 无 `@Public()` — 需要 JWT 认证
   - `@Roles('admin')` — 需要特定角色
   - `@RequirePermissions('user:create')` — 需要特定权限

4. **@CurrentUser() 装饰器**：从 JWT Token 中解析当前用户信息，前端无需传递 userId 等字段，后端自动从 Token 中提取。

5. **文件上传接口**：使用 `multipart/form-data`，不是 `application/json`。

### DTO 解析策略

- 优先读取 DTO 文件中的装饰器信息
- `@ApiProperty` 表示必填字段，`@ApiPropertyOptional` 表示可选字段
- `@IsOptional()` 也标识可选字段
- 如果 DTO 继承了 `PaginationDto`，在文档中标注"继承分页参数"
- 枚举类型（如 Sex、NoticeType、ConfigType）需要列出所有可选值

### 输出质量要求

- 每个接口的文档必须包含：路径、HTTP方法、认证要求、请求参数表、响应示例
- 参数表必须包含：字段名、类型、是否必填、校验规则、说明
- 公开接口用 🔓 标记，需认证接口用 🔒 标记
- 响应示例要展示完整的统一响应格式（包含 code、message、data）
- 模块之间用分隔线区分，层次清晰
- 在文档开头提供目录导航

### 扫描范围

按以下目录结构扫描源码：

```
src/
├── main.ts                    # 全局配置
├── app.module.ts              # 模块注册
├── common/
│   ├── decorators/            # 自定义装饰器
│   ├── dto/                   # 公共 DTO
│   ├── filters/               # 异常过滤器
│   ├── guards/                # 守卫
│   └── interceptors/          # 拦截器
├── modules/
│   ├── auth/                  # 认证模块
│   ├── health/                # 健康检查
│   ├── navigation/            # 导航模块
│   ├── notice/                # 通知模块
│   ├── public/                # 公共接口
│   ├── system/                # 系统管理
│   └── upload/                # 文件上传
└── prisma/
    └── schema.prisma          # 数据模型定义
```

如果项目结构与上述不同，以实际项目结构为准。先扫描目录确认结构，再按模块逐个分析。
