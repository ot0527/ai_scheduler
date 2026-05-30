import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { parseDateKey, toDateKey } from "../../../packages/core/dist/scheduling/week-utils.js";
import { createUserClient, requireAuth } from "../_shared/auth.ts";
import { runMinorReschedule } from "../_shared/schedule-utils.ts";
import { errorResponse, getCorsHeaders, jsonResponse } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
  }

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405, req);
  }

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  const body = await req.json().catch(() => ({}));
  const sourceDateKey = (body?.sourceDate as string | undefined) ?? toDateKey(new Date());
  const sourceDate = parseDateKey(sourceDateKey);

  const userClient = createUserClient(auth.authHeader);

  try {
    const result = await runMinorReschedule(userClient, auth.userId, sourceDate);
    return jsonResponse(result, 200, req);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "小規模リスケに失敗しました";
    return errorResponse(message, 500, req);
  }
});
