import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { Prisma } from '@prisma/client';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.BAD_REQUEST;
    let message = '数据库操作失败';
    const errorCode = exception.code;

    switch (exception.code) {
      case 'P2002':
        status = HttpStatus.CONFLICT;
        message = '数据已存在，违反唯一约束';
        break;
      case 'P2025':
        status = HttpStatus.NOT_FOUND;
        message = '记录不存在';
        break;
      case 'P2003':
        status = HttpStatus.BAD_REQUEST;
        message = '外键约束失败';
        break;
      case 'P2016':
        status = HttpStatus.BAD_REQUEST;
        message = '查询解析错误';
        break;
      case 'P2021':
        status = HttpStatus.NOT_FOUND;
        message = '表不存在';
        break;
    }

    response.status(status).json({
      code: status,
      message,
      errMsg: errorCode,
      data: null,
      timestamp: new Date().toISOString(),
    });
  }
}
