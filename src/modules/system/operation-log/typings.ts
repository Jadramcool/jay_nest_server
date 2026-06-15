import { OperationStatus, OperationType } from '@prisma/client';

export interface ICreateOperationLog {
  userId?: number;
  username?: string;
  operationType: OperationType;
  module?: string;
  description?: string;
  method?: string;
  url?: string;
  params?: string;
  result?: string;
  status?: OperationStatus;
  errorMessage?: string;
  ipAddress?: string;
  userAgent?: string;
  duration?: number;
}
