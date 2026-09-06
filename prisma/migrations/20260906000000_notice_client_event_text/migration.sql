-- 富文本/上报字段容量修正：VARCHAR(191) 无法容纳实际内容
-- notice.content 为富文本 HTML；client_event.message/url 代码层截断至 500 字符
-- AlterTable
ALTER TABLE `notice` MODIFY `content` TEXT NULL;

-- AlterTable
ALTER TABLE `client_event` MODIFY `message` TEXT NULL,
    MODIFY `url` TEXT NULL;
