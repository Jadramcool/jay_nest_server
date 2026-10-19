/**
 * 取客户端 IP 所需的最小字段集。
 *
 * 不直接用 express 的 Request：Nest 的 @Req() 参数常被声明成只含所需字段的结构化类型，
 * 用它构造的实参无法赋给完整 Request（缺上百个成员），而这里只需要 headers / ip / socket。
 */
export interface ClientIpSource {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  socket?: { remoteAddress?: string };
}

export function getClientIp(request: ClientIpSource): string {
  const forwarded = request.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  if (request.ip) {
    return request.ip;
  }
  return request.socket?.remoteAddress || 'unknown';
}
