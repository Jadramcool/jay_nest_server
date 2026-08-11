-- CreateTable
CREATE TABLE `client_event` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `type` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NULL,
    `message` VARCHAR(191) NULL,
    `stack` LONGTEXT NULL,
    `url` VARCHAR(191) NULL,
    `route` VARCHAR(191) NULL,
    `user_id` INTEGER NULL,
    `browser` VARCHAR(191) NULL,
    `extra` JSON NULL,
    `created_time` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `client_event_type_created_time_idx`(`type`, `created_time`),
    INDEX `client_event_category_created_time_idx`(`category`, `created_time`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
