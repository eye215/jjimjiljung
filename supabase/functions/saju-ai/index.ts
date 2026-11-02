// Supabase Edge Function: saju-ai. Deploy with JWT verification enabled.
// NVIDIA_API_KEY must be set as a Supabase secret, never in the client.
const headers = {
  "Access-Control-Allow-Origin": "https://jjimjiljung.yullul.com",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
function respond(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers });
}
Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers });
  if (request.method !== "POST") return respond({ error: "Method not allowed" }, 405);
  const bearer = request.headers.get("authorization");
  if (!bearer?.startsWith("Bearer ")) return respond({ error: "Login required" }, 401);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publicKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !publicKey) return respond({ error: "Auth unavailable" }, 503);
  const verified = await fetch(supabaseUrl + "/auth/v1/user", {
    headers: { authorization: bearer, apikey: publicKey },
  }).catch(() => null);
  if (!verified?.ok) return respond({ error: "Login required" }, 401);
  const apiKey = Deno.env.get("NVIDIA_API_KEY");
  if (!apiKey) return respond({ error: "AI not configured" }, 503);
  let input: Record<string, unknown>;
  try { input = await request.json(); } catch { return respond({ error: "Invalid input" }, 400); }
  const birth = String(input.birth || "");
  const today = String(input.today || "");
  const pillar = String(input.pillar || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birth) || !/^\d{4}-\d{2}-\d{2}$/.test(today) || pillar.length > 80)
    return respond({ error: "Invalid fortune data" }, 400);
  const prompt = "가상의 찜질방 사주 선생님입니다. 오락용 운세를 한국어로 120~180자 작성하세요. 사주 데이터가 부족하면 확정적으로 해석하지 마세요. 건강과 재물에 대한 단정적인 조언을 피하세요. 운세 본문만 답하세요.";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: { authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "meta/llama-3.3-70b-instruct",
        messages: [{ role: "system", content: prompt }, { role: "user", content: JSON.stringify({ birth, today, pillar }) }],
        max_tokens: 300,
        temperature: 0.7,
      }),
    });
    if (!response.ok) return respond({ error: "AI unavailable" }, 502);
    const result = await response.json();
    const text = String(result?.choices?.[0]?.message?.content || "").trim().slice(0, 600);
    if (!text) return respond({ error: "Empty AI response" }, 502);
    return respond({ text });
  } catch { return respond({ error: "AI request timed out" }, 504); }
  finally { clearTimeout(timer); }
});
