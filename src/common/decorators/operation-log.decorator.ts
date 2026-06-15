import { SetMetadata } from '@nestjs/common';
import { OperationType } from '@prisma/client';

export const OPERATION_LOG_KEY = 'operation_log';

export interface OperationLogOptions {
  operationType?: OperationType;
  module?: string;
  description?: string;
  logParams?: boolean;
  logResult?: boolean;
}

export const OperationLog = (options: OperationLogOptions = {}) =>
  SetMetadata(OPERATION_LOG_KEY, options);
