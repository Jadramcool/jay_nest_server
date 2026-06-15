# jdm-server → jdm-nest-server 功能迁移计划

## 一、迁移现状评估

### 1.1 已完成模块（6个，完成度100%）

| 模块               | API路由前缀                   | 接口数 | 状态   |
| ---------------- | ------------------------- | --- | ---- |
| auth（认证）         | `/api/auth`               | 9   | ✅ 完成 |
| user（用户管理）       | `/api/system/users`       | 7   | ✅ 完成 |
| role（角色管理）       | `/api/system/roles`       | 6   | ✅ 完成 |
| menu（菜单管理）       | `/api/system/menus`       | 7   | ✅ 完成 |
| department（部门管理） | `/api/system/departments` | 7   | ✅ 完成 |
| sys-config（系统配置） | `/api/system/sys-configs` | 7   | ✅ 完成 |

### 1.2 待迁移模块（7个）

| 模块                 | API路由前缀                                     | 接口数   | 业务重要性 | 技术复杂度 |
| ------------------ | ------------------------------------------- | ----- | ----- | ----- |
| 操作日志（OperationLog） | `/api/system/operation-log`                 | 6+中间件 | ⭐⭐⭐ 高 | ⭐⭐⭐ 高 |
| 通知公告（Notice）       | `/api/notice`                               | 8     | ⭐⭐⭐ 高 | ⭐⭐ 中  |
| 待办事项（Todo）         | `/api/todo`                                 | 8     | ⭐⭐ 中  | ⭐⭐ 中  |
| 导航管理（Navigation）   | `/api/navigation` + `/api/navigation-group` | 11    | ⭐⭐ 中  | ⭐⭐⭐ 高 |
| 文件上传（Upload）       | `/api/upload`                               | 2     | ⭐⭐⭐ 高 | ⭐⭐⭐ 高 |
| 公共排序（Public/Sort）  | `/api/public`                               | 2     | ⭐⭐ 中  | ⭐⭐⭐ 高 |
| AI聊天（AiChat）       | `/api/aiChat`                               | 2     | ⭐ 低   | ⭐⭐ 中  |

### 1.3 待迁移公共基础设施

| 组件               | 原项目实现                       | 迁移状态                       |
| ---------------- | --------------------------- | -------------------------- |
| 操作日志中间件          | 拦截res.json/send/end自动记录     | ❌ 未迁移                      |
| FilterHelper     | 查询过滤（\_\_in, \_\_contains等） | ❌ 未迁移                      |
| FlattenHelper    | 多对多关系扁平化                    | ❌ 未迁移                      |
| PaginationHelper | 分页查询封装                      | ❌ 未迁移                      |
| checkUnique      | 唯一性校验                       | ❌ 未迁移                      |
| AliyunOSSManager | 阿里云OSS文件管理                  | ❌ 未迁移                      |
| routeInfoManager | 路由信息管理                      | ❌ 未迁移                      |
| sendResult中间件    | 统一响应格式                      | ✅ 已由TransformInterceptor替代 |
| errorHandler中间件  | 全局错误处理                      | ✅ 已由异常过滤器替代                |

### 1.4 前端API接口差异分析

前端调用约96个接口，当前后端已实现约43个，**缺口约53个**。关键差异：

| 前端模块 | 前端接口路径                                  | 后端当前路径                           | 差异      |
| ---- | --------------------------------------- | -------------------------------- | ------- |
| 用户管理 | `/system/user/list`                     | `/system/users`                  | 路径不同    |
| 用户管理 | `/system/user/create`                   | `/system/users` (POST)           | 路径不同    |
| 用户管理 | `/system/user/delete/{id}` (PUT)        | `/system/users/:id` (DELETE)     | 方法+路径不同 |
| 用户管理 | `/system/user/batchDelete`              | 无                                | 缺失      |
| 用户管理 | `/system/user/status/{id}`              | 无                                | 缺失      |
| 角色管理 | `/system/role/list`                     | `/system/roles`                  | 路径不同    |
| 角色管理 | `/system/role/create`                   | `/system/roles` (POST)           | 路径不同    |
| 角色管理 | `/system/role/update`                   | `/system/roles/:id` (PUT)        | 路径不同    |
| 角色管理 | `/system/role/delete/{id}`              | `/system/roles/:id` (DELETE)     | 路径不同    |
| 角色管理 | `/system/role/update/menu`              | `/system/roles/:id/menus` (POST) | 路径不同    |
| 菜单管理 | `/system/menu/list`                     | `/system/menus`                  | 路径不同    |
| 菜单管理 | `/system/menu/batchDelete`              | 无                                | 缺失      |
| 菜单管理 | `/system/menu/onlineMenus`              | 无                                | 缺失      |
| 部门管理 | `/system/department/tree`               | `/system/departments/tree`       | 路径不同    |
| 部门管理 | `/system/department/members/{id}`       | 无                                | 缺失      |
| 部门管理 | `/system/department/assign-user`        | 无                                | 缺失      |
| 部门管理 | `/system/department/batch-assign-users` | 无                                | 缺失      |
| 部门管理 | `/system/department/remove-user`        | 无                                | 缺失      |
| 部门管理 | `/system/department/assign-role`        | 无                                | 缺失      |
| 部门管理 | `/system/department/remove-role`        | 无                                | 缺失      |
| 部门管理 | `/system/department/search`             | 无                                | 缺失      |
| 部门管理 | `/system/department/stats`              | 无                                | 缺失      |
| 部门管理 | `/system/department/enable/{id}`        | 无                                | 缺失      |
| 部门管理 | `/system/department/disable/{id}`       | 无                                | 缺失      |
| 操作日志 | `/system/operation-log/*`               | 无                                | 全部缺失    |
| 系统配置 | `/system/config/*`                      | `/system/sys-configs`            | 路径不同    |
| 系统配置 | `/system/config/public`                 | 无                                | 缺失      |
| 系统配置 | `/system/config/validate-password`      | 无                                | 缺失      |
| 系统配置 | `/system/config/batchDelete`            | 无                                | 缺失      |
| 系统配置 | `/system/config/status/{id}`            | 无                                | 缺失      |
| 通知公告 | `/notice/*`                             | 无                                | 全部缺失    |
| 待办事项 | `/todo/*`                               | 无                                | 全部缺失    |
| 导航管理 | `/navigation/*` + `/navigation-group/*` | 无                                | 全部缺失    |
| 文件上传 | `/upload` + `/upload/batch`             | 无                                | 全部缺失    |
| 公共排序 | `/public/sort` + `/public/resetSort`    | 无                                | 全部缺失    |

***

## 二、迁移优先级排序

### 优先级评估维度

| 维度    | 权重  | 说明             |
| ----- | --- | -------------- |
| 业务重要性 | 40% | 核心业务流程依赖程度     |
| 前端依赖度 | 30% | 前端页面是否因缺失而无法使用 |
| 技术复杂度 | 20% | 实现难度和风险        |
| 依赖关系  | 10% | 是否被其他模块依赖      |

### 最终优先级排序

| 优先级    | 模块         | 理由                          |
| ------ | ---------- | --------------------------- |
| **P0** | API路径适配    | 前端所有接口路径与后端不匹配，必须先统一        |
| **P1** | 操作日志模块+中间件 | 审计核心功能，被所有模块依赖，且已有typings基础 |
| **P1** | 文件上传模块     | 头像上传、附件上传等基础功能，前端多处依赖       |
| **P2** | 通知公告模块     | 常见业务功能，前端有完整页面              |
| **P2** | 待办事项模块     | 与通知模块同属notice，一起迁移效率高       |
| **P2** | 公共排序模块     | 多个模块的拖拽排序依赖此功能              |
| **P3** | 导航管理模块     | 独立业务模块，含网站信息抓取等复杂逻辑         |
| **P4** | AI聊天模块     | 非核心功能，可最后迁移                 |
| **P5** | 公共工具类迁移    | FilterHelper等工具类，随模块迁移逐步补充  |

***

## 三、迁移实施流程

### 阶段一：API路径适配（P0）

**目标**：统一前后端API路径，确保现有已实现模块的前端调用正常

**步骤**：

1. 分析前端所有API调用路径
2. 修改后端Controller路由，适配前端路径格式
3. 补充缺失的接口（batchDelete、status切换等）
4. 验证所有已实现模块的前端调用

**具体适配清单**：

| 后端当前路径                             | 适配为前端期望路径                                    | 修改内容      |
| ---------------------------------- | -------------------------------------------- | --------- |
| `GET /system/users`                | `GET /system/user/list`                      | 修改路由      |
| `POST /system/users`               | `POST /system/user/create`                   | 修改路由      |
| `PUT /system/users/:id`            | `PUT /system/user/update`                    | 修改路由+参数方式 |
| `DELETE /system/users/:id`         | `PUT /system/user/delete/:id`                | 修改方法+路由   |
| 无                                  | `PUT /system/user/batchDelete`               | 新增接口      |
| 无                                  | `PUT /system/user/status/:id`                | 新增接口      |
| `GET /system/roles`                | `GET /system/role/list`                      | 修改路由      |
| `POST /system/roles`               | `POST /system/role/create`                   | 修改路由      |
| `PUT /system/roles/:id`            | `PUT /system/role/update`                    | 修改路由+参数方式 |
| `DELETE /system/roles/:id`         | `DELETE /system/role/delete/:id`             | 修改路由      |
| `POST /system/roles/:id/menus`     | `POST /system/role/update/menu`              | 修改路由      |
| `GET /system/menus`                | `GET /system/menu/list`                      | 修改路由      |
| `POST /system/menus`               | `POST /system/menu/create`                   | 修改路由      |
| `PUT /system/menus/:id`            | `PUT /system/menu/update`                    | 修改路由+参数方式 |
| `DELETE /system/menus/:id`         | `DELETE /system/menu/delete/:id`             | 修改路由      |
| 无                                  | `DELETE /system/menu/batchDelete`            | 新增接口      |
| 无                                  | `GET /system/menu/onlineMenus`               | 新增接口      |
| `GET /system/departments`          | `GET /system/department/list`                | 修改路由      |
| `GET /system/departments/tree`     | `GET /system/department/tree`                | 修改路由      |
| `POST /system/departments`         | `POST /system/department/create`             | 修改路由      |
| `PUT /system/departments/:id`      | `PUT /system/department/update`              | 修改路由+参数方式 |
| `GET /system/departments/:id`      | `GET /system/department/detail/:id`          | 修改路由      |
| `DELETE /system/departments/:id`   | `DELETE /system/department/delete/:id`       | 修改路由      |
| 无                                  | `GET /system/department/members/:id`         | 新增接口      |
| 无                                  | `POST /system/department/assign-user`        | 新增接口      |
| 无                                  | `POST /system/department/batch-assign-users` | 新增接口      |
| 无                                  | `DELETE /system/department/remove-user`      | 新增接口      |
| 无                                  | `POST /system/department/assign-role`        | 新增接口      |
| 无                                  | `DELETE /system/department/remove-role`      | 新增接口      |
| 无                                  | `GET /system/department/search`              | 新增接口      |
| 无                                  | `GET /system/department/stats`               | 新增接口      |
| 无                                  | `PUT /system/department/enable/:id`          | 新增接口      |
| 无                                  | `PUT /system/department/disable/:id`         | 新增接口      |
| `GET /system/sys-configs`          | `GET /system/config/list`                    | 修改路由      |
| `GET /system/sys-configs/:id`      | `GET /system/config/detail/:id`              | 修改路由      |
| `GET /system/sys-configs/key/:key` | `GET /system/config/key/:key`                | 修改路由      |
| `POST /system/sys-configs`         | `POST /system/config/create`                 | 修改路由      |
| `PUT /system/sys-configs/:id`      | `PUT /system/config/update`                  | 修改路由+参数方式 |
| `DELETE /system/sys-configs/:id`   | `DELETE /system/config/delete/:id`           | 修改路由      |
| 无                                  | `PUT /system/config/batchDelete`             | 新增接口      |
| 无                                  | `PUT /system/config/status/:id`              | 新增接口      |
| 无                                  | `GET /system/config/public`                  | 新增接口      |
| 无                                  | `POST /system/config/validate-password`      | 新增接口      |

**交付物**：

* 适配后的所有Controller文件

* 新增的接口实现

* API路径对照表文档

***

### 阶段二：操作日志模块+中间件（P1）

**目标**：实现操作日志自动记录和CRUD管理

**步骤**：

1. 创建 `OperationLogModule`（controller/service/module/dto）
2. 实现操作日志NestJS拦截器（替代原Express中间件）
3. 实现日志统计接口（stats）
4. 实现批量删除和清理过期日志
5. 创建 `@OperationLog()` 装饰器用于自定义日志配置

**技术方案**：

* 使用NestJS `Interceptor` 替代原Express中间件拦截res.json/send/end的方式

* 使用NestJS `Reflector` + 自定义装饰器替代原 `OperationLog` 装饰器

* 日志异步写入（使用 `setImmediate` 或事件队列）

**接口清单**：

| 方法     | 路径                                    | 说明         |
| ------ | ------------------------------------- | ---------- |
| GET    | `/system/operation-log/list`          | 获取日志列表（分页） |
| GET    | `/system/operation-log/detail/:id`    | 获取日志详情     |
| GET    | `/system/operation-log/stats`         | 获取日志统计     |
| DELETE | `/system/operation-log/delete/:id`    | 删除日志       |
| POST   | `/system/operation-log/batch-delete`  | 批量删除日志     |
| POST   | `/system/operation-log/clear-expired` | 清理过期日志     |

**交付物**：

* `src/modules/system/operation-log/` 完整模块

* `src/common/interceptors/operation-log.interceptor.ts`

* `src/common/decorators/operation-log.decorator.ts`

***

### 阶段三：文件上传模块（P1）

**目标**：实现文件上传功能，支持本地存储和阿里云OSS

**步骤**：

1. 创建 `UploadModule`（controller/service/module/dto）
2. 集成 `multer` 中间件处理文件上传
3. 实现文件类型验证（MIME + 扩展名双重校验）
4. 实现本地文件存储
5. 实现阿里云OSS存储（迁移AliyunOSSManager）
6. 实现头像上传特殊处理（更新用户avatar字段）

**技术方案**：

* 使用NestJS `FileInterceptor` / `FilesInterceptor` 替代手动multer配置

* 使用 `@UploadFile()` 装饰器处理文件

* AliyunOSSManager 封装为可注入的Provider

**接口清单**：

| 方法   | 路径              | 说明     |
| ---- | --------------- | ------ |
| POST | `/upload`       | 单文件上传  |
| POST | `/upload/batch` | 批量文件上传 |

**交付物**：

* `src/modules/upload/` 完整模块

* `src/common/services/aliyun-oss.service.ts`

* `src/common/dto/upload-options.dto.ts`

***

### 阶段四：通知公告+待办事项模块（P2）

**目标**：实现通知公告和待办事项的完整CRUD和业务逻辑

**步骤**：

1. 创建 `NoticeModule`（notice子模块 + todo子模块）
2. 实现通知CRUD、发送通知、用户通知列表、标记已读
3. 实现待办CRUD、树形结构、完成/取消级联、排序更新、时间线
4. 迁移FilterHelper和PaginationHelper到公共工具

**接口清单 - 通知公告**：

| 方法     | 路径                   | 说明     |
| ------ | -------------------- | ------ |
| GET    | `/notice/list`       | 获取公告列表 |
| GET    | `/notice/detail/:id` | 获取公告详情 |
| POST   | `/notice/create`     | 创建公告   |
| PUT    | `/notice/update`     | 更新公告   |
| DELETE | `/notice/delete/:id` | 删除公告   |
| POST   | `/notice/send`       | 发送公告   |
| GET    | `/notice/userNotice` | 获取用户通知 |
| PUT    | `/notice/read`       | 标记已读   |

**接口清单 - 待办事项**：

| 方法     | 路径                        | 说明      |
| ------ | ------------------------- | ------- |
| GET    | `/todo/list`              | 获取待办列表  |
| GET    | `/todo/detail/:id`        | 获取待办详情  |
| POST   | `/todo/create`            | 创建待办    |
| PUT    | `/todo/update`            | 更新待办    |
| PUT    | `/todo/updateOrder`       | 更新排序    |
| DELETE | `/todo/delete/:id`        | 删除待办    |
| PUT    | `/todo/done/:id/:status?` | 完成/取消待办 |
| GET    | `/todo/timeLine`          | 获取完成时间线 |

**交付物**：

* `src/modules/notice/notice/` 完整子模块

* `src/modules/notice/todo/` 完整子模块

* `src/common/utils/filter-helper.ts`

* `src/common/utils/pagination-helper.ts`

***

### 阶段五：公共排序模块（P2）

**目标**：实现通用拖拽排序功能

**步骤**：

1. 创建 `PublicModule`（controller/service/module）
2. 实现midpoint算法的拖拽排序（before/after/first/last）
3. 实现批量重置排序
4. 实现Prisma模型动态映射

**接口清单**：

| 方法   | 路径                  | 说明   |
| ---- | ------------------- | ---- |
| POST | `/public/sort`      | 拖拽排序 |
| POST | `/public/resetSort` | 重置排序 |

**交付物**：

* `src/modules/public/` 完整模块

***

### 阶段六：导航管理模块（P3）

**目标**：实现导航和导航分组的完整管理，含网站信息抓取

**步骤**：

1. 创建 `NavigationModule`（navigation子模块 + navigation-group子模块）
2. 实现导航CRUD和分组关联管理
3. 实现导航分组CRUD和级联状态管理
4. 实现网站信息抓取（axios+cheerio+iconv-lite）
5. 迁移FlattenHelper

**接口清单**：

| 方法     | 路径                             | 说明         |
| ------ | ------------------------------ | ---------- |
| GET    | `/navigation/list`             | 获取导航列表（公开） |
| GET    | `/navigation/detail/:id`       | 获取导航详情（公开） |
| POST   | `/navigation/create`           | 创建导航       |
| PUT    | `/navigation/update`           | 更新导航       |
| DELETE | `/navigation/delete/:id`       | 删除导航       |
| GET    | `/navigation/website-info`     | 获取网站信息     |
| GET    | `/navigation-group/list`       | 获取分组列表（公开） |
| GET    | `/navigation-group/detail/:id` | 获取分组详情（公开） |
| POST   | `/navigation-group/create`     | 创建分组       |
| PUT    | `/navigation-group/update`     | 更新分组       |
| DELETE | `/navigation-group/delete/:id` | 删除分组       |

**交付物**：

* `src/modules/navigation/navigation/` 完整子模块

* `src/modules/navigation/navigation-group/` 完整子模块

* `src/common/utils/flatten-helper.ts`

* `src/common/utils/check-unique.ts`

***

### 阶段七：AI聊天模块（P4）

**目标**：实现AI聊天功能，支持智谱清言和豆包

**步骤**：

1. 创建 `AiChatModule`（controller/service/module/dto）
2. 集成智谱AI SDK（glm-4）
3. 集成OpenAI SDK（豆包/ark）
4. 实现流式响应（SSE）

**接口清单**：

| 方法   | 路径                   | 说明       |
| ---- | -------------------- | -------- |
| POST | `/aiChat/zhipu-chat` | 智谱AI对话   |
| POST | `/aiChat/chat`       | 豆包AI流式对话 |

**交付物**：

* `src/modules/ai-chat/` 完整模块

***

## 四、代码适配方案

### 4.1 框架差异适配

| 原项目（Express + Inversify）              | 新项目（NestJS）                         | 适配方案                      |
| ------------------------------------- | ----------------------------------- | ------------------------- |
| `@controller("/path")` + `@httpGet`   | `@Controller("path")` + `@Get`      | 直接替换装饰器                   |
| `@injectable()` + `@inject(TYPES.XX)` | `@Injectable()` + 构造函数注入            | 改用NestJS DI               |
| `req.user`                            | `@CurrentUser() user`               | 使用自定义参数装饰器                |
| `res.sendResult(data)`                | 直接return data                       | 由TransformInterceptor统一包装 |
| `class-validator` 手动调用                | `ValidationPipe` 全局自动验证             | 删除手动验证代码                  |
| `FilterHelper` 查询构建                   | Prisma `where` 条件                   | 适配为NestJS Service方法       |
| `PaginationHelper`                    | 自定义分页Service                        | 封装为公共分页工具                 |
| Express中间件                            | NestJS拦截器/守卫                        | 重新实现                      |
| `multer` 手动配置                         | `@UseInterceptors(FileInterceptor)` | 使用NestJS文件上传装饰器           |

### 4.2 响应格式适配

原项目响应格式：`{ data, code, message, errMsg }`
新项目响应格式：`{ code, message, data }`（由TransformInterceptor包装）

前端兼容处理：前端通过 `response.data` 和 `response.code` 访问，需确保字段名一致。

### 4.3 错误处理适配

原项目自定义异常 → 新项目NestJS内置异常映射：

| 原项目异常                   | NestJS异常                     |
| ----------------------- | ---------------------------- |
| BadRequestException     | BadRequestException          |
| UnauthorizedException   | UnauthorizedException        |
| ForbiddenException      | ForbiddenException           |
| NotFoundException       | NotFoundException            |
| ConflictException       | ConflictException            |
| InternalServerException | InternalServerErrorException |

***

## 五、测试方案

### 5.1 单元测试

每个模块迁移完成后编写单元测试：

* Service层：Mock PrismaService，测试业务逻辑

* Controller层：测试路由定义和参数验证

* Guard/Interceptor：测试认证和权限逻辑

### 5.2 集成测试

每个阶段完成后进行集成测试：

* 使用真实数据库连接

* 测试完整的请求-响应流程

* 验证前后端接口对接

### 5.3 性能基准测试

关键模块的性能测试：

* 操作日志中间件对请求延迟的影响

* 文件上传的吞吐量

* 分页查询的响应时间

***

## 六、回滚机制

### 6.1 代码回滚

* 每个阶段完成后创建Git标签（如 `migration-phase-1`）

* 使用功能分支开发，合并前进行Code Review

* 出现问题时可快速回滚到上一个稳定标签

### 6.2 数据库回滚

* Prisma migration 每次变更生成独立迁移文件

* 使用 `prisma migrate reset` 可回滚到任意迁移点

* 生产环境迁移前备份数据库

### 6.3 服务回滚

* 保留旧服务（jdm-server）运行能力

* 新服务部署失败时可切换回旧服务

* 使用Nginx反向代理实现灰度切换

***

## 七、里程碑和交付物

| 里程碑    | 内容      | 交付物                           |
| ------ | ------- | ----------------------------- |
| **M1** | API路径适配 | 适配后的Controller + 新增接口 + 路径对照表 |
| **M2** | 操作日志模块  | OperationLog模块 + 拦截器 + 装饰器    |
| **M3** | 文件上传模块  | Upload模块 + OSS服务 + 文件验证       |
| **M4** | 通知+待办模块 | Notice模块 + Todo模块 + 公共工具类     |
| **M5** | 公共排序模块  | Public模块 + 通用排序服务             |
| **M6** | 导航管理模块  | Navigation模块 + 网站抓取功能         |
| **M7** | AI聊天模块  | AiChat模块 + 流式响应               |
| **M8** | 全面测试+优化 | 单元测试 + 集成测试 + 性能优化            |

