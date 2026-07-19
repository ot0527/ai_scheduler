const BASE_CORS_HEADERS = {
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

/**
 * 許可オリジンを解決する。
 * ALLOWED_ORIGINS（カンマ区切り）未設定時は localhost のみ許可する。
 */
export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin");
  const allowed = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  let allowOrigin = "";

  if (origin && allowed.length > 0 && allowed.includes(origin)) {
    allowOrigin = origin;
  } else if (
    origin &&
    allowed.length === 0 &&
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
  ) {
    allowOrigin = origin;
  }

  // 許可されないオリジンにはヘッダーを付与しない（明示的に拒否）
  if (!allowOrigin) {
    return { ...BASE_CORS_HEADERS };
  }

  return {
    ...BASE_CORS_HEADERS,
    "Access-Control-Allow-Origin": allowOrigin,
    Vary: "Origin",
  };
}

export function jsonResponse(
  body: unknown,
  status = 200,
  req: Request,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
}

export function errorResponse(
  message: string,
  status = 400,
  req: Request,
): Response {
  return jsonResponse({ error: message }, status, req);
}

/**
 * 内部エラーをログに記録し、クライアントには汎用メッセージのみ返す。
 */
export function internalErrorResponse(
  context: string,
  error: unknown,
  req: Request,
  status = 500,
): Response {
  console.error(context, error);
  return errorResponse(
    "サーバーでエラーが発生しました。しばらくしてから再度お試しください。",
    status,
    req,
  );
}
