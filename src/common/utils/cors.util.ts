/**
 * CORS 来源白名单(供 HTTP 与 WebSocket 共用)
 *
 * 通过环境变量 CORS_ORIGINS 配置,逗号分隔,如:
 *   CORS_ORIGINS=https://admin.example.com,https://admin-pre.example.com
 * 未配置时返回 true(保持放开,便于本地开发);生产环境应显式配置。
 */
export function getAllowedOrigins(): string[] | true {
  const raw = process.env.CORS_ORIGINS ?? '';
  const origins = raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return origins.length > 0 ? origins : true;
}
