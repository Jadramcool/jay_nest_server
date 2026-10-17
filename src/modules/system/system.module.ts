import { Module } from '@nestjs/common';
import { UserModule } from './user/user.module';
import { RoleModule } from './role/role.module';
import { MenuModule } from './menu/menu.module';
import { DepartmentModule } from './department/department.module';
import { SettingsModule } from '../settings/settings.module';
import { OperationLogModule } from './operation-log/operation-log.module';
import { DictModule } from './dict/dict.module';
import { PermissionModule } from './permission/permission.module';

@Module({
  imports: [
    UserModule,
    RoleModule,
    MenuModule,
    DepartmentModule,
    SettingsModule,
    OperationLogModule,
    DictModule,
    PermissionModule,
  ],
  exports: [
    UserModule,
    RoleModule,
    MenuModule,
    DepartmentModule,
    SettingsModule,
    OperationLogModule,
    DictModule,
    PermissionModule,
  ],
})
export class SystemModule {}
