-- AlterTable
ALTER TABLE `role` ADD COLUMN `is_system` BOOLEAN NOT NULL DEFAULT false;

-- Backfill: 系统内置管理员角色标记为系统角色
UPDATE `role` SET `is_system` = 1 WHERE `code` = 'ADMIN';
