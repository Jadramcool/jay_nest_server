import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response, Request } from 'express';
import type { FieldError } from '../utils/validation-error.util';

interface ExceptionResponse {
  code?: number;
  message?: string | string[];
  errorCode?: string;
  details?: unknown;
  fieldErrors?: FieldError[];
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = '服务器内部错误';
    let errorCode = 'INTERNAL_SERVER_ERROR';
    let details: unknown = null;
    let fieldErrors: FieldError[] | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      code = status;
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object') {
        const responseObj = exceptionResponse as ExceptionResponse;
        if (typeof responseObj.code === 'number') {
          code = responseObj.code;
        }
        if (typeof responseObj.message === 'string') {
          message = responseObj.message;
        }
        errorCode = responseObj.errorCode || exception.constructor.name;
        details = responseObj.details || null;
        fieldErrors = Array.isArray(responseObj.fieldErrors)
          ? responseObj.fieldErrors
          : undefined;

        // 兜底:仍有个别路径直接抛字符串数组形式的校验错误
        if (Array.isArray(responseObj.message)) {
          message = '参数验证失败';
          details = responseObj.message;
        }
      } else {
        message = exceptionResponse;
      }
    } else if (exception instanceof Error) {
      console.error('未捕获的异常:', exception);
    }

    response.status(status).json({
      code,
      message,
      errMsg: errorCode,
      data: details,
      fieldErrors,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
