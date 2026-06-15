# Auth 模块迁移任务列表

## 任务列表

- [ ] Task 1: 创建 Auth 模块目录结构和基础文件
  - [ ] SubTask 1.1: 创建 src/modules/auth/ 目录结构
  - [ ] SubTask 1.2: 安装必要依赖 (passport, passport-jwt, passport-local, @nestjs/jwt)

- [ ] Task 2: 创建 DTO 定义
  - [ ] SubTask 2.1: 创建 login.dto.ts
  - [ ] SubTask 2.2: 创建 register.dto.ts
  - [ ] SubTask 2.3: 创建 refresh-token.dto.ts

- [ ] Task 3: 实现 JWT 策略
  - [ ] SubTask 3.1: 创建 jwt.strategy.ts (Access Token 验证)
  - [ ] SubTask 3.2: 创建 jwt-refresh.strategy.ts (Refresh Token 验证)

- [ ] Task 4: 实现 Auth Service
  - [ ] SubTask 4.1: 创建 auth.service.ts
  - [ ] SubTask 4.2: 实现 login 方法 (用户验证 + 生成 Token)
  - [ ] SubTask 4.3: 实现 register 方法 (用户创建)
  - [ ] SubTask 4.4: 实现 refresh 方法 (刷新 Token)
  - [ ] SubTask 4.5: 实现 logout 方法

- [ ] Task 5: 实现 Auth Controller
  - [ ] SubTask 5.1: 创建 auth.controller.ts
  - [ ] SubTask 5.2: 实现 POST /auth/login 接口
  - [ ] SubTask 5.3: 实现 POST /auth/register 接口
  - [ ] SubTask 5.4: 实现 POST /auth/refresh 接口
  - [ ] SubTask 5.5: 实现 POST /auth/logout 接口

- [ ] Task 6: 创建 Auth Module
  - [ ] SubTask 6.1: 创建 auth.module.ts，整合所有组件

- [ ] Task 7: 更新 .env 配置
  - [ ] SubTask 7.1: 添加 JWT_SECRET、JWT_EXPIRES_IN、JWT_REFRESH_EXPIRES_IN

- [ ] Task 8: 验证功能
  - [ ] SubTask 8.1: 运行编译检查 TypeScript 错误
  - [ ] SubTask 8.2: 启动服务验证 Swagger 文档

## 任务依赖关系

- Task 2 (DTO) 可以在 Task 1 完成后并行进行
- Task 3 (JWT 策略) 依赖 Task 1
- Task 4 (Auth Service) 依赖 Task 2 和 Task 3
- Task 5 (Auth Controller) 依赖 Task 4
- Task 6 (Auth Module) 依赖 Task 4 和 Task 5
- Task 7 (配置) 可以与 Task 1 并行
- Task 8 (验证) 依赖所有其他任务完成后进行
