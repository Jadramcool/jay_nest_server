-- AlterTable：新增端维度（默认 admin，历史数据自动回填）
ALTER TABLE `role` ADD COLUMN `platform` VARCHAR(16) NOT NULL DEFAULT 'admin';
ALTER TABLE `menu` ADD COLUMN `platform` VARCHAR(16) NOT NULL DEFAULT 'admin';
ALTER TABLE `user_session` ADD COLUMN `platform` VARCHAR(16) NOT NULL DEFAULT 'admin';

-- CreateIndex
CREATE INDEX `role_platform_idx` ON `role`(`platform`);
CREATE INDEX `menu_platform_idx` ON `menu`(`platform`);
