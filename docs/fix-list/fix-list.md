# Fix List — jdm-nest-server

> 审计时间: 2026-06-24
> P0: 6 个 | P1: 2 个 | P2: 若干

---

## Pending (待修复)

### [P0-01] PermissionsGuard 未注册为全局守卫

- **类型**: 权限绕过
- **位置**: `src/modules/auth/auth.module.ts:36-43`
- **描述**: `PermissionsGuard` 已在 `src/common/guards/permissions.guard.ts` 中完整实现，但未在 `auth.module.ts` 的 `providers` 中以 `APP_GUARD` 注册。全站 65 处 `@RequirePermissions()` 装饰器全部无效，任何持有 JWT Token 的用户（包括自行注册的普通用户）均可调用所有管理接口。
- **影响**: 全站 RBAC 体系完全失效，涵盖用户创建、密码重置、角色菜单分配、部门管理、系统配置修改等高危操作。
- **修复方案**: 在 `auth.module.ts` 的 `providers` 中添加 `{ provide: APP_GUARD, useClass: PermissionsGuard }`。
- **状态**: 待修复

---

### [P0-02] 文件上传 `folder` 参数路径穿越

- **类型**: 安全漏洞 (路径穿越 → RCE)
- **位置**: `src/modules/upload/upload.service.ts:48,54`
- **描述**: `upload.controller.ts` 直接从请求体获取 `folder` 参数（第 37 行），`upload.service.ts` 将其直接拼入 `path.join(process.cwd(), 'uploads', folder)`（第 48 行）。`folder` 参数未经任何消毒，攻击者可传入 `../../../etc` 路径。文件名经过 `generateSafeFileName()` 消毒，但目录路径完全可控。
- **影响**: 可写入任意系统目录（覆盖配置文件、写入 Webshell），远程代码执行风险。
- **修复方案**: 对 `folder` 做白名单校验（限定 `avatar/image/document/video/audio`），或做路径合法性检查（禁止包含 `..`、`/`、`\`）。
- **状态**: 待修复

---

### [P0-03] JWT_SECRET 硬编码降级

- **类型**: 安全漏洞 (身份伪造)
- **位置**: 
  - `src/modules/auth/auth.module.ts:21`
  - `src/modules/auth/strategies/jwt.strategy.ts:23`
  - `src/modules/auth/strategies/jwt-refresh.strategy.ts:48`
  - `src/modules/auth/auth.service.ts:240`
- **描述**: 四处代码均使用 `configService.get<string>('JWT_SECRET') || 'your-secret-key'`。当 `.env` 中 `JWT_SECRET` 未设置或加载失败时，自动降级为公开已知的弱密钥 `your-secret-key`。
- **影响**: 攻击者可伪造任意用户 JWT Token，包括管理员 Token，实现完全接管。
- **修复方案**: 移除 `|| 'your-secret-key'` 回退，改用 `configService.getOrThrow<string>('JWT_SECRET')`，确保缺少配置时启动即报错。
- **状态**: 待修复

---

### [P0-04] `.env` 文件已泄露至 Git 远程仓库

- **类型**: 密钥泄露
- **位置**: `.env`（Git 历史中已包含）
- **描述**: `.env` 文件在被加入 `.gitignore` 前已提交到远程仓库。数据库连接、JWT 密钥和第三方 API Key 均应视为已泄露；本文档不再重复记录凭据原文。
- **影响**: 攻击者可直接连接数据库、伪造 JWT Token、消耗第三方 API 额度。
- **修复方案**: 
  1. 立即轮换所有已泄露的密钥凭证
  2. 使用 `git filter-branch` 或 BFG Repo-Cleaner 从 Git 历史中移除 `.env`
  3. 强制 `git push --force` 重写远程历史
  4. 确认 `.gitignore` 已正确包含 `.env`
- **状态**: 待修复

---

### [P0-05] 密码重置接口无 DTO 校验

- **类型**: 输入验证缺失
- **位置**: `src/modules/system/user/user.controller.ts:93-103`
- **描述**: `resetPassword` 方法使用 `@Body('newPassword') newPassword: string` 直接提取参数，未使用 DTO，无任何 `class-validator` 装饰器（如 `@MinLength`、`@IsString`）。管理员可将任意用户密码设为空字符串或极弱密码。
- **影响**: 拥有 `system:user:reset-password` 权限的用户可设置空密码或弱密码，导致被重置密码的账户可被他人轻易登录接管。
- **修复方案**: 创建 `ResetPasswordDto` 并添加 `@IsString()` `@MinLength(8)` `@MaxLength(32)` 等验证装饰器。
- **状态**: 待修复

---

### [P0-06] CORS 全开放 + 软删除缺陷

- **类型**: 安全配置错误 / 数据不一致
- **位置**: 
  - CORS: `src/main.ts:45`
  - 软删除查询: `src/modules/system/user/user.service.ts:129-131`, `role.service.ts:111-144`, `department.service.ts:107-156`
  - 关联表清理: `src/modules/system/role/role.service.ts:184-202`, `user.service.ts:242-260`
- **描述**: 
  1. `app.enableCors()` 无任何配置参数，允许任意域名跨域访问
  2. `findOne` 查询详情时未过滤 `isDeleted: false`，已删除记录可通过详情接口查看
  3. 角色/用户软删除时未清理 `UserRole`、`RoleMenu`、`RoleDepartment` 等关联表，导致:
     - 角色恢复后菜单权限丢失
     - 相同 `(userId, roleId)` 的唯一约束冲突，无法重新分配
     - 创建同名资源时因软删除记录占用唯一索引而失败
- **影响**: 任意跨域请求 + 信息泄露 + 数据永久不一致 + 功能阻塞
- **修复方案**: 
  1. CORS 限定 `origin` 白名单
  2. 所有 `findUnique`/`findFirst` 查询添加 `isDeleted: false` 条件
  3. 软删除时用 `$transaction` 同步清理关联表
- **状态**: 待修复

---

### [P1-01] QueryWithOps 绕过 DTO 白名单校验

- **类型**: 参数注入
- **位置**: `src/common/decorators/query-with-ops.decorator.ts:37-61`
- **描述**: `__` 后缀参数完全跳过 DTO 校验（`whitelist: true, forbidNonWhitelisted: true` 只对非 `__` 参数生效），直接合并到返回对象中。攻击者可对任意字段使用任意操作符（如 `username__startsWith`、`password__contains`）进行数据盲注。
- **影响**: 可探测数据库数据，虽非 SQL 注入（Prisma 参数化查询），但可能通过操作符滥用进行数据枚举。
- **修复方案**: 对 `ops` 参数也做白名单验证，只允许 DTO 中定义的字段使用 `__` 后缀。
- **状态**: 待修复

---

### [P1-02] refreshToken 无轮换机制 + 操作日志未脱敏

- **类型**: Token 重放 / 敏感信息泄露
- **位置**: 
  - Token 轮换: `src/modules/auth/auth.service.ts:234-263`
  - 日志脱敏: `src/common/utils/param-sanitizer.util.ts`
- **描述**: 
  1. 刷新 Token 时不标记旧 refreshToken 为已使用，泄露后可无限使用
  2. `param-sanitizer.util.ts` 仅脱敏 `password/oldPassword/newPassword`，未包含 `refreshToken/token/secret/apiKey` 等字段
- **影响**: refreshToken 泄露后可持久获取新 accessToken；操作日志中可能以明文记录 refreshToken
- **修复方案**: 实现 Refresh Token Rotation + 扩展敏感字段列表
- **状态**: 待修复

---

### [P2-*] 其他需关注问题

| 问题 | 位置 | 简述 |
|------|------|------|
| 登录无暴力破解防护 | `auth.controller.ts:58-67` | 无验证码、无速率限制、无账户锁定 |
| 注册接口无限制 | `auth.controller.ts:76-86` | 开放注册，账户自动启用，无频率限制 |
| `fileType=all` 默认拒所有文件 | `upload-options.dto.ts:48` | 功能性 Bug，上传功能默认不可用 |
| 仅校验扩展名不校验 MIME | `upload.service.ts:37-45` | 可上传伪装扩展名的恶意文件 |
| uploads 静态文件服务无访问控制 | `main.ts:17` | 上传文件可被任意访问 |
| 密码策略不一致 | `update-password.dto.ts:11` | 改密码最小长度 6，注册要求 8 |
| 密码修改 DTO 最小长度不一致 | `register.dto.ts:24` vs `update-password.dto.ts:11` | 策略不统一 |

---

## Fixed (已修复)

（暂无）

---

## 修复优先级

| 优先级 | 编号 | 估计工作量 |
|--------|------|-----------|
| 紧急 | P0-01 (权限守卫) | 10 分钟 |
| 紧急 | P0-03 (JWT 降级) | 10 分钟 |
| 紧急 | P0-04 (密钥泄露) | 30 分钟 + Git 历史清洗 |
| 紧急 | P0-05 (密码重置校验) | 20 分钟 |
| 高 | P0-02 (路径穿越) | 20 分钟 |
| 高 | P0-06 (CORS + 软删除) | 2 小时 |
| 中 | P1-01 (QueryWithOps) | 1 小时 |
| 中 | P1-02 (Token 轮换 + 脱敏) | 2 小时 |
