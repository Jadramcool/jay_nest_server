# 权限模型（端维度 + 三级菜单）

> 本文是**实现契约**：改权限相关代码前先读这里。本设计刻意做成"与业务无关"的通用能力，后续可整体移植到模板项目（见文末《移植清单》）。

## 1. 端（platform）维度

一个系统可能有多个客户端，各自需要独立的功能可见性与授权：

| 端标识 | 说明 |
| --- | --- |
| `admin` | 管理后台（默认值） |
| `app` | 移动端 App |
| `mp` | 小程序（预留，未启用） |
| `common` | 两端共享（如"个人中心"这类公共能力） |

- **扩展新端**：只需在 `src/common/constants/platform.ts` 增加一项 + 灌对应种子数据，**不需要改表结构**（列是 `VARCHAR(16)` 而非数据库枚举）。
- 端同时作用在 **角色** 与 **菜单** 上：一个角色属于某个端；一条菜单/按钮属于某个端。

## 2. 三级菜单模型（与端正交）

同一张 `menu` 表承载两个投影：

| 类型 | 作用 | 是否可带 `permission` |
| --- | --- | --- |
| `DIRECTORY` 目录 | 模块分组；路由/侧边栏的一级节点；授权树的容器 | ❌ |
| `MENU` 菜单 | 一个可访问页面（path/component/icon/order/show…） | ❌ |
| `BUTTON` 按钮 | **一个接口权限码**（连"查询列表"也是按钮） | ✅ 唯一允许者 |

- 父子结构约束（`menu-type.rules.ts`）：DIRECTORY 可作根；MENU 父级只能是 DIRECTORY；BUTTON 必须挂在 DIRECTORY/MENU 下。结构非法的节点会从树中静默消失（有启动审计会 warn）。
- **菜单级不做接口鉴权**：它决定"页面能不能进/侧边栏显不显示"（前端把关）；接口安全由 BUTTON 权限码 + `PermissionsGuard` 保证。
- `show=false` 的语义是"不显示入口但允许进入"（详情页等由列表点进去的页面）。

## 3. 鉴权链路

```
POST /api/auth/login { username, password, platform }
  ├ platform 缺省 = admin
  ├ 校验用户在该端至少有一个角色（role.platform ∈ {platform, common}），否则 401
  └ 签发 accessToken/refreshToken，JWT 带 platform 声明

每个请求：Authorization: Bearer <accessToken>
JwtAuthGuard → JwtStrategy.validate
  ├ token.type === 'access'、jti 未被强制下线
  ├ 用户存在 / 未删除 / status === 1
  ├ roles      = 该用户在该端的角色 code（platform ∈ {token.platform, common}）
  └ permissions= 该端可见的 BUTTON 权限码
                 · 系统管理员角色(isSystem)：该端全部启用 BUTTON
                 · 普通角色：其角色关联的该端 BUTTON
PermissionsGuard
  ├ @RequirePermissions('...') 校验权限码（无装饰器 = 放行）
  └ @Platform('app') 校验 token 端（无装饰器 = 不限制端）

GET /api/auth/user/info   → 用户资料 + roles(该端) + permissions(该端)
GET /api/auth/user/menu   → 该端可见菜单（含 BUTTON 行），前端据此注册路由/渲染侧边栏
```

**端隔离的本质**：token 里只有本端权限，所以 App 签发的 token 天然无法通过管理端接口的权限校验（不需要在每个接口上写端判断）；`@Platform` 只是显式声明，做二次兜底。

**归属端 vs 共享端**：角色的 `platform` 是「归属端」，决定它会在哪些端的登录里被加载（`role.platform ∈ {登录端, common}`）。`common` 是共享端、不是登录端——归属端为 `common` 的角色**在所有端都生效**，因此它可以同时持有各端的权限。

## 4. 权限码命名约定

```
<端>:<模块>:<动作>        例：app:report:generate、admin:system:user:create
common:<模块>:<动作>      两端共享的能力
```

- 端前缀必须与菜单行的 `platform` 一致；启动审计会校验（不一致 → warn）。
- 模块段与后端模块目录、App 端 `src/modules/<模块>` 一一对应，便于"模块化"对齐。

## 5. 管理端配置流程

- **菜单管理**：顶部端 Tab（默认「管理端」），树按端过滤；新增/编辑时 `platform` 跟随当前 Tab（避免"在管理端 Tab 里把菜单改成 App 端"的边界态）；提供「通用」Tab 维护 `common` 菜单。
- **角色管理**：角色属于一个端（列表显示并可筛选，所属端可选「通用（全端生效）」）；新建时选择端；「分配菜单权限」弹窗内按端 Tab 分别配置，可配置范围由归属端决定（服务端 `configurablePlatforms()` 同规则校验，越界 400）：
  - 普通角色（admin / app / mp）：本端 + 通用端
  - 通用角色（common）：所有端 + 通用端 —— "一个角色服务多端"的做法（该角色在各端登录时都生效，登录时只下发该端可见的菜单与权限码）
  - 弹窗内各端的勾选独立记忆，保存时合并提交；不属于可配置端的既有授权原样保留，避免被覆盖。
  - 切换角色所属端时，若已分配菜单超出新端的可配置范围，必须先清空权限（否则 400）。
- 配置一个模块的完整流程：后端加接口并挂 `@RequirePermissions('<端>:<模块>:<动作>')` → 菜单管理在该端下建 目录/菜单/按钮 → 角色管理勾选 → 前端（管理端路由/App 入口）自动生效。

## 6. App 端消费方式

App 不消费"目录/菜单/按钮"的树形 UI，但复用同一份数据：

| 菜单数据 | App 用途 |
| --- | --- |
| DIRECTORY（platform=app） | 首页「工具箱」的分组标题 |
| MENU（platform=app） | 工具入口（`path` 对应 uni-app 页面路径，`icon`/`order`/`badge` 直接复用） |
| BUTTON（platform=app） | 页内操作权限码，配合 `hasPermission()` 组合式 |

- App 的 `pages.json` 是编译期生成，**无法动态注册路由**：App 端维护一份本地页面注册表，与服务端菜单取交集；服务端有本地没有的 path → 忽略并上报；本地有但未授权 → 不显示入口，直接进入时提示无权限。
- 未授权页面的拦截方式：toast + 返回上一页（App 无 403 页面概念）。

## 7. 常见坑

1. **给菜单行填 permission 无效**：权限码只从 BUTTON 行采集（`isPermissionOwner`）。
2. **只勾菜单不勾按钮** → 页面能打开但所有接口 403；**只勾按钮不勾菜单** → 接口能调但没有入口。
3. **新增接口忘记建按钮** → 启动审计 warn（"代码声明了但菜单表缺失"），普通角色一律 403。
4. **系统管理员限定本端**：isSystem 角色自动获得的是"**当前端**的全部权限"，不是全库权限。
5. **`Permission` / `RolePermission` 表是遗留**：守卫与菜单树都不读它，功能权限以 `menu` 表 BUTTON 行为唯一真源。

## 8. 移植清单（搬到模板项目时要带走的文件）

后端：
- `prisma/schema.prisma`：`Menu.platform`、`Role.platform`、`UserSession.platform` 及对应迁移
- `src/common/constants/platform.ts`
- `src/common/decorators/platform.decorator.ts`
- `src/common/guards/permissions.guard.ts`（端校验分支）
- `src/modules/auth/*`（登录 DTO 带端、JWT 声明、JwtStrategy 端过滤、user/info|menu 端过滤）
- `src/modules/system/menu/*`、`src/modules/system/role/*`（端字段的增删改查）
- `src/common/services/permission-seed.service.ts`（按端审计）

管理端：
- `src/views/system/menu/*`（端 Tab）
- `src/views/system/role/*`（角色端字段 + 分配弹窗端 Tab）
- `src/api/system/{menu,role}.ts`（端字段类型）

业务侧（**不带进模板**）：`prisma/initData/menu.ts` 里的 `app:*` 菜单与 `APP` 角色、报告模块的 `@RequirePermissions('app:report:*')`。
