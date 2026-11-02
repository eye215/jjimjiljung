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
  const user = await verified.json();
  const uid = user.id;
  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!uid || !secret) return respond({error:"Database unavailable"},503);
  const day = new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const url = supabaseUrl + "/rest/v1/daily_fortunes";
  const headersDb = {apikey:secret,authorization:"Bearer "+secret,"Content-Type":"application/json"};
  const query = "?user_id=eq."+encodeURIComponent(uid)+"&fortune_date=eq."+day+"&select=title,fortune_text";
  const prior = await fetch(url+query,{headers:headersDb});
  if (!prior.ok) return respond({error:"Database unavailable"},503);
  const found = await prior.json();
  if (found.length) return respond({title:found[0].title,text:found[0].fortune_text,cached:true});
  const apiKey = Deno.env.get("NVIDIA_API_KEY");
  if (!apiKey) return respond({ error: "AI not configured" }, 503);
  let input: Record<string, unknown>;
  try { input = await request.json(); } catch { return respond({ error: "Invalid input" }, 400); }
  const pillar = String(input.pillar || "");
  if (!pillar || pillar.length > 80)
    return respond({ error: "Invalid fortune data" }, 400);
  const prompt = "오락용 오늘의 운세를 한국어 한두 문장, 60자 이내로 작성하세요. 따뜻하고 구체적으로, 건강·재물에 대한 단정은 피하고 운세 본문만 출력하세요.";
  const started = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: { authorization: "Bearer " + apiKey, "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({
        model: "mistralai/mistral-large-4-1t-a52b",
        messages: [{ role: "system", content: prompt }, { role: "user", content: JSON.stringify({ pillar, day }) }],
        max_tokens: 256,
        temperature: 0.2,
        top_p: 1,
        reasoning_effort: "none",
        stream: false,
      }),
    });
    if (!response.ok) {
      const status = response.status;
      console.error("NVIDIA completion failed", { upstream_status: status, model: "mistralai/mistral-large-4-1t-a52b" });
      const guidance = status === 401 || status === 403 ? "NVIDIA API key or access denied"
        : status === 402 ? "NVIDIA credits unavailable"
        : status === 404 ? "NVIDIA model unavailable"
        : status === 429 ? "NVIDIA request limit reached"
        : status >= 500 ? "NVIDIA service temporarily unavailable"
        : "NVIDIA request rejected";
      return respond({ error: guidance, upstream_status: status }, 502);
    }
    const result = await response.json().catch(() => null);
    console.info("saju_ai_response", JSON.stringify({status:response.status,elapsed_ms:Math.round(performance.now()-started),finish_reason:result?.choices?.[0]?.finish_reason,content_type:typeof result?.choices?.[0]?.message?.content,content_chars:result?.choices?.[0]?.message?.content?.length||0,reasoning_chars:result?.choices?.[0]?.message?.reasoning_content?.length||0,usage:result?.usage}));
    const text = String(result?.choices?.[0]?.message?.content || "").trim().slice(0, 600);
    if (!text) return respond({ error: "Empty AI response" }, 502);
    const title = "오늘의 사주 이야기";
    const stored = await fetch(url,{method:"POST",headers:{...headersDb,Prefer:"resolution=ignore-duplicates"},body:JSON.stringify({user_id:uid,fortune_date:day,title,fortune_text:text})});
    if (!stored.ok) return respond({error:"Database unavailable"},503);
    const finalRead = await fetch(url+query,{headers:headersDb});
    if (!finalRead.ok) return respond({error:"Database unavailable"},503);
    const finalRows = await finalRead.json();
    return respond({title:finalRows[0]?.title||title,text:finalRows[0]?.fortune_text||text,cached:false});
  } catch { return respond({ error: "AI request timed out" }, 504); }
  finally { clearTimeout(timer); }
});
