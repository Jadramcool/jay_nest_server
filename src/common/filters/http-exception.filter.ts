import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response, Request } from 'express';

interface ExceptionResponse {
  message?: string | string[];
  errorCode?: string;
  details?: unknown;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = '服务器内部错误';
    let errorCode = 'INTERNAL_SERVER_ERROR';
    let details: unknown = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object') {
        const responseObj = exceptionResponse as ExceptionResponse;
        if (typeof responseObj.message === 'string') {
          message = responseObj.message;
        }
        errorCode = responseObj.errorCode || exception.constructor.name;
        details = responseObj.details || null;

        // 处理验证错误
        if (Array.isArray(responseObj.message)) {
          message = '参数验证失败';
          details = responseObj.message;
        }
      } else {
        message = exceptionResponse;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      console.error('未捕获的异常:', exception);
    }

    response.status(status).json({
      code: status,
      message,
      errMsg: errorCode,
      data: details,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
