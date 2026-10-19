import { Module } from '@nestjs/common';
import { SettingsModule } from '@/modules/settings/settings.module';
import { SessionController } from './session.controller';
import { SessionService } from './session.service';

@Module({
  imports: [SettingsModule],
  controllers: [SessionController],
  providers: [SessionService],
  exports: [SessionService],
})
export class SessionModule {}
