-- 删除「前端监控」模块遗留的库内对象。
--
-- 背景：前端监控（/monitor 页面 + metrics 接口 + client_event 表 + 采集器）整模块下线，
-- 代码侧已移除后端模块、页面、采集器与菜单种子；而 seed 是 createMany 增量写入，
-- 删种子不会清理库里已存在的行，因此需要本迁移显式清理，否则菜单仍会指向不存在的组件。
--
-- 清理对象：
--   1) menu       : code 为 Metrics（菜单）、system:metrics:list / system:monitor:view（按钮权限）
--   2) role_menu  : 上述菜单的角色授权（menu 侧虽有 ON DELETE CASCADE，这里显式先删避免依赖外键配置）
--   3) permission : 独立权限表中同名 code 及其角色授权
--   4) client_event 表本身
--
-- 全部语句都做存在性前置判断，可重复执行，也可安全用于尚未播种过该模块的库。

-- 1) 菜单与按钮权限行

SET @menu_ids := (SELECT GROUP_CONCAT(id)
  FROM menu
  WHERE code IN ('Metrics', 'system:metrics:list', 'system:monitor:view'));

SET @stmt := IF(@menu_ids IS NULL,
  'DO 0',
  CONCAT('DELETE FROM role_menu WHERE menu_id IN (', @menu_ids, ')'));
PREPARE stmt FROM @stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @stmt := IF(@menu_ids IS NULL,
  'DO 0',
  CONCAT('DELETE FROM menu WHERE id IN (', @menu_ids, ')'));
PREPARE stmt FROM @stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2) 独立权限表（若该表存在对应 code）

SET @has_permission_table := (SELECT COUNT(*)
  FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'permission');

SET @perm_ids := IF(@has_permission_table > 0,
  (SELECT GROUP_CONCAT(id)
   FROM permission
   WHERE code IN ('system:metrics:list', 'system:monitor:view')),
  NULL);

SET @stmt := IF(@perm_ids IS NULL,
  'DO 0',
  CONCAT('DELETE FROM role_permission WHERE permission_id IN (', @perm_ids, ')'));
PREPARE stmt FROM @stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @stmt := IF(@perm_ids IS NULL,
  'DO 0',
  CONCAT('DELETE FROM permission WHERE id IN (', @perm_ids, ')'));
PREPARE stmt FROM @stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3) 事件表

DROP TABLE IF EXISTS `client_event`;
