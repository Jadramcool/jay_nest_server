/*
  Warnings:

  - You are about to alter the column `type` on the `menu` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Enum(EnumId(2))`.
  - You are about to alter the column `extra_data` on the `menu` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Json`.
  - Made the column `keep_alive` on table `menu` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE `menu` ADD COLUMN `affix` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `always_show` BOOLEAN NULL,
    ADD COLUMN `badge` VARCHAR(191) NULL,
    ADD COLUMN `badge_type` VARCHAR(191) NULL,
    ADD COLUMN `frame_src` VARCHAR(191) NULL,
    ADD COLUMN `is_frame` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `permission` VARCHAR(191) NULL,
    ADD COLUMN `target` VARCHAR(191) NOT NULL DEFAULT '_self',
    MODIFY `type` ENUM('DIRECTORY', 'MENU', 'BUTTON') NOT NULL,
    MODIFY `layout` VARCHAR(191) NOT NULL DEFAULT 'normal',
    MODIFY `keep_alive` BOOLEAN NOT NULL DEFAULT false,
    MODIFY `extra_data` JSON NULL;

-- CreateIndex
CREATE INDEX `menu_pid_fkey` ON `menu`(`pid`);

-- AddForeignKey
ALTER TABLE `menu` ADD CONSTRAINT `menu_pid_fkey` FOREIGN KEY (`pid`) REFERENCES `menu`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
