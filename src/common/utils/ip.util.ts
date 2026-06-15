import { Request } from 'express';

export function getClientIp(request: Request): string {
  const forwarded = request.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  if (request.ip) {
    return request.ip;
  }
  return request.socket?.remoteAddress || 'unknown';
}
