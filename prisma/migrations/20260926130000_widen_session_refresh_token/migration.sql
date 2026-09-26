-- refresh_token 存的是 JWT(约 200+ 字符)，VARCHAR(191) 会触发 Prisma P2000 LengthMismatch
-- 现象：任何一次登录/刷新都在写 user_session 时 500
ALTER TABLE `user_session` MODIFY `refresh_token` VARCHAR(500) NOT NULL;
