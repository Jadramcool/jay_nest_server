-- 系统设置破坏性重构:sys_config → setting_override / setting_history / setting_revision
--
-- 迁移前已导出受影响数据(见 scripts/settings-refactor-backup.ts):
--   storage/backup/settings-refactor-<时间戳>.json
--
-- 被退役的旧配置(不迁移,理由写在第 3 段):
--   initialized / version            —— 不是"设置"(安装标记、构建产物版本号)
--   maintenance_mode                 —— 无任何消费方
--   page_size / max_file_size        —— 无任何消费方
--   default_language                 —— 无任何消费方
-- 需要恢复时按备份文件用 --restore 还原数据,表结构走 migrate resolve --rolled-back 回退。

-- 1) 新表(与 prisma/schema.prisma 对齐,由 prisma migrate diff 生成)
CREATE TABLE `setting_override` (
    `key` VARCHAR(191) NOT NULL,
    `value` TEXT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `updated_by` INTEGER NULL,
    `updated_name` VARCHAR(64) NULL,
    `created_time` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_time` DATETIME(3) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `setting_history` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(191) NOT NULL,
    `old_value` TEXT NULL,
    `new_value` TEXT NULL,
    `version` INTEGER NOT NULL,
    `source` VARCHAR(16) NOT NULL,
    `reason` VARCHAR(255) NULL,
    `changed_by` INTEGER NULL,
    `changed_name` VARCHAR(64) NULL,
    `changed_time` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `setting_history_key_changed_time_idx`(`key`, `changed_time` DESC),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `setting_revision` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `revision` BIGINT NOT NULL DEFAULT 1,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `setting_revision` (`id`, `revision`) VALUES (1, 1);

-- 2) 数据搬运:旧 key → 新 key(注册表命名空间化)
--    只搬"与注册表默认值不同"的行,避免产生"值等于默认值"的假覆盖
INSERT INTO `setting_override`
    (`key`, `value`, `version`, `updated_by`, `updated_name`, `created_time`, `updated_time`)
SELECT m.new_key, s.value, 1, NULL, 'migration', NOW(3), NOW(3)
FROM `sys_config` s
JOIN (
    SELECT 'site_name' AS old_key, 'site.name' AS new_key, 'Jay Admin' AS default_value
    UNION ALL SELECT 'site_description', 'site.description', '基于 NestJS 与 Vue3 的现代化管理系统'
    UNION ALL SELECT 'copyright', 'site.copyright', '© 2026 Jay Admin. All rights reserved.'
    UNION ALL SELECT 'primary_color', 'site.primaryColor', '#1890ff'
    UNION ALL SELECT 'security.login.maxRetry', 'security.login.maxRetry', '5'
    UNION ALL SELECT 'security.login.lockMinutes', 'security.login.lockMinutes', '15'
) m ON m.old_key = s.key
WHERE s.value IS NOT NULL AND s.value <> m.default_value;

-- 迁移进来的覆盖值补一条历史(旧值未知,置 NULL)
INSERT INTO `setting_history`
    (`key`, `old_value`, `new_value`, `version`, `source`, `reason`, `changed_by`, `changed_name`, `changed_time`)
SELECT o.`key`, NULL, o.`value`, o.`version`, 'migration', '由 sys_config 迁移', NULL, 'migration', NOW(3)
FROM `setting_override` o;

-- 3) 菜单原地改写(保留 id → role_menu 关联不断)
UPDATE `menu`
SET `name` = '系统设置',
    `code` = 'SystemSetting',
    `path` = '/system/settings',
    `component` = '/src/views/system/settings/index.vue'
WHERE `code` = 'SystemConfig';

UPDATE `menu`
SET `name` = '查看设置', `code` = 'system:setting:list', `permission` = 'system:setting:list'
WHERE `code` = 'system:config:list';

UPDATE `menu`
SET `name` = '修改设置', `code` = 'system:setting:update', `permission` = 'system:setting:update'
WHERE `code` = 'system:config:update';

-- 「新增配置」按钮改造为「回滚设置」(沿用 id 106)
UPDATE `menu`
SET `name` = '回滚设置', `code` = 'system:setting:rollback', `permission` = 'system:setting:rollback'
WHERE `code` = 'system:config:create';

-- 「删除配置」按钮在新设计下不存在,连带 role_menu 关联一起清除
DELETE FROM `role_menu`
WHERE `menu_id` IN (SELECT `id` FROM (SELECT `id` FROM `menu` WHERE `code` = 'system:config:delete') AS t);

DELETE FROM `menu` WHERE `code` = 'system:config:delete';

-- 4) 旧表退场(如需留档,请在执行前自行备份)
DROP TABLE `sys_config`;
