import { Module } from '@nestjs/common';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { SettingsValidatorService } from './settings-validator.service';

/**
 * 系统设置模块。
 *
 * 设置项的默认值/类型/分组/可见性声明在 ./registry,数据库只存覆盖值;
 * 消费方(如登录防护)直接注入 SettingsService 做类型化读取。
 */
@Module({
  controllers: [SettingsController],
  providers: [SettingsService, SettingsValidatorService],
  exports: [SettingsService],
})
export class SettingsModule {}
