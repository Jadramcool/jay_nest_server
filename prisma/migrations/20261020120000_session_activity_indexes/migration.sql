-- user_session 活跃度查询所需索引。
--
-- 背景：「在线」语义从「refresh token 未过期」（最长 7 天）改为「活跃在线」
-- （expires_at > now 且 last_active_at > now - N 分钟）后，引入两处新查询模式：
--
--   1) access_jti 回写活跃时间：JwtStrategy 在每个受保护请求上按 jti 更新
--      last_active_at（60s 节流），而 access_jti 原本没有索引 → 每次回写全表扫；
--   2) last_active_at 同时用于在线统计的 WHERE 与在线列表的 ORDER BY。
--
-- 两个都是**非唯一**索引：access_jti 可空（老会话/异常路径可能没有 jti），
-- 且刷新令牌轮换时会被改写，加唯一约束会直接写失败。
--
-- 语句做存在性前置判断，可重复执行。

SET @stmt := IF(
  (SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_session'
     AND INDEX_NAME = 'user_session_access_jti_idx') > 0,
  'DO 0',
  'ALTER TABLE `user_session` ADD INDEX `user_session_access_jti_idx`(`access_jti`)');
PREPARE stmt FROM @stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @stmt := IF(
  (SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_session'
     AND INDEX_NAME = 'user_session_last_active_at_idx') > 0,
  'DO 0',
  'ALTER TABLE `user_session` ADD INDEX `user_session_last_active_at_idx`(`last_active_at`)');
PREPARE stmt FROM @stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
