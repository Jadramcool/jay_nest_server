# 认证模块迁移 Spec

## Why

当前系统需要实现完整的用户认证功能，包括登录、注册、Token 刷新和登出，以支持后续的业务模块安全访问控制。

## What Changes

### 新增文件

| 文件路径                                                | 说明                   |
| --------------------------------------------------- | -------------------- |
| src/modules/auth/auth.module.ts                     | 认证模块定义，整合 JWT、策略和控制器 |
| src/modules/auth/auth.controller.ts                 | 认证接口控制器              |
| src/modules/auth/auth.service.ts                    | 认证业务逻辑               |
| src/modules/auth/strategies/jwt.strategy.ts         | JWT 本地登录验证策略         |
| src/modules/auth/strategies/jwt-refresh.strategy.ts | Refresh Token 策略     |
| src/modules/auth/dto/login.dto.ts                   | 登录请求参数               |
| src/modules/auth/dto/register.dto.ts                | 注册请求参数               |
| src/modules/auth/dto/refresh-token.dto.ts           | 刷新 Token 参数          |

### 新增配置

| 配置项                       | 说明                 |
| ------------------------- | ------------------ |
| JWT_SECRET               | JWT 签名密钥           |
| JWT_EXPIRES_IN          | Access Token 过期时间  |
| JWT_REFRESH_EXPIRES_IN | Refresh Token 过期时间 |

## Impact

### Affected Capabilities

- 用户身份验证（登录）
- 用户注册
- Token 自动刷新
- 用户登出

### Affected Code

- src/modules/auth/ (整个认证模块)
- src/main.ts (可能需要调整 Swagger 文档配置)
- .env (新增 JWT 配置)

## 接口设计

### 统一响应格式

```typescript
{
  code: number;     // 状态码：200成功、201创建、400参数错误、401未授权、403禁止、404不存在、409冲突、500服务器错误
  message: string; // 提示信息
  data: T | null;  // 数据体
}
```

### POST /auth/login

```json
// Request
{
  "username": "string",
  "password": "string",
  "captcha": "string?",
  "captchaId": "string?"
}

// Response 200
{
  "code": 200,
  "message": "登录成功",
  "data": {
    "accessToken": "string",
    "refreshToken": "string",
    "expiresIn": 7200,
    "tokenType": "Bearer"
  }
}
```

### POST /auth/register

```json
// Request
{
  "username": "string",
  "password": "string",
  "confirmPassword": "string",
  "phone": "string?",
  "email": "string?"
}

// Response 201
{
  "code": 201,
  "message": "注册成功",
  "data": {
    "userId": 1,
    "username": "string"
  }
}
```

### POST /auth/refresh

```json
// Request
{
  "refreshToken": "string"
}

// Response 200
{
  "code": 200,
  "message": "刷新成功",
  "data": {
    "accessToken": "string",
    "refreshToken": "string",
    "expiresIn": 7200,
    "tokenType": "Bearer"
  }
}
```

### POST /auth/logout

```json
// Response 200
{
  "code": 200,
  "message": "登出成功",
  "data": null
}
```

### 错误响应示例

```json
// 400 参数错误
{
  "code": 400,
  "message": "用户名或密码不能为空",
  "data": null
}

// 401 认证失败
{
  "code": 401,
  "message": "用户名或密码错误",
  "data": null
}

// 401 Token 过期
{
  "code": 401,
  "message": "Token 已过期，请重新登录",
  "data": null
}

// 409 用户名冲突
{
  "code": 409,
  "message": "用户名已存在",
  "data": null
}
```

## ADDED Requirements

### Requirement: 用户登录

系统 SHALL 提供用户登录功能，通过用户名 + 密码进行身份验证。

#### Scenario: 成功登录

- **WHEN** 用户提交正确的用户名和密码
- **THEN** 返回 JWT Access Token 和 Refresh Token

#### Scenario: 登录失败

- **WHEN** 用户提交错误的密码
- **THEN** 返回 401 错误，提示"用户名或密码错误"

### Requirement: 用户注册

系统 SHALL 提供用户注册功能，创建新用户账户。

#### Scenario: 成功注册

- **WHEN** 用户提交有效的注册信息（用户名、密码、确认密码）
- **THEN** 创建新用户并返回用户信息

#### Scenario: 用户名已存在

- **WHEN** 用户提交已存在的用户名
- **THEN** 返回 409 错误，提示"用户名已存在"

### Requirement: Token 刷新

系统 SHALL 提供 Access Token 刷新功能，使用 Refresh Token 获取新的 Access Token。

#### Scenario: 成功刷新

- **WHEN** 提交有效的 Refresh Token
- **THEN** 返回新的 Access Token 和新的 Refresh Token

#### Scenario: Refresh Token 无效或过期

- **WHEN** 提交无效或过期的 Refresh Token
- **THEN** 返回 401 错误，提示"Token 已过期"

### Requirement: 用户登出

系统 SHALL 提供用户登出功能。

#### Scenario: 登出成功

- **WHEN** 用户请求登出
- **THEN** 返回成功消息

## MODIFIED Requirements

### Requirement: JWT Guard

现有的 @Public() 装饰器和 JWT Guard 保持不变，继续支持接口级别的访问控制。
