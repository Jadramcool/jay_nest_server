import {
  BadRequestException,
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { Type } from '@nestjs/common';

/**
 * 查询参数装饰器 — 绕过全局 ValidationPipe 直接读取原始 query，
 * 允许 `field__operator` 形式的参数通过。
 *
 * @example
 *   @Get('list')
 *   async findAll(@QueryWithOps(QueryUserDto) query: QueryUserDto)
 *
 * DTO 中只需声明基础字段（如 username, status），
 * 前端可传 username__eq=admin、status__in=0,1 等后缀覆盖操作符。
 * buildQueryWhere 的 parseKey 会自动读取 __ 后缀。
 */
export const QueryWithOps: <T>(dtoType: Type<T>) => ParameterDecorator =
  createParamDecorator(
    async (dtoType: Type<unknown> | undefined, ctx: ExecutionContext) => {
      if (!dtoType) {
        throw new BadRequestException('QueryWithOps 需要传入 DTO 类型');
      }

      const request = ctx
        .switchToHttp()
        .getRequest<{ query: Record<string, unknown> }>();
      const raw = request.query ?? {};

      // 分离 __ 后缀参数和普通参数
      const ops: Record<string, unknown> = {};
      const clean: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(raw)) {
        if (key.includes('__')) {
          ops[key] = value;
        } else {
          clean[key] = value;
        }
      }

      // 只对普通参数做 DTO 验证
      const dto = plainToInstance(dtoType, clean, {
        enableImplicitConversion: true,
      }) as object;

      const errors = await validate(dto, {
        whitelist: true,
        forbidNonWhitelisted: true,
      });
      if (errors.length > 0) {
        const messages = errors.flatMap((e) =>
          Object.values(e.constraints ?? {}),
        );
        throw new BadRequestException(messages);
      }

      return { ...dto, ...ops };
    },
  ) as <T>(dtoType: Type<T>) => ParameterDecorator;
