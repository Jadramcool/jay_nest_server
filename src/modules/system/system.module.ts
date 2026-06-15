import { Module } from '@nestjs/common';
import { UserModule } from './user/user.module';
import { RoleModule } from './role/role.module';
import { MenuModule } from './menu/menu.module';
import { DepartmentModule } from './department/department.module';
import { SysConfigModule } from './sys-config/sys-config.module';
import { OperationLogModule } from './operation-log/operation-log.module';

@Module({
  imports: [
    UserModule,
    RoleModule,
    MenuModule,
    DepartmentModule,
    SysConfigModule,
    OperationLogModule,
  ],
  exports: [
    UserModule,
    RoleModule,
    MenuModule,
    DepartmentModule,
    SysConfigModule,
    OperationLogModule,
  ],
})
export class SystemModule {}
