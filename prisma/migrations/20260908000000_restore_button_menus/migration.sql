-- 将 permission 表数据回迁为 menu 表 BUTTON 行：管理权交还菜单管理界面
-- 1) 每个 permission 生成一个 BUTTON 菜单行，挂在原 menu_id 关联的菜单下
INSERT INTO `menu` (`code`, `name`, `permission`, `type`, `pid`, `layout`, `show`, `enable`, `order`, `need_login`, `created_time`)
SELECT
  p.`code`,
  p.`name`,
  p.`code`,
  'BUTTON',
  p.`menu_id`,
  'normal',
  1,
  p.`enable`,
  0,
  1,
  NOW()
FROM `permission` p
WHERE p.`menu_id` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `menu` m WHERE m.`code` = p.`code`);

-- 2) 角色已分配的功能权限迁移为 role_menu 关联（指向新 BUTTON 行），保证现有角色权限不丢（幂等）
INSERT INTO `role_menu` (`role_id`, `menu_id`, `assigned_at`)
SELECT DISTINCT rp.`role_id`, m.`id`, NOW()
FROM `role_permission` rp
JOIN `permission` p ON p.`id` = rp.`permission_id`
JOIN `menu` m ON m.`code` = p.`code` AND m.`type` = 'BUTTON'
WHERE NOT EXISTS (
  SELECT 1 FROM `role_menu` rm
  WHERE rm.`role_id` = rp.`role_id` AND rm.`menu_id` = m.`id`
);
