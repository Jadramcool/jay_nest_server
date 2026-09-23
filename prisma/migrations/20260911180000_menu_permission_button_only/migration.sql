-- 方案 B：权限码只允许声明在 menu 表的 BUTTON 行
--
-- 背景：早期版本把权限码同时写在 MENU 行（页面节点）和 BUTTON 行（权限点）上，
-- 但运行时鉴权（JwtStrategy / PermissionsGuard）只采集 BUTTON 行的 permission，
-- MENU 行的 permission 是"幽灵字段"：只被授权界面展示，不参与任何鉴权判断，
-- 却让管理员误以为"勾了页面就等于拿到了列表接口权限"。
--
-- 本迁移清空目录/菜单行上冗余的 permission。清空是安全的：
--   * 前端 v-auth / hasPermission 使用的 27 个权限码全部由 BUTTON 行承载
--   * 后端 @RequirePermissions 声明的 40 个权限码全部由 BUTTON 行承载
--   * 下列 EXISTS 条件进一步保证：只有当同名权限码确实存在 BUTTON 行时才清空，
--     若某个码只存在于 MENU 行（异常数据），则保留原值等待人工处理，避免误删唯一来源
--
-- MySQL 不允许在 UPDATE 的子查询中直接引用被更新的表，这里用派生表包一层绕过。
UPDATE `menu`
SET `permission` = NULL
WHERE `type` IN ('DIRECTORY', 'MENU')
  AND `permission` IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM (
      SELECT DISTINCT `permission` AS `code`
      FROM `menu`
      WHERE `type` = 'BUTTON' AND `permission` IS NOT NULL
    ) AS `button_permission`
    WHERE `button_permission`.`code` = `menu`.`permission`
  );

-- 人工核查用（默认不执行）：仍留在目录/菜单行、且没有任何按钮行承载的权限码
-- 正常库应返回 0 行；若有输出，说明该权限码目前不会被任何角色授予，需要补建按钮行
--
-- SELECT m.`id`, m.`name`, m.`type`, m.`permission`
-- FROM `menu` m
-- WHERE m.`type` IN ('DIRECTORY', 'MENU')
--   AND m.`permission` IS NOT NULL
--   AND NOT EXISTS (
--     SELECT 1 FROM `menu` b
--     WHERE b.`type` = 'BUTTON' AND b.`permission` = m.`permission`
--   );
