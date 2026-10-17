# JDM NestJS Server API 接口文档

> 基础路径：`/api`  
> 认证方式：JWT Bearer Token（Header: `Authorization: Bearer <token>`）  
> 统一响应格式：`{ code: number, message: string, data: any }`

---

## 目录

- [1. 健康检查](#1-健康检查)
- [2. 认证模块](#2-认证模块)
- [3. 用户管理](#3-用户管理)
- [4. 角色管理](#4-角色管理)
- [5. 菜单管理](#5-菜单管理)
- [6. 部门管理](#6-部门管理)
- [7. 系统设置](#7-系统设置)
- [8. 操作日志](#8-操作日志)
- [9. 文件上传](#9-文件上传)
- [10. 公共接口](#10-公共接口)
- [附录：枚举类型](#附录枚举类型)
- [附录：错误码](#附录错误码)

---

## 1. 健康检查

### 1.1 服务健康检查

```
GET /api/health
```

**认证**：无需认证（`@Public`）

**响应示例**：

```json
{
  "code": 200,
  "message": "操作成功",
  "data": {
    "status": "ok",
    "timestamp": "2026-06-01T08:00:00.000Z",
    "uptime": 3600.123,
    "environment": "development",
    "version": "1.0.0",
    "database": {
      "isConnected": true,
      "latency": 5,
      "timestamp": "2026-06-01T08:00:00.000Z"
    }
  }
}
```

### 1.2 数据库健康检查

```
GET /api/health/database
```

**认证**：无需认证（`@Public`）

**响应示例**：

```json
{
  "code": 200,
  "message": "操作成功",
  "data": {
    "isConnected": true,
    "latency": 5,
    "timestamp": "2026-06-01T08:00:00.000Z"
  }
}
```

---

## 2. 认证模块

### 2.1 用户登录

```
POST /api/auth/login
```

**认证**：无需认证（`@Public`）

**请求体**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `username` | string | 是 | 用户名 |
| `password` | string | 是 | 密码 |
| `captcha` | string | 否 | 验证码 |
| `captchaId` | string | 否 | 验证码ID |

**请求示例**：

```json
{
  "username": "admin",
  "password": "123456"
}
```

**响应** (200)：

```json
{
  "code": 200,
  "message": "操作成功",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 7200,
    "tokenType": "Bearer"
  }
}
```

**错误响应**：

| 状态码 | 说明 |
|--------|------|
| 401 | 用户名或密码错误 |
| 401 | 用户已被删除 |
| 401 | 用户已被禁用 |

---

### 2.2 用户注册

```
POST /api/auth/register
```

**认证**：无需认证（`@Public`）

**请求体**：

| 字段 | 类型 | 必填 | 说明 | 校验规则 |
|------|------|------|------|----------|
| `username` | string | 是 | 用户名 | 4-20字符，仅字母数字下划线 |
| `password` | string | 是 | 密码 | 8-32字符 |
| `confirmPassword` | string | 是 | 确认密码 | 必须与password一致 |
| `phone` | string | 否 | 手机号 | - |
| `email` | string | 否 | 邮箱 | 需合法邮箱格式 |

**请求示例**：

```json
{
  "username": "user123",
  "password": "12345678",
  "confirmPassword": "12345678",
  "phone": "13800138000",
  "email": "user@example.com"
}
```

**响应** (201)：

```json
{
  "code": 200,
  "message": "操作成功",
  "data": {
    "userId": 1,
    "username": "user123"
  }
}
```

**错误响应**：

| 状态码 | 说明 |
|--------|------|
| 400 | 两次密码输入不一致 |
| 409 | 用户名已存在 |
| 409 | 邮箱已被注册 |
| 409 | 手机号已被注册 |

---

### 2.3 刷新 Token

```
POST /api/auth/refresh
```

**认证**：无需认证（`@Public`）

**请求体**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `refreshToken` | string | 是 | 刷新令牌 |

**请求示例**：

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**响应** (200)：

```json
{
  "code": 200,
  "message": "操作成功",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 7200,
    "tokenType": "Bearer"
  }
}
```

**错误响应**：

| 状态码 | 说明 |
|--------|------|
| 401 | 无效的刷新令牌 |
| 401 | Token 已过期，请重新登录 |

---

### 2.4 用户登出

```
POST /api/auth/logout
```

**认证**：无需认证（`@Public`）

**响应** (200)：

```json
{
  "code": 200,
  "message": "操作成功",
  "data": {
    "message": "登出成功"
  }
}
```

---

### 2.5 获取当前用户信息

```
GET /api/auth/user/info
```

**认证**：需要 JWT Token

**响应** (200)：

```json
{
  "code": 200,
  "message": "操作成功",
  "data": {
    "id": 1,
    "username": "admin",
    "name": "管理员",
    "phone": "13800138000",
    "email": "admin@example.com",
    "sex": "MALE",
    "avatar": "/uploads/avatar/xxx.jpg",
    "birthday": "1990-01-01T00:00:00.000Z",
    "city": "北京",
    "address": "朝阳区",
    "addressDetail": "xxx大厦",
    "status": 1,
    "roleType": "admin",
    "position": "技术总监",
    "joinedAt": "2024-01-01T00:00:00.000Z",
    "departmentId": 1,
    "departmentName": "技术部",
    "roles": [
      { "id": 1, "name": "管理员", "code": "admin" }
    ]
  }
}
```

**错误响应**：

| 状态码 | 说明 |
|--------|------|
| 401 | 认证失败 / Token无效 |
| 404 | 用户不存在 |

---

### 2.6 获取当前用户菜单

```
GET /api/auth/user/menu
```

**认证**：需要 JWT Token

**响应** (200)：返回扁平菜单列表（已过滤 `enable=true` 且 `show=true`）

```json
{
  "code": 200,
  "message": "操作成功",
  "data": [
    {
      "id": 1,
      "name": "系统管理",
      "path": "/system",
      "component": null,
      "redirect": null,
      "icon": "setting",
      "type": "menu",
      "keepAlive": null,
      "show": true,
      "enable": true,
      "order": 1,
      "pid": null,
      "code": "system"
    }
  ]
}
```

---

### 2.7 更新当前用户信息

```
PUT /api/auth/user/update
```

**认证**：需要 JWT Token

**请求体**（所有字段可选）：

| 字段 | 类型 | 说明 |
|------|------|------|
| `name` | string | 真实姓名 |
| `phone` | string | 手机号 |
| `email` | string | 邮箱 |
| `sex` | string | 性别：`MALE` / `FEMALE` / `OTHER` |
| `avatar` | string | 头像URL |
| `birthday` | string (ISO 8601) | 生日 |
| `city` | string | 城市 |
| `address` | string | 地址 |
| `addressDetail` | string | 详细地址 |
| `position` | string | 职位 |

**响应** (200)：

```json
{
  "code": 200,
  "message": "操作成功",
  "data": {
    "id": 1,
    "name": "新名字",
    "phone": "13800138000",
    "email": "new@example.com"
  }
}
```

**错误响应**：

| 状态码 | 说明 |
|--------|------|
| 404 | 用户不存在 |
| 409 | 邮箱已被注册 |
| 409 | 手机号已被注册 |

---

### 2.8 验证密码

```
POST /api/auth/user/checkPassword
```

**认证**：需要 JWT Token

**请求体**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `password` | string | 是 | 待验证的密码 |

**响应** (200)：

```json
{
  "code": 200,
  "message": "操作成功",
  "data": true
}
```

---

### 2.9 修改密码

```
POST /api/auth/user/updatePassword
```

**认证**：需要 JWT Token

**请求体**：

| 字段 | 类型 | 必填 | 说明 | 校验规则 |
|------|------|------|------|----------|
| `oldPassword` | string | 是 | 原密码 | - |
| `newPassword` | string | 是 | 新密码 | 最少6字符 |

**响应** (200)：

```json
{
  "code": 200,
  "message": "操作成功",
  "data": {
    "message": "密码修改成功"
  }
}
```

**错误响应**：

| 状态码 | 说明 |
|--------|------|
| 400 | 原密码错误 |
| 404 | 用户不存在 |

### 2.10 解除账号的登录失败锁定

运营在用户管理页点击「解锁登录」时调用。登录失败限流状态存放在 `LoginGuardService`
的内存里（`用户名:IP` 维度 + 独立于 IP 的用户名全局维度），锁定窗口到期前用户无法自助恢复，
这里提供立即放行入口。

**请求**：

```http
PUT /api/auth/unlock
Authorization: Bearer <token>
Content-Type: application/json

{
  "username": "zhangsan"
}
```

**权限**：`system:user:update`

**成功响应**：

```json
{
  "code": 200,
  "message": "操作成功",
  "data": {
    "username": "zhangsan",
    "cleared": 2
  }
}
```

`cleared` 是实际清掉的计数条目数（IP 维度 + 全局维度合计），为 `0` 表示该账号当前未被锁定。

**错误响应**：

| 状态码 | 说明 |
|--------|------|
| 400 | 用户名缺失或超长 |
| 403 | 无 `system:user:update` 权限 |

> 注意：限流计数保存在进程内存中，多实例部署时只会解锁当前实例的计数；重启进程同样会清空。

---

## 3. 用户管理

> 前缀：`/api/system/user`  
> 所有接口需要 JWT 认证 + 权限码

### 3.1 获取用户列表

```
GET /api/system/user/list
```

**权限**：`system:user:list`

**查询参数**（所有可选）：

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `page` | number | 1 | 页码 |
| `pageSize` | number | 10 | 每页数量 |
| `username` | string | - | 用户名（模糊搜索） |
| `name` | string | - | 真实姓名（模糊搜索） |
| `phone` | string | - | 手机号（模糊搜索） |
| `email` | string | - | 邮箱（模糊搜索） |
| `departmentId` | number | - | 部门ID |
| `status` | number | - | 状态 0-禁用 1-启用 |
| `roleType` | string | - | 角色类型 |
| `includeDeleted` | boolean | false | 是否包含已删除 |

**响应** (200)：

```json
{
  "code": 200,
  "message": "操作成功",
  "data": {
    "list": [
      {
        "id": 1,
        "username": "admin",
        "name": "管理员",
        "phone": "13800138000",
        "email": "admin@example.com",
        "sex": "MALE",
        "avatar": null,
        "birthday": null,
        "city": null,
        "address": null,
        "addressDetail": null,
        "status": 1,
        "roleType": "admin",
        "position": null,
        "joinedAt": null,
        "departmentId": 1,
        "departmentName": "技术部",
        "roles": [
          { "id": 1, "name": "管理员", "code": "admin" }
        ],
        "createdTime": "2026-01-01T00:00:00.000Z",
        "updatedTime": "2026-01-01T00:00:00.000Z"
      }
    ],
    "total": 100,
    "page": 1,
    "pageSize": 10
  }
}
```

---

### 3.2 创建用户

```
POST /api/system/user/create
```

**权限**：`system:user:create`

**请求体**：

| 字段 | 类型 | 必填 | 说明 | 校验规则 |
|------|------|------|------|----------|
| `username` | string | 是 | 用户名 | 3-50字符 |
| `password` | string | 是 | 密码 | 6-20字符 |
| `name` | string | 否 | 真实姓名 | - |
| `phone` | string | 否 | 手机号 | - |
| `email` | string | 否 | 邮箱 | 需合法邮箱格式 |
| `sex` | string | 否 | 性别 | `MALE`/`FEMALE`/`OTHER` |
| `avatar` | string | 否 | 头像URL | - |
| `birthday` | string (ISO 8601) | 否 | 生日 | - |
| `city` | string | 否 | 城市 | - |
| `address` | string | 否 | 地址 | - |
| `addressDetail` | string | 否 | 详细地址 | - |
| `departmentId` | number | 否 | 部门ID | - |
| `joinedAt` | string (ISO 8601) | 否 | 入职时间 | - |
| `position` | string | 否 | 职位 | - |
| `roleType` | string | 否 | 角色类型 | - |

**响应** (200)：

```json
{
  "code": 200,
  "message": "操作成功",
  "data": {
    "id": 10,
    "username": "newuser",
    "name": null,
    "phone": null,
    "email": null
  }
}
```

**错误响应**：

| 状态码 | 说明 |
|--------|------|
| 400 | 用户名、手机号或邮箱已存在 |

---

### 3.3 更新用户

```
PUT /api/system/user/update
```

**权限**：`system:user:update`

**请求体**：与创建用户相同字段（全部可选），额外必填：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | number | 是 | 用户ID |
| `status` | number | 否 | 用户状态 0-禁用 1-启用 |

**响应** (200)：

```json
{
  "code": 200,
  "message": "操作成功",
  "data": {
    "id": 1,
    "username": "admin",
    "name": "新名字",
    "phone": "13800138000",
    "email": "admin@example.com"
  }
}
```

---

### 3.4 删除用户（软删除）

```
PUT /api/system/user/delete/:id
```

**权限**：`system:user:id:delete`

**路径参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| `id` | number | 用户ID |

**响应** (200)：

```json
{
  "code": 200,
  "message": "操作成功",
  "data": { "id": 1 }
}
```

**错误响应**：

| 状态码 | 说明 |
|--------|------|
| 404 | 用户不存在 |

---

### 3.5 批量删除用户

```
PUT /api/system/user/batchDelete
```

**权限**：`system:user:delete`

**请求体**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `ids` | number[] | 是 | 用户ID数组 |

**请求示例**：

```json
{
  "ids": [1, 2, 3]
}
```

**响应** (200)：

```json
{
  "code": 200,
  "message": "操作成功",
  "data": { "ids": [1, 2, 3] }
}
```

---

### 3.6 启用/禁用用户

```
PUT /api/system/user/status/:id
```

**权限**：`system:user:update`

**路径参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| `id` | number | 用户ID |

**请求体**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `status` | number | 是 | 0-禁用 1-启用 |

**响应** (200)：

```json
{
  "code": 200,
  "message": "操作成功",
  "data": { "id": 1, "status": 1 }
}
```

---

### 3.7 分配用户角色

```
POST /api/system/user/:id/roles
```

**权限**：`system:user:assign-role`

**路径参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| `id` | number | 用户ID |

**请求体**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `roleIds` | number[] | 是 | 角色ID数组（会先清除旧角色再分配） |

**响应** (200)：

```json
{
  "code": 200,
  "message": "操作成功",
  "data": {
    "userId": 1,
    "roleIds": [1, 2]
  }
}
```

---

### 3.8 重置用户密码

```
POST /api/system/user/:id/reset-password
```

**权限**：`system:user:reset-password`

**路径参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| `id` | number | 用户ID |

**请求体**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `newPassword` | string | 是 | 新密码 |

**响应** (200)：

```json
{
  "code": 200,
  "message": "操作成功",
  "data": { "id": 1 }
}
```

---

## 4. 角色管理

> 前缀：`/api/system/role`  
> 所有接口需要 JWT 认证 + 权限码

### 4.1 获取角色列表

```
GET /api/system/role/list
```

**权限**：`system:role:list`

**查询参数**（所有可选）：

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `page` | number | 1 | 页码 |
| `pageSize` | number | 10 | 每页数量 |
| `code` | string | - | 角色编码（模糊搜索） |
| `name` | string | - | 角色名称（模糊搜索） |
| `includeDeleted` | boolean | false | 是否包含已删除 |

**响应** (200)：

```json
{
  "code": 200,
  "message": "操作成功",
  "data": {
    "list": [
      {
        "id": 1,
        "code": "admin",
        "name": "管理员",
        "description": "系统管理员",
        "menuCount": 20,
        "userCount": 5,
        "menus": [
          { "id": 1, "name": "用户管理", "code": "system:user:list" }
        ],
        "users": [
          { "id": 1, "username": "admin", "name": "管理员" }
        ],
        "createdTime": "2026-01-01T00:00:00.000Z",
        "updatedTime": "2026-01-01T00:00:00.000Z"
      }
    ],
    "total": 10,
    "page": 1,
    "pageSize": 10
  }
}
```

---

### 4.2 创建角色

```
POST /api/system/role/create
```

**权限**：`system:role:create`

**请求体**：

| 字段 | 类型 | 必填 | 说明 | 校验规则 |
|------|------|------|------|----------|
| `code` | string | 是 | 角色编码 | 2-50字符 |
| `name` | string | 是 | 角色名称 | 2-100字符 |
| `description` | string | 否 | 角色描述 | - |

**响应** (200)：

```json
{
  "code": 200,
  "message": "操作成功",
  "data": {
    "id": 10,
    "code": "editor",
    "name": "编辑者",
    "description": null
  }
}
```

**错误响应**：

| 状态码 | 说明 |
|--------|------|
| 400 | 角色编码或角色名称已存在 |

---

### 4.3 更新角色

```
PUT /api/system/role/update
```

**权限**：`system:role:update`

**请求体**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | number | 是 | 角色ID |
| `code` | string | 否 | 角色编码 |
| `name` | string | 否 | 角色名称 |
| `description` | string | 否 | 角色描述 |

**响应** (200)：

```json
{
  "code": 200,
  "message": "操作成功",
  "data": {
    "id": 1,
    "code": "admin",
    "name": "超级管理员",
    "description": "拥有全部权限"
  }
}
```

---

### 4.4 删除角色（软删除）

```
DELETE /api/system/role/delete/:id
```

**权限**：`system:role:delete`

**路径参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| `id` | number | 角色ID |

**响应** (200)：

```json
{
  "code": 200,
  "message": "操作成功",
  "data": { "id": 1 }
}
```

---

### 4.5 分配角色菜单权限

```
POST /api/system/role/update/menu
```

**权限**：`system:role:assign-menu`

**请求体**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `roleId` | number | 是 | 角色ID |
| `menuIds` | number[] | 是 | 菜单ID数组（会先清除旧权限再分配） |

**请求示例**：

```json
{
  "roleId": 1,
  "menuIds": [1, 2, 3, 10, 11]
}
```

**响应** (200)：

```json
{
  "code": 200,
  "message": "操作成功",
  "data": {
    "roleId": 1,
    "menuIds": [1, 2, 3, 10, 11]
  }
}
```

---

## 5. 菜单管理

> 前缀：`/api/system/menu`  
> 所有接口需要 JWT 认证 + 权限码（`onlineMenus` 除外）

### 5.1 获取菜单列表

```
GET /api/system/menu/list
```

**权限**：`system:menu:list`

**查询参数**（所有可选）：

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `page` | number | 1 | 页码 |
| `pageSize` | number | 10 | 每页数量 |
| `name` | string | - | 菜单名称（模糊搜索） |
| `code` | string | - | 菜单编码（模糊搜索） |
| `type` | string | - | 菜单类型 |
| `pid` | number | - | 父菜单ID |
| `show` | boolean | - | 是否显示 |
| `enable` | boolean | - | 是否启用 |

**响应** (200)：

```json
{
  "code": 200,
  "message": "操作成功",
  "data": {
    "list": [
      {
        "id": 1,
        "name": "系统管理",
        "code": "system",
        "type": "menu",
        "pid": null,
        "path": "/system",
        "redirect": null,
        "icon": "setting",
        "component": null,
        "layout": "default",
        "keepAlive": null,
        "method": null,
        "description": null,
        "show": true,
        "enable": true,
        "order": 1,
        "needLogin": true,
        "extraData": null,
        "createdTime": "2026-01-01T00:00:00.000Z",
        "updatedTime": null
      }
    ],
    "total": 50,
    "page": 1,
    "pageSize": 10
  }
}
```

---

### 5.2 获取在线菜单（公开）

```
GET /api/system/menu/onlineMenus
```

**认证**：无需认证（`@Public`）

**说明**：返回 `enable=true`、`show=true`、`needLogin=false` 的菜单

**响应** (200)：返回树形菜单结构

```json
{
  "code": 200,
  "message": "操作成功",
  "data": [
    {
      "id": 1,
      "name": "首页",
      "code": "home",
      "type": "menu",
      "pid": null,
      "path": "/",
      "redirect": null,
      "icon": "home",
      "component": "views/Home",
      "layout": "default",
      "keepAlive": null,
      "method": null,
      "description": null,
      "show": true,
      "enable": true,
      "order": 1,
      "needLogin": false,
      "extraData": null,
      "createdTime": "2026-01-01T00:00:00.000Z",
      "updatedTime": null,
      "children": []
    }
  ]
}
```

---

### 5.3 创建菜单

```
POST /api/system/menu/create
```

**权限**：`system:menu:create`

**请求体**：

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `name` | string | 是 | - | 菜单名称（1-50字符） |
| `code` | string | 是 | - | 菜单编码（1-100字符） |
| `type` | string | 是 | - | 菜单类型 |
| `pid` | number | 否 | - | 父菜单ID |
| `path` | string | 否 | - | 路由路径 |
| `redirect` | string | 否 | - | 重定向路径 |
| `icon` | string | 否 | - | 图标 |
| `component` | string | 否 | - | 组件路径 |
| `layout` | string | 否 | `default` | 布局类型 |
| `keepAlive` | boolean | 否 | `false` | 是否缓存页面 |
| `method` | string | 否 | - | HTTP方法 |
| `description` | string | 否 | - | 描述 |
| `show` | boolean | 否 | `true` | 是否显示 |
| `enable` | boolean | 否 | `true` | 是否启用 |
| `order` | number | 否 | `0` | 排序 |
| `needLogin` | boolean | 否 | `true` | 是否需要登录 |
| `extraData` | string | 否 | - | 额外数据 |

**响应** (200)：

```json
{
  "code": 200,
  "message": "操作成功",
  "data": {
    "id": 100,
    "name": "新菜单",
    "code": "system:new",
    "type": "menu",
    "pid": null,
    "path": "/new",
    "redirect": null,
    "icon": null,
    "component": "views/New",
    "layout": "default",
    "keepAlive": false,
    "method": null,
    "description": null,
    "show": true,
    "enable": true,
    "order": 0,
    "needLogin": true,
    "extraData": null,
    "createdTime": "2026-06-01T00:00:00.000Z",
    "updatedTime": null
  }
}
```

**错误响应**：

| 状态码 | 说明 |
|--------|------|
| 400 | 菜单编码已存在 |

---

### 5.4 更新菜单

```
PUT /api/system/menu/update
```

**权限**：`system:menu:update`

**请求体**：与创建菜单相同字段（全部可选），额外必填：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | number | 是 | 菜单ID |

---

### 5.5 删除菜单

```
DELETE /api/system/menu/delete/:id
```

**权限**：`system:menu:delete`

**路径参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| `id` | number | 菜单ID |

**说明**：如果该菜单存在子菜单，将拒绝删除。删除时会同步清除 `RoleMenu` 关联。

**错误响应**：

| 状态码 | 说明 |
|--------|------|
| 400 | 该菜单存在子菜单，无法删除 |
| 404 | 菜单不存在 |

---

### 5.6 批量删除菜单

```
DELETE /api/system/menu/batchDelete
```

**权限**：`system:menu:delete`

**请求体**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `ids` | number[] | 是 | 菜单ID数组 |

**说明**：如果任一菜单存在子菜单，整个批量操作将被拒绝。

---

## 6. 部门管理

> 前缀：`/api/system/department`  
> 所有接口需要 JWT 认证 + 权限码

### 6.1 获取部门列表

```
GET /api/system/department/list
```

**权限**：`system:department:list`

**查询参数**（所有可选）：

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `page` | number | 1 | 页码 |
| `pageSize` | number | 10 | 每页数量 |
| `name` | string | - | 部门名称（模糊搜索） |
| `code` | string | - | 部门编码（模糊搜索） |
| `status` | number | - | 状态 |
| `parentId` | number | - | 父部门ID |
| `includeDeleted` | boolean | false | 是否包含已删除 |

**响应** (200)：

```json
{
  "code": 200,
  "message": "操作成功",
  "data": {
    "list": [
      {
        "id": 1,
        "name": "技术部",
        "code": "tech",
        "description": "技术研发部门",
        "level": 1,
        "sortOrder": 1,
        "status": 1,
        "managerId": 1,
        "managerName": "管理员",
        "parentId": null,
        "parentName": null,
        "createdTime": "2026-01-01T00:00:00.000Z",
        "updatedTime": null
      }
    ],
    "total": 10,
    "page": 1,
    "pageSize": 10
  }
}
```

---

### 6.2 获取部门树

```
GET /api/system/department/tree
```

**权限**：`system:department:list`

**响应** (200)：返回树形结构

```json
{
  "code": 200,
  "message": "操作成功",
  "data": [
    {
      "id": 1,
      "name": "总公司",
      "code": "company",
      "description": null,
      "level": 1,
      "sortOrder": 1,
      "status": 1,
      "managerId": null,
      "managerName": null,
      "parentId": null,
      "children": [
        {
          "id": 2,
          "name": "技术部",
          "code": "tech",
          "description": null,
          "level": 2,
          "sortOrder": 1,
          "status": 1,
          "managerId": null,
          "managerName": null,
          "parentId": 1
        }
      ]
    }
  ]
}
```

---

### 6.3 搜索部门

```
GET /api/system/department/search?keyword=技术
```

**权限**：`system:department:list`

**查询参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `keyword` | string | 是 | 搜索关键词（匹配名称/编码/描述） |

**响应** (200)：返回部门列表

---

### 6.4 获取部门统计信息

```
GET /api/system/department/stats
```

**权限**：`system:department:list`

**响应** (200)：

```json
{
  "code": 200,
  "message": "操作成功",
  "data": {
    "totalDepartments": 10,
    "activeDepartments": 8,
    "totalUsers": 50
  }
}
```

---

### 6.5 获取指定部门统计信息

```
GET /api/system/department/stats/:id
```

**权限**：`system:department:list`

**响应** (200)：

```json
{
  "code": 200,
  "message": "操作成功",
  "data": {
    "departmentId": 1,
    "departmentName": "技术部",
    "userCount": 15,
    "childCount": 3
  }
}
```

---

### 6.6 获取部门详情

```
GET /api/system/department/detail/:id
```

**权限**：`system:department:list`

**响应** (200)：

```json
{
  "code": 200,
  "message": "操作成功",
  "data": {
    "id": 1,
    "name": "技术部",
    "code": "tech",
    "description": "技术研发部门",
    "level": 1,
    "sortOrder": 1,
    "status": 1,
    "managerId": 1,
    "managerName": "管理员",
    "parentId": null,
    "parentName": null,
    "children": [
      { "id": 2, "name": "前端组", "code": "frontend" }
    ],
    "roles": [
      { "id": 1, "name": "管理员", "code": "admin" }
    ],
    "createdTime": "2026-01-01T00:00:00.000Z",
    "updatedTime": null
  }
}
```

---

### 6.7 获取部门成员列表

```
GET /api/system/department/members/:id?page=1&pageSize=10
```

**权限**：`system:department:list`

**查询参数**：

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `page` | number | 1 | 页码 |
| `pageSize` | number | 10 | 每页数量 |

**响应** (200)：

```json
{
  "code": 200,
  "message": "操作成功",
  "data": {
    "list": [
      {
        "id": 1,
        "username": "admin",
        "name": "管理员",
        "phone": "13800138000",
        "email": "admin@example.com",
        "status": 1,
        "position": "技术总监",
        "roles": [
          { "id": 1, "name": "管理员", "code": "admin" }
        ]
      }
    ],
    "total": 15,
    "page": 1,
    "pageSize": 10
  }
}
```

---

### 6.8 创建部门

```
POST /api/system/department/create
```

**权限**：`system:department:create`

**请求体**：

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `name` | string | 是 | - | 部门名称（1-50字符） |
| `code` | string | 是 | - | 部门编码（1-50字符） |
| `description` | string | 否 | - | 部门描述 |
| `level` | number | 否 | 1 | 部门层级 |
| `sortOrder` | number | 否 | 0 | 排序 |
| `status` | number | 否 | 1 | 状态 0-禁用 1-启用 |
| `managerId` | number | 否 | - | 部门经理ID |
| `parentId` | number | 否 | - | 父部门ID |

**错误响应**：

| 状态码 | 说明 |
|--------|------|
| 400 | 部门编码已存在 |

---

### 6.9 更新部门

```
PUT /api/system/department/update
```

**权限**：`system:department:update`

**请求体**：与创建部门相同字段（全部可选），额外必填 `id`。

---

### 6.10 删除部门（软删除）

```
DELETE /api/system/department/delete/:id
```

**权限**：`system:department:delete`

**说明**：存在子部门或用户时拒绝删除。

**错误响应**：

| 状态码 | 说明 |
|--------|------|
| 400 | 该部门存在子部门，无法删除 |
| 400 | 该部门下存在用户，无法删除 |
| 404 | 部门不存在 |

---

### 6.11 分配用户到部门

```
POST /api/system/department/assign-user
```

**权限**：`system:department:assign-user`

**请求体**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `userId` | number | 是 | 用户ID |
| `departmentId` | number | 是 | 部门ID |

---

### 6.12 批量分配用户到部门

```
POST /api/system/department/batch-assign-users
```

**权限**：`system:department:assign-user`

**请求体**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `userIds` | number[] | 是 | 用户ID数组 |
| `departmentId` | number | 是 | 部门ID |

---

### 6.13 从部门移除用户

```
DELETE /api/system/department/remove-user
```

**权限**：`system:department:assign-user`

**请求体**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `userId` | number | 是 | 用户ID |
| `departmentId` | number | 是 | 部门ID |

**说明**：将用户的 `departmentId` 设为 `null`。

---

### 6.14 分配角色到部门

```
POST /api/system/department/assign-role
```

**权限**：`system:department:assign-role`

**请求体**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `roleId` | number | 是 | 角色ID |
| `departmentId` | number | 是 | 部门ID |

---

### 6.15 从部门移除角色

```
DELETE /api/system/department/remove-role
```

**权限**：`system:department:assign-role`

**请求体**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `roleId` | number | 是 | 角色ID |
| `departmentId` | number | 是 | 部门ID |

---

### 6.16 启用部门

```
PUT /api/system/department/enable/:id
```

**权限**：`system:department:update`

**响应** (200)：

```json
{
  "code": 200,
  "message": "操作成功",
  "data": { "id": 1, "status": 1 }
}
```

---

### 6.17 停用部门

```
PUT /api/system/department/disable/:id
```

**权限**：`system:department:update`

**响应** (200)：

```json
{
  "code": 200,
  "message": "操作成功",
  "data": { "id": 1, "status": 0 }
}
```

---

## 7. 系统设置

> 前缀：`/api/system/settings`
>
> 设置项的**默认值、类型、分组、可见性、消费方**统一声明在后端代码注册表
> （`src/modules/settings/registry`），数据库只存"被改过的值"（`setting_override`）。
> 因此没有"新增/删除设置"接口：**加一项设置 = 改注册表 + 发版**，
> 前端设置页按注册表元数据自动渲染，无需改动。

**权限**：`system:setting:list`（查看）、`system:setting:update`（修改/重置）、`system:setting:rollback`（回滚）

**来源与可见性**：

| 概念 | 取值 | 说明 |
|------|------|------|
| `source` | `default` / `db` / `env` | 注册表默认值 / 数据库覆盖值 / 环境变量 |
| `expose` | `public` / `admin` / `secret` | 匿名白名单 / 仅后台 / 永不回传（值只走环境变量） |
| `type` | `string` / `number` / `boolean` / `json` / `string[]` / `color` / `url` / `email` / `select` | 决定 DB 序列化方式与前端控件 |

### 7.1 获取公开设置（白名单）

```
GET /api/system/settings/public
```

**权限**：匿名可读（`@Public()`）

**说明**：只返回注册表里 `expose=public` 的项，登录页/布局品牌位使用；`secret` 项永不回传。

**响应** (200)：

```json
{
  "code": 200,
  "message": "操作成功",
  "data": {
    "site.name": "Jay Admin",
    "site.description": "基于 NestJS 与 Vue3 的现代化管理系统",
    "site.copyright": "© 2026 Jay Admin. All rights reserved.",
    "site.primaryColor": "#1890ff"
  }
}
```

### 7.2 获取设置注册表元数据

```
GET /api/system/settings/schema
```

**权限**：`system:setting:list`

**说明**：返回分组与每项的渲染元数据（控件类型、约束、默认值、是否只读），设置页据此自动渲染。

**响应** (200)：

```json
{
  "code": 200,
  "message": "操作成功",
  "data": {
    "groups": [
      {
        "group": "站点",
        "items": [
          {
            "key": "site.name",
            "label": "站点名称",
            "type": "string",
            "description": "登录页与侧边栏展示的系统名称",
            "expose": "public",
            "source": "db",
            "readonly": false,
            "default": "Jay Admin",
            "order": 1
          }
        ]
      }
    ],
    "revision": 3
  }
}
```

### 7.3 获取设置列表

```
GET /api/system/settings?group=站点
```

**权限**：`system:setting:list`

**查询参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `group` | string | 否 | 按分组过滤，如 `站点` / `安全` |

**响应** (200)：数组，每项为设置项的**生效值**（已按类型解析，不是字符串）

```json
{
  "code": 200,
  "message": "操作成功",
  "data": [
    {
      "key": "site.name",
      "label": "站点名称",
      "group": "站点",
      "type": "string",
      "expose": "public",
      "source": "db",
      "readonly": false,
      "overridden": true,
      "value": "Jay Admin",
      "configured": true,
      "defaultValue": "Jay Admin",
      "version": 2,
      "updatedBy": 1,
      "updatedName": "admin",
      "updatedTime": "2026-10-16T06:29:33.000Z",
      "invalid": false
    }
  ]
}
```

**字段说明**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `source` | string | `default`（用默认值）/ `db`（有覆盖值）/ `env`（环境变量提供） |
| `overridden` | boolean | 是否存在数据库覆盖值 |
| `readonly` | boolean | `source=env` 的项只读 |
| `configured` | boolean | `expose=secret` 时表示是否已配置（`value` 恒为 null） |
| `version` | number | 覆盖值版本号，用于乐观锁；无覆盖值为 `0` |
| `invalid` | boolean | 覆盖值解析/校验失败，已回退默认值（启动校验会告警） |

### 7.4 修改设置

```
PUT /api/system/settings/:key
```

**权限**：`system:setting:update`

**路径参数**：`key` 为注册表声明的键，如 `site.name`（未声明返回 404，`source=env` 的项返回 400）

**请求体**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `value` | any | 是 | 设置值，具体类型由注册表声明决定（字符串/数字/布尔/对象/数组） |
| `expectedVersion` | number | 否 | 期望版本号（乐观锁）；与当前版本不一致返回 `409` |
| `reason` | string | 否 | 变更原因，写入变更历史 |

**请求示例**：

```json
{
  "value": "Jay Admin 2",
  "expectedVersion": 2,
  "reason": "调整品牌名"
}
```

**响应** (200)：返回更新后的设置项（结构同 7.3）

**错误**：

| 状态码 | 说明 |
|--------|------|
| 400 | 值类型/范围校验失败（如颜色格式、数字超范围），或该项由环境变量管理 |
| 404 | 设置未在注册表中声明 |
| 409 | 该设置已被他人修改（版本冲突），需刷新后重试 |

**说明**：写入会在同一事务里追加一条 `setting_history` 并递增 `setting_revision`（多实例缓存失效用）。
操作日志只记录"谁在什么时候改了哪一项"，**不记录设置值**（值线索看变更历史；`secret` 项只落哈希）。

### 7.5 重置设置为默认值

```
POST /api/system/settings/:key/reset
```

**权限**：`system:setting:update`

**请求体**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `expectedVersion` | number | 否 | 期望版本号（乐观锁） |
| `reason` | string | 否 | 重置原因，默认"重置为默认值" |

**说明**：删除覆盖值，回落到注册表默认值；同时追加一条历史（`newValue` 为 `null`）。

**响应** (200)：返回重置后的设置项（`source=default`、`version=0`）

### 7.6 回滚某次修改

```
POST /api/system/settings/:key/rollback
```

**权限**：`system:setting:rollback`

**请求体**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `version` | number | 是 | 要回滚的版本号（取自变更历史） |
| `reason` | string | 否 | 回滚原因 |

**说明**：回滚该版本引入的变更，即**恢复到该版本变更前的值**（取该条历史的 `oldValue`；
`oldValue` 为 `null` 表示当时用的是注册表默认值，此时等价于重置）。
回滚本身会追加一条历史（`source=rollback`），不删除任何历史记录。

> 为什么不重放"变更后的值"：历史里最新一条的变更后值就是当前值，
> 重放它等于什么都没做 —— 第一次修改后点回滚会"回滚成刚改的值"。

**响应** (200)：返回回滚后的设置项（`source=default` 表示已回到默认值）

**错误**：`404` 该版本不存在；`400` 历史值按当前声明校验不通过（例如声明收紧了范围）

### 7.7 获取设置变更历史

```
GET /api/system/settings/:key/history?page=1&pageSize=10
```

**权限**：`system:setting:list`

**响应** (200)：

```json
{
  "code": 200,
  "message": "操作成功",
  "data": {
    "items": [
      {
        "id": 12,
        "key": "site.name",
        "oldValue": "Jay Admin",
        "newValue": "Jay Admin 2",
        "version": 2,
        "source": "api",
        "reason": "调整品牌名",
        "changedBy": 1,
        "changedName": "admin",
        "changedTime": "2026-10-16T06:29:33.000Z"
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 10
  }
}
```

**字段说明**：`source` 取值 `api`（在线修改）/ `rollback`（回滚）/ `migration`（迁移导入）/ `seed`；`newValue` 为 `null` 表示重置为默认值。

### 7.8 已退役的旧接口

原 `/api/system/config/*`（列表/详情/按 key/按分类/公开/创建/更新/删除/批量删除/启停/校验密码）
已随 `sys_config` 表一起下线，迁移见 `prisma/migrations/20261016130000_settings_refactor`。
其中 6 项因**没有任何消费方**而退役：`maintenance_mode`、`page_size`、`max_file_size`、
`default_language`，以及本就不属于设置的 `initialized`、`version`。

## 8. 操作日志

> 前缀：`/api/system/operation-log`  
> 所有接口需要 JWT 认证 + 权限码

### 8.1 获取操作日志列表

```
GET /api/system/operation-log/list
```

**权限**：`system:operation-log:list`

**查询参数**（所有可选）：

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `page` | number | 1 | 页码 |
| `pageSize` | number | 10 | 每页数量 |
| `userId` | number | - | 操作用户ID |
| `username` | string | - | 操作用户名（模糊搜索） |
| `operationType` | string | - | 操作类型：`CREATE`/`UPDATE`/`DELETE`/`VIEW`/`LOGIN`/`LOGOUT`/`EXPORT`/`IMPORT`/`OTHER` |
| `module` | string | - | 模块名称（模糊搜索） |
| `status` | string | - | 状态：`SUCCESS`/`FAILED`/`PENDING` |
| `ipAddress` | string | - | IP地址（模糊搜索） |
| `startTime` | string (ISO 8601) | - | 开始时间 |
| `endTime` | string (ISO 8601) | - | 结束时间 |

**响应** (200)：

```json
{
  "code": 200,
  "message": "操作成功",
  "data": {
    "list": [
      {
        "id": 1,
        "userId": 1,
        "username": "admin",
        "operationType": "CREATE",
        "module": "用户管理",
        "description": "新增用户管理",
        "method": "POST",
        "url": "/api/system/user/create",
        "status": "SUCCESS",
        "errorMessage": null,
        "ipAddress": "127.0.0.1",
        "duration": 120,
        "createdTime": "2026-06-01T08:00:00.000Z",
        "user": {
          "id": 1,
          "username": "admin",
          "name": "管理员"
        }
      }
    ],
    "total": 1000,
    "page": 1,
    "pageSize": 10
  }
}
```

---

### 8.2 获取操作日志详情

```
GET /api/system/operation-log/detail/:id
```

**权限**：`system:operation-log:list`

---

### 8.3 获取操作日志统计

```
GET /api/system/operation-log/stats
```

**权限**：`system:operation-log:list`

**响应** (200)：

```json
{
  "code": 200,
  "message": "操作成功",
  "data": {
    "totalCount": 10000,
    "todayCount": 150,
    "successCount": 9800,
    "failedCount": 200,
    "operationTypeStats": [
      { "operationType": "VIEW", "count": 5000 },
      { "operationType": "CREATE", "count": 2000 },
      { "operationType": "UPDATE", "count": 1500 },
      { "operationType": "DELETE", "count": 500 }
    ],
    "moduleStats": [
      { "module": "用户管理", "count": 3000 },
      { "module": "角色管理", "count": 1000 }
    ]
  }
}
```

---

### 8.4 删除操作日志

```
DELETE /api/system/operation-log/delete/:id
```

**权限**：`system:operation-log:delete`

---

### 8.5 批量删除操作日志

```
POST /api/system/operation-log/batch-delete
```

**权限**：`system:operation-log:delete`

**请求体**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `ids` | number[] | 是 | 日志ID数组 |

---

### 8.6 清理过期日志

```
POST /api/system/operation-log/clear-expired
```

**权限**：`system:operation-log:delete`

**请求体**：

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `days` | number | 否 | 90 | 保留天数，删除此天数之前的日志 |

**响应** (200)：

```json
{
  "code": 200,
  "message": "操作成功",
  "data": {
    "deletedCount": 5000,
    "days": 90
  }
}
```

---

## 9. 文件上传

> 前缀：`/api/upload`  
> 所有接口需要 JWT 认证  
> Content-Type: `multipart/form-data`

### 9.1 单文件上传

```
POST /api/upload
```

**请求参数**（FormData）：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `file` | File | 是 | 上传的文件 |
| `fileType` | string | 否 | 文件类型：`image`/`document`/`audio`/`video`/`archive`/`avatar`/`all` |
| `folder` | string | 否 | 存储子目录 |
| `maxSize` | number | 否 | 最大文件大小（字节） |

**文件类型限制**：

| 类型 | 最大大小 | 允许的扩展名 |
|------|----------|-------------|
| `avatar` | 5MB | `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp` |
| `image` | 10MB | `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.svg` |
| `document` | 50MB | `.pdf`, `.doc`, `.docx`, `.xls`, `.xlsx`, `.ppt`, `.pptx`, `.txt` |
| `video` | 500MB | `.mp4`, `.avi`, `.mov`, `.wmv`, `.flv` |
| `audio` | 100MB | `.mp3`, `.wav`, `.flac`, `.aac`, `.ogg` |
| `archive` | 100MB | `.zip`, `.rar`, `.7z`, `.tar`, `.gz` |
| `all` | 10MB | 不限制 |

**响应** (200)：

```json
{
  "code": 200,
  "message": "操作成功",
  "data": {
    "originalName": "photo.jpg",
    "fileName": "photo_1717228800000_a1b2c3.jpg",
    "path": "uploads/image/photo_1717228800000_a1b2c3.jpg",
    "url": "/uploads/image/photo_1717228800000_a1b2c3.jpg",
    "size": 1024000,
    "mimeType": "image/jpeg"
  }
}
```

**错误响应**：

| 状态码 | 说明 |
|--------|------|
| 400 | 请选择要上传的文件 |
| 400 | 文件大小超过限制 |
| 400 | 不支持的文件类型 |

---

### 9.2 批量文件上传

```
POST /api/upload/batch
```

**请求参数**（FormData）：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `files` | File[] | 是 | 上传的文件数组（最多10个） |
| `fileType` | string | 否 | 文件类型 |
| `folder` | string | 否 | 存储子目录 |
| `maxSize` | number | 否 | 最大文件大小（字节） |

**响应** (200)：返回文件信息数组，结构同单文件上传。

---

## 10. 公共接口

> 前缀：`/api/public`  
> 所有接口需要 JWT 认证

### 10.1 拖拽排序

```
POST /api/public/sort
```

**请求体**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `tableName` | string | 是 | 表名：`user`/`role`/`department`/`menu`/`navigation`/`navigationGroup`/`notice`/`todo`/`operationLog` |
| `id` | number | 是 | 记录ID |
| `targetId` | string | 否 | 目标记录ID（`before`/`after` 位置时必填） |
| `position` | string | 否 | 位置：`before`/`after`/`first`/`last`，默认 `after` |
| `parentIdField` | string | 否 | 父级字段名 |
| `parentId` | number | 否 | 父级ID |

**请求示例**：

```json
{
  "tableName": "menu",
  "id": 5,
  "targetId": "3",
  "position": "before",
  "parentIdField": "pid",
  "parentId": 1
}
```

**响应** (200)：

```json
{
  "code": 200,
  "message": "操作成功",
  "data": {
    "id": 5,
    "sortOrder": 15
  }
}
```

---

### 10.2 重置排序

```
POST /api/public/resetSort
```

**请求体**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `tableName` | string | 是 | 表名 |
| `parentIdField` | string | 否 | 父级字段名 |
| `parentId` | number | 否 | 父级ID |

**说明**：将指定范围内的记录按 10, 20, 30... 重新编号。

**响应** (200)：

```json
{
  "code": 200,
  "message": "操作成功",
  "data": {
    "resetCount": 20
  }
}
```

---

## 附录：枚举类型

### Sex（性别）

| 值 | 说明 |
|----|------|
| `MALE` | 男 |
| `FEMALE` | 女 |
| `OTHER` | 其他 |


### OperationType（操作类型）

| 值 | 说明 |
|----|------|
| `CREATE` | 新增 |
| `UPDATE` | 修改 |
| `DELETE` | 删除 |
| `VIEW` | 查看 |
| `LOGIN` | 登录 |
| `LOGOUT` | 登出 |
| `EXPORT` | 导出 |
| `IMPORT` | 导入 |
| `OTHER` | 其他 |

### OperationStatus（操作状态）

| 值 | 说明 |
|----|------|
| `SUCCESS` | 成功 |
| `FAILED` | 失败 |
| `PENDING` | 待处理 |

---

## 附录：错误码

### HTTP 状态码

| 状态码 | 说明 |
|--------|------|
| 200 | 成功 |
| 201 | 创建成功 |
| 400 | 请求参数错误 / 业务逻辑错误 |
| 401 | 未认证 / Token无效 |
| 403 | 无权限 |
| 404 | 资源不存在 |
| 409 | 数据冲突（唯一约束） |
| 500 | 服务器内部错误 |

### Prisma 错误码

| 错误码 | HTTP状态码 | 说明 |
|--------|-----------|------|
| `P2002` | 409 | 数据已存在，违反唯一约束 |
| `P2025` | 404 | 记录不存在 |
| `P2003` | 400 | 外键约束失败 |
| `P2016` | 400 | 查询解析错误 |
| `P2021` | 404 | 表不存在 |

### 统一响应格式

**成功响应**：

```json
{
  "code": 200,
  "message": "操作成功",
  "data": { ... }
}
```

**错误响应**：

```json
{
  "code": 400,
  "message": "错误描述",
  "errMsg": "详细错误信息",
  "data": null,
  "timestamp": "2026-06-01T08:00:00.000Z",
  "path": "/api/auth/login"
}
```

**参数验证失败**：

```json
{
  "code": 400,
  "message": "参数验证失败",
  "errMsg": null,
  "data": [
    "username must be longer than or equal to 4 characters",
    "password must be longer than or equal to 8 characters"
  ]
}
```
