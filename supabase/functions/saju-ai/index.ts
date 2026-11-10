// Interpret code-calculated pillars and scores. Birth date/time never enter this function.
const headers = {
  "Access-Control-Allow-Origin": "https://jjimjiljung.yullul.com",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const model = "mistralai/mistral-large-4-1t-a52b";
const elements = ["목", "화", "토", "금", "수"];
const relations = ["same", "output", "wealth", "power", "support"];
const colors = ["초록", "다홍", "노랑", "하양", "남색"];
const respond = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });

function validate(input: Record<string, unknown>) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const pillar = (value: unknown) => typeof value === "string" && /^[갑을병정무기경신임계][자축인묘진사오미신유술해]$/.test(value);
  const score = (value: unknown) => typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5;
  const scores = input.scores as Record<string, unknown> | null;
  if (!pillar(input.mine) || !pillar(input.today) || !elements.includes(String(input.element)) ||
    !elements.includes(String(input.todayElement)) || !relations.includes(String(input.relation)) ||
    !colors.includes(String(input.color)) || typeof input.number !== "number" || !Number.isInteger(input.number) || input.number < 1 ||
    input.number > 9 || !scores || typeof scores !== "object" ||
    !["총운", "재물", "연애", "건강"].every(k => score(scores[k]))) return null;
  return {
    mine: input.mine, element: input.element, today: input.today,
    todayElement: input.todayElement, relation: input.relation,
    scores: { 총운: scores.총운, 재물: scores.재물, 연애: scores.연애, 건강: scores.건강 },
    color: input.color, number: input.number,
  };
}

function threeLines(content: unknown) {
  if (typeof content !== "string") return null;
  const raw = content.trim().slice(0, 900);
  let lines = raw.split(/\n+/).map(s => s.trim()).filter(Boolean);
  if (lines.length === 1) lines = raw.match(/[^.!?。]+[.!?。]?/g)?.map(s => s.trim()).filter(Boolean) || [];
  lines = lines.map(s => s.replace(/^(?:[-•*]|[1-3][.)])\s*/, "").trim());
  return lines.length === 3 && lines.every(s => s.length >= 5 && s.length <= 150) ? lines : null;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers });
  if (request.method !== "POST") return respond({ error: "Method not allowed" }, 405);
  const bearer = request.headers.get("authorization");
  if (!bearer?.startsWith("Bearer ")) return respond({ error: "Login required" }, 401);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publicKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !publicKey || !serviceKey) return respond({ error: "Service unavailable" }, 503);
  const verified = await fetch(supabaseUrl + "/auth/v1/user", {
    headers: { authorization: bearer, apikey: publicKey },
  }).catch(() => null);
  if (!verified?.ok) return respond({ error: "Login required" }, 401);
  const user = await verified.json().catch(() => null);
  if (!user?.id) return respond({ error: "Login required" }, 401);

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return respond({ error: "Invalid input" }, 400); }
  const url = supabaseUrl + "/rest/v1/daily_fortunes";
  const dbHeaders = { apikey: serviceKey, authorization: "Bearer " + serviceKey, "Content-Type": "application/json" };
  if (body?.action === "forget") {
    const deleted = await fetch(url + "?user_id=eq." + encodeURIComponent(user.id), { method: "DELETE", headers: dbHeaders }).catch(() => null);
    return deleted?.ok ? respond({ forgotten: true }) : respond({ error: "Delete failed" }, 503);
  }
  const calculated = validate(body);
  if (!calculated) return respond({ error: "Invalid calculated fortune" }, 400);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(calculated)));
  const signature = "v2:" + [...new Uint8Array(digest)].slice(0, 12).map(n => n.toString(16).padStart(2, "0")).join("");
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const query = "?user_id=eq." + encodeURIComponent(user.id) + "&fortune_date=eq." + day + "&select=title,fortune_text";
  const prior = await fetch(url + query, { headers: dbHeaders }).catch(() => null);
  if (!prior?.ok) return respond({ error: "Cache unavailable" }, 503);
  const rows = await prior.json().catch(() => []);
  if (rows[0]?.title === signature) {
    let cached: unknown;
    try { cached = JSON.parse(rows[0].fortune_text || "null"); } catch { cached = null; }
    if (Array.isArray(cached) && cached.length === 3 && cached.every((line: unknown) => typeof line === "string"))
      return respond({ lines: cached, cached: true });
  }

  const apiKey = Deno.env.get("NVIDIA_API_KEY");
  if (!apiKey) return respond({ error: "AI not configured" }, 503);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const completion = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST", signal: controller.signal,
      headers: { authorization: "Bearer " + apiKey, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "오락용 사주 해석가입니다. 아래 계산 결과만 근거로 오늘의 운세를 한국어 정확히 3줄로 쓰세요. 각 줄은 짧은 한 문장입니다. 첫 줄은 오늘의 흐름, 둘째 줄은 관계나 재물의 흐름, 셋째 줄은 오늘 해볼 작은 행동을 제안하세요. 점수와 오행을 바꾸거나 근거 없는 사실을 추가하지 마세요. 건강·재물에 대한 단정, 투자·의료 조언, 제목, 번호, 불릿, 마크다운은 쓰지 마세요. 줄바꿈으로 세 줄만 출력하세요." },
          { role: "user", content: JSON.stringify({ day, ...calculated }) },
        ], max_tokens: 300, temperature: 0.4, reasoning_effort: "none", stream: false,
      }),
    });
    if (!completion.ok) {
      console.error("Saju AI upstream status", completion.status);
      return respond({ error: "AI service unavailable", upstream_status: completion.status }, 502);
    }
    const result = await completion.json().catch(() => null);
    const lines = threeLines(result?.choices?.[0]?.message?.content);
    if (!lines) return respond({ error: "AI returned an invalid three-line analysis" }, 502);
    const stored = await fetch(url + "?on_conflict=user_id,fortune_date", {
      method: "POST", headers: { ...dbHeaders, Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ user_id: user.id, fortune_date: day, title: signature, fortune_text: JSON.stringify(lines) }),
    });
    if (!stored.ok) return respond({ error: "Cache unavailable" }, 503);
    return respond({ lines, cached: false });
  } catch {
    return respond({ error: "AI request timed out" }, 504);
  } finally { clearTimeout(timer); }
});
