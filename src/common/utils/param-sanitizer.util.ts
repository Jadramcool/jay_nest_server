const SENSITIVE_FIELDS = ['password', 'oldPassword', 'newPassword'];

export function sanitizeParams(
  body: Record<string, unknown> | undefined,
): string | undefined {
  if (!body || Object.keys(body).length === 0) {
    return undefined;
  }

  try {
    const cleaned = { ...body };
    for (const field of SENSITIVE_FIELDS) {
      if (field in cleaned) {
        (cleaned as Record<string, unknown>)[field] = '***';
      }
    }

    let result = JSON.stringify(cleaned);
    if (result.length > 2000) {
      result = result.substring(0, 2000) + '...';
    }
    return result;
  } catch {
    return undefined;
  }
}
