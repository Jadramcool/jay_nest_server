import 'reflect-metadata';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { RoleController } from './role/role.controller';
import { UserController } from './user/user.controller';
import { SysConfigController } from './sys-config/sys-config.controller';
import { UpdateRoleWithIdDto } from './role/dto';
import { UpdateUserWithIdDto } from './user/dto';
import { UpdateSysConfigWithIdDto } from './sys-config/dto';

// 与 main.ts 全局管道配置保持一致。注意 ValidationPipe.transform 是异步的，
// 断言必须 await（否则 rejection 会变成 unhandled rejection 直接杀掉 worker）。
const pipe = new ValidationPipe({
  whitelist: true,
  transform: true,
  forbidNonWhitelisted: true,
  transformOptions: {
    enableImplicitConversion: true,
  },
});

/** 读取控制器 update 方法的参数类型元数据 */
function getUpdateParamTypes(controller: ClassRef) {
  const target: object = controller.prototype;
  return Reflect.getMetadata(
    'design:paramtypes',
    target,
    'update',
  ) as unknown[];
}

/** 构造函数类型（控制器/DTO 类） */
type ClassRef = abstract new (...args: any[]) => unknown;

describe('system update 接口 DTO 元数据（防 ValidationPipe 绕过回归）', () => {
  // 回归背景：`UpdateXxxDto & { id: number }` 交集类型会让 TS 发射
  // design:paramtypes = Object，全局 ValidationPipe 对 Object 直接跳过，
  // 导致整个接口无校验、无 whitelist 剥离（mass assignment 漏洞）。
  it.each<[string, ClassRef, ClassRef]>([
    ['RoleController', RoleController, UpdateRoleWithIdDto],
    ['UserController', UserController, UpdateUserWithIdDto],
    ['SysConfigController', SysConfigController, UpdateSysConfigWithIdDto],
  ])(
    '%s 的 update 参数元数据必须是真实 DTO 类而不是 Object',
    (_name, controller, dto) => {
      const types = getUpdateParamTypes(controller);
      expect(types).toHaveLength(1);
      expect(types[0]).toBe(dto);
      expect(types[0]).not.toBe(Object);
    },
  );

  it('id 支持隐式类型转换并通过校验', async () => {
    const result = (await pipe.transform(
      { id: '5', name: '运营角色' },
      { type: 'body', metatype: UpdateRoleWithIdDto },
    )) as UpdateRoleWithIdDto;
    expect(result.id).toBe(5);
    expect(result.name).toBe('运营角色');
  });

  it('未在 DTO 声明的危险字段被 forbidNonWhitelisted 拒绝', async () => {
    // 角色更新：isSystem 提权
    await expect(
      pipe.transform(
        { id: 5, name: 'x', isSystem: true },
        { type: 'body', metatype: UpdateRoleWithIdDto },
      ),
    ).rejects.toThrow(BadRequestException);
    // 用户更新：软删字段注入
    await expect(
      pipe.transform(
        { id: 1, isDeleted: true },
        { type: 'body', metatype: UpdateUserWithIdDto },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('isSystem 已从系统配置更新白名单中移除', async () => {
    await expect(
      pipe.transform(
        { id: 1, isSystem: false },
        { type: 'body', metatype: UpdateSysConfigWithIdDto },
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
