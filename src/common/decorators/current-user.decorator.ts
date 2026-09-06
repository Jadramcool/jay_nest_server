import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export const CurrentUser = createParamDecorator(
  (data: string, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const user = request.user as
      | {
          userId: number;
          username: string;
          jti?: string;
          permissions?: string[];
        }
      | undefined;

    if (!user) {
      return null;
    }

    return data ? user[data as keyof typeof user] : user;
  },
);
