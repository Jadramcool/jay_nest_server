# Dashboard 改版开发文档

> 状态：待评审  
> 涉及仓库：`jdm-nest-server`（后端）、`jdm-admin`（前端）  
> 关联背景：代码审查发现 dashboard 四个接口对任意登录用户开放，其中 `system-info`（服务器基础设施信息）与 `activities`（全站操作日志）属敏感数据；同时首页内容对普通用户毫无价值。

---

## 1. 背景与问题

### 1.1 现状

| 接口 | 返回内容 | 现有权限 | 问题 |
| --- | --- | --- | --- |
| `GET /dashboard/stats` | 用户/角色/菜单/部门/日志总数、新增用户趋势 | 仅登录 | `onlineCount` 硬编码为 `0`，而 `UserSession` 有真实在线数据 |
| `GET /dashboard/trends` | 近 N 天访问/用户/操作曲线 | 仅登录 | `visits` 与 `operations` 是两条完全相同的查询（数据源 bug）；逐日 3 次 count 为 N+1（days 上限已钳制 1-90） |
| `GET /dashboard/system-info` | CPU/内存、uptime、Node 版本、平台、DB 日志条数 | 仅登录 | 基础设施侦察信息，任何登录用户可周期性探测；且该数据本质属于监控页而非首页 |
| `GET /dashboard/activities` | **全站**最近操作日志（谁/对什么接口/什么操作/成败） | 仅登录 | 与操作日志查询口（需 `system:operation-log:list`）权限不一致，横向信息泄露 |

### 1.2 根因

首页是全员落地页，但内容全部是**管理员运营数据**。权限问题（越权）与产品问题（对普通用户无用）同源。

### 1.3 设计原则

> **管理员看系统（运营看板），用户看自己（个人工作台）。**

所有推荐数据均有现成数据源，零新增表。

---

## 2. 目标与非目标

**目标**

1. 首页按登录者权限呈现两套视图：运营看板（管理员）/ 个人工作台（普通用户）
2. 敏感接口收口：`system-info` 加权限并迁移至监控页；`activities` 按权限分级降级
3. 修复 `stats` 假在线数与 `trends` 数据源 bug（顺带消除 N+1）

**非目标**

- 不做报表导出、自定义布局拖拽
- 不新增统计中间表/定时任务（聚合均实时查询，days 钳制后量级可控）
- 不改动现有接口的响应结构（保证前端向后兼容，仅内容语义微调）

---

## 3. 后端设计

### 3.1 新增 `GET /api/dashboard/mine`（个人工作台聚合接口）

任何登录用户可调用，一次请求返回工作台全部数据。

**响应结构**（字段名与 Prisma 模型对齐）：

```jsonc
{
  "todo": {
    "openCount": 5,      // isDone=false 数量
    "doneCount": 12,     // isDone=true 数量
    "recent": [          // 最近 5 条未完成
      { "id": 1, "title": "…", "isDone": false, "createdTime": "…" }
    ]
  },
  "notice": {
    "unreadCount": 2,    // UserNotice: userId=我 且 (readTime IS NULL 或 isDeleted=false 且无 readTime)
    "recent": [          // 最近 5 条分配给我的公告
      { "id": 1, "title": "…", "publishedAt": "…", "readTime": null }
    ]
  },
  "myActivities": [      // 本人最近 8 条操作（字段与 activities 现有返回结构一致）
    { "action": "…", "module": "…", "operationType": "UPDATE", "time": "…", "status": 200 }
  ]
}
```

**实现要点**

- 三个数据块 `Promise.all` 并行；每个子查询独立 try/catch，单块失败返回空值而非整体 500
- 待办：`todo.findMany({ where: { userId, isDone: false }, orderBy createdTime desc, take: 5 })` + 两个 count
- 未读公告：以 `UserNotice`（`userId=我`、`isDeleted=false`、`readTime=null`）为准；recent 取已分配（含已读）的最近 5 条并关联 Notice（过滤 `isDeleted`、`status=1`）
- 我的动态：`operationLog.findMany({ where: { userId }, orderBy createdTime desc, take: 8 })`，映射复用 `getActivities` 现有字段映射逻辑（抽私有方法共用）

### 3.2 `GET /api/dashboard/stats` 增强

- 注入 `SessionService`（SessionModule 已 export），`onlineCount` 改为真实值：`userSession.count({ where: { expiresAt: { gt: new Date() } } })`——与 `sessionService.getStats()` 现有逻辑一致，优先复用该方法
- 其余字段不变

### 3.3 `GET /api/dashboard/trends` 修复

- **数据源重定义**：`visits` = 前端上报的 pageview 事件数（`ClientEvent`，`type='pageview'`）；`operations` = 操作日志条数。两个指标从此语义独立
- **消除 N+1**：Prisma `groupBy` 不支持日期截断，改用参数化 `$queryRaw` 按日聚合：

```sql
-- visits（ClientEvent）
SELECT DATE(created_time) AS day, COUNT(*) AS cnt
FROM client_event
WHERE type = 'pageview' AND created_time >= ?
GROUP BY DATE(created_time)

-- operations（OperationLog）
SELECT DATE(created_time) AS day, COUNT(*) AS cnt
FROM operation_log
WHERE created_time >= ?
GROUP BY DATE(created_time)
```

- 两次查询并行；应用层把结果映射到连续日期数组（缺失日期补 0，与现有返回结构一致）
- 时区：`DATE()` 取数据库会话时区，与现状一致；文档记录该约定，不额外处理
- `days` 钳制 1–90 已在控制器完成，保持

### 3.4 `GET /api/dashboard/activities` C2 权限降级

- 控制器注入 `@CurrentUser()`，传入 service
- 判定逻辑：

```ts
const isAuditor = caller?.permissions?.includes('system:operation-log:list');
const where = isAuditor ? {} : { userId: caller.userId };
```

- 有权限 → 全站动态（现行为）；无权限 → 仅本人操作记录
- 响应结构不变（前端零改动）
- 在 controller/service 注释中标注这是有意的分级设计（非漏加权限）

### 3.5 `GET /api/dashboard/system-info` 收口

- 加 `@RequirePermissions('system:monitor:view')`
- 响应结构不变

### 3.6 权限码与菜单种子

- `prisma/initData/menu.ts`：在**监控（monitor）**菜单下新增 BUTTON 型子项：
  - `name: '系统监控查看'`、`permission: 'system:monitor:view'`、`type: 'BUTTON'`
- isSystem 角色自动继承全部权限码，无需额外授权
- 存量数据库：seed 为按 key 增量补充（`d86586c` 已实现），跑一次 seed 即可补齐

---

## 4. 前端设计（jdm-admin）

### 4.1 首页视图切换

- 判定依据：复用权限 store 的 `hasPermission`（与 `v-auth` 指令同源），开关权限码为 **`system:operation-log:list`**（持有审计查询权 ≈ 运营人员，与 activities C2 的全站权限一致，不引入新前端判定规则）
- `views/home/index.vue`：

```
hasPermission('system:operation-log:list')
  ? 运营看板视图（现有 StatCards + TrendChart + RecentActivity）
  : 个人工作台视图（WelcomeBanner + TodoCard + NoticeCard + MyActivityCard + QuickEntries）
```

- 切换是渲染层选择，不做路由拆分

### 4.2 工作台组件（新增，均为轻量组合）

| 组件 | 内容 | 调用 |
| --- | --- | --- |
| `WorkbenchTodoCard` | 未完成/已完成计数 + 最近 5 条未完成，行内快捷勾选完成 | `DashboardApi.mine()`（+ 现有 `TodoApi.toggle`） |
| `WorkbenchNoticeCard` | 未读数徽标 + 最近 5 条公告，点击查看并标记已读 | `DashboardApi.mine()`（+ 现有已读接口） |
| `WorkbenchActivityCard` | 本人最近 8 条操作 | `DashboardApi.mine()` |
| `QuickEntries` | 个人中心、修改密码等固定捷径 | 纯配置数组 |

- 统一从 `DashboardApi.mine()` 取数（单请求），卡片间共享一个响应式数据源
- 组件放 `src/views/home/components/workbench/`

### 4.3 SystemInfo 迁移

- `SystemInfo.vue` 从 `views/home/components/` 迁移引用至 `views/monitor/index.vue`（monitor 页组装：系统信息卡 + 现有错误事件表格）
- 首页移除该 widget；`@refresh` 死监听等 monitor 页已知小问题不在本次范围

### 4.4 API 层

- `src/api/dashboard/dashboard.ts` 新增 `mine` 方法与 `Dashboard.MineInfo` 类型（typings 由 openapi 导出流程同步）

---

## 5. 兼容性说明

| 变更 | 兼容性 |
| --- | --- |
| `stats` 增加 `onlineCount` 真实值 | 结构不变，前端无需改动 |
| `trends` visits 数据源重定义 | 结构不变；**语义变化**：曲线含义从"重复的操作量"变为真实页面访问量，需在图表 tooltip/标题标注口径 |
| `activities` C2 降级 | 结构不变；普通用户收到本人数据 |
| `system-info` 加权限 | 无权限调用返回 403；首页已不渲染该组件，普通用户不受影响 |
| 新增 `mine` | 纯新增 |

---

## 6. 测试要求

后端（`*.spec.ts`，遵循 AGENTS.md 聚焦测试约定）：

1. `dashboard.service.spec.ts`
   - `mine`：三数据块并行返回；单块异常时该块为空值且不抛出
   - `getStats`：`onlineCount` 来自 SessionService 而非硬编码
   - `getTrends`：mock `$queryRaw` 验证参数化 SQL 与缺失日期补 0
   - `getActivities`：有权限返回全站 / 无权限强制 `userId` 条件
2. 权限装饰器：`system-info` 未持 `system:monitor:view` 时 403（守卫层已有测试基建，补一例）

前端：

1. `pnpm typecheck` + `pnpm lint` 必须通过（AGENTS.md 硬性要求）
2. e2e（`e2e/mocks/api.ts` 增加 mine mock）：登录后普通用户展示工作台、管理员展示看板各一例

---

## 7. 实施步骤

| 阶段 | 内容 | 交付物 |
| --- | --- | --- |
| P1 后端数据修复 | stats 真在线数、trends 数据源+聚合、单测 | 后端提交 |
| P2 后端权限收口 | mine 接口、activities C2、system-info 权限、菜单种子 | 后端提交 + seed 验证 |
| P3 前端工作台 | 视图切换、四个组件、API/typings | 前端提交 |
| P4 收尾 | SystemInfo 迁移 monitor、e2e mock、openapi 导出同步 | 前端提交 |

每阶段独立提交（Conventional Commits），后端先行。

## 8. 验收标准

- [ ] 普通用户登录：首页为工作台（待办/通知/我的动态），Network 中无 `system-info` 请求
- [ ] 管理员登录：首页为看板，在线人数为真实值，趋势图两指标数值不再相同
- [ ] 无 `system:operation-log:list` 权限直接 curl `/dashboard/activities`：仅返回本人记录
- [ ] 无 `system:monitor:view` 权限直接 curl `/dashboard/system-info`：403
- [ ] 后端 `build/test/lint` 全绿；前端 `typecheck/lint/test` 全绿

## 9. 风险与对策

| 风险 | 对策 |
| --- | --- |
| `$queryRaw` 注入 | 仅传入参数化的日期阈值（`Prisma.sql`/占位符），days 已钳制 1-90 |
| pageview 数据早期为 0 | 趋势图空态展示"暂无访问数据"，不做除零计算 |
| 时区口径 | 沿用数据库会话时区，文档已记录；跨时区部署时再统一 |
| 存量库菜单种子 | seed 已支持按 key 增量，跑 `prisma:seed` 即可；上线说明中标注 |
| C2 语义隐式 | controller/service 双处注释 + 本文档第 3.4 节，避免后续被当漏改 |
