import { Module } from '@nestjs/common';
import { SysConfigService } from './sys-config.service';
import { ConfigResolverService } from './config-resolver.service';
import { SysConfigController } from './sys-config.controller';

@Module({
  controllers: [SysConfigController],
  providers: [SysConfigService, ConfigResolverService],
  exports: [SysConfigService, ConfigResolverService],
})
export class SysConfigModule {}
