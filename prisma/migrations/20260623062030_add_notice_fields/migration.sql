-- AlterTable
ALTER TABLE `notice` ADD COLUMN `is_mandatory` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `is_pinned` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `published_at` DATETIME(3) NULL,
    ADD COLUMN `scope_type` VARCHAR(191) NOT NULL DEFAULT 'ALL';

-- CreateTable
CREATE TABLE `notice_target` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `notice_id` INTEGER NOT NULL,
    `target_type` VARCHAR(191) NOT NULL,
    `target_id` INTEGER NOT NULL,

    INDEX `notice_target_notice_id_fkey`(`notice_id`),
    UNIQUE INDEX `notice_target_notice_id_target_type_target_id_key`(`notice_id`, `target_type`, `target_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `notice_target` ADD CONSTRAINT `notice_target_notice_id_fkey` FOREIGN KEY (`notice_id`) REFERENCES `notice`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
