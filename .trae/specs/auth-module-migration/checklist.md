# Auth 模块迁移检查清单

## 开发检查

- [ ] Auth 模块目录结构创建正确
- [ ] DTO 文件创建完成，包含必要的验证装饰器
- [ ] JWT 策略实现正确，验证逻辑无误
- [ ] Auth Service 实现完整，密码加密和验证逻辑正确
- [ ] Auth Controller 实现完整，接口路径和 HTTP 方法正确
- [ ] Auth Module 正确整合所有组件（Controller、Service、Strategy）
- [ ] .env 文件包含所有必要的 JWT 配置

## 功能检查

- [ ] POST /auth/login 接口正常工作
- [ ] POST /auth/register 接口正常工作
- [ ] POST /auth/refresh 接口正常工作
- [ ] POST /auth/logout 接口正常工作
- [ ] JWT Guard 正确保护需要认证的接口
- [ ] @Public() 装饰器正确标记公开接口

## 代码质量检查

- [ ] TypeScript 编译无错误
- [ ] 所有 DTO 有适当的验证装饰器（@IsString, @IsNotEmpty 等）
- [ ] 密码使用 bcrypt 加密存储
- [ ] Token 不在响应中泄露敏感信息
- [ ] 错误处理适当，不暴露内部错误细节

## Swagger 文档检查

- [ ] 所有 Auth 接口在 Swagger 文档中可见
- [ ] 接口描述清晰
- [ ] 请求和响应示例完整
