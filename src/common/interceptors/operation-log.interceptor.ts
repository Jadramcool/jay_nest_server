import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import type { Request } from 'express';
import { OperationStatus } from '@prisma/client';
import { OperationLogService } from '@/modules/system/operation-log/operation-log.service';
import {
  OPERATION_LOG_KEY,
  OperationLogOptions,
} from '../decorators/operation-log.decorator';
import { getClientIp } from '../utils/ip.util';
import {
  EXCLUDE_PATHS,
  resolveModuleName,
  getDefaultDescription,
  resolveOperationType,
} from '../utils/module-resolver.util';
import { sanitizeParams } from '../utils/param-sanitizer.util';

interface AuthenticatedUser {
  userId?: number;
  username?: string;
}

interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

@Injectable()
export class OperationLogInterceptor implements NestInterceptor {
  constructor(
    private reflector: Reflector,
    private operationLogService: OperationLogService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request: AuthenticatedRequest = context.switchToHttp().getRequest();
    const method = request.method.toUpperCase();
    const logOptions = this.reflector.get<OperationLogOptions | undefined>(
      OPERATION_LOG_KEY,
      context.getHandler(),
    );

    // OPTIONS 与 GET 默认跳过;但显式 @OperationLog 标注的 GET(如导出)需要记录
    if (method === 'OPTIONS' || (method === 'GET' && !logOptions)) {
      return next.handle();
    }

    const route = request.route as { path: string } | undefined;
    const path = route?.path ?? request.url;
    if (EXCLUDE_PATHS.some((p) => path.startsWith(p))) {
      return next.handle();
    }

    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          this.writeLog(request, startTime, null, logOptions);
        },
        error: (error: unknown) => {
          this.writeLog(request, startTime, error, logOptions);
        },
      }),
    );
  }

  private writeLog(
    request: AuthenticatedRequest,
    startTime: number,
    error: unknown,
    logOptions: OperationLogOptions | undefined,
  ) {
    const method = request.method.toUpperCase();
    const route = request.route as { path: string } | undefined;
    const path = route?.path ?? request.url;
    const duration = Date.now() - startTime;

    const operationType =
      logOptions?.operationType || resolveOperationType(method);

    const module = logOptions?.module || resolveModuleName(path);

    const description =
      logOptions?.description || getDefaultDescription(operationType, path);

    const logParams = logOptions?.logParams !== false;

    const status = error ? OperationStatus.FAILED : OperationStatus.SUCCESS;
    const errorMessage = error instanceof Error ? error.message : undefined;

    void this.operationLogService.createLogAsync({
      userId: request.user?.userId,
      username: request.user?.username,
      operationType,
      module,
      description,
      method,
      url: path,
      params: logParams
        ? sanitizeParams(request.body as Record<string, unknown>)
        : undefined,
      status,
      errorMessage,
      ipAddress: getClientIp(request),
      userAgent: request.headers['user-agent']?.substring(0, 500),
      duration,
    });
  }
}
