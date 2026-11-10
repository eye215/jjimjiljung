const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');
const { webcrypto } = require('node:crypto');

(async () => {
  const source = stripTypeScriptTypes(fs.readFileSync(path.join(__dirname, '..', 'supabase/functions/saju-ai/index.ts'), 'utf8'));
  const { analysisInput, fortune } = await import('../saju.js');
  const input = analysisInput(fortune('1994-02-15', 17, new Date()));
  const saved = new Map(), calls = [];
  let handler, aiCalls = 0;
  const fakeFetch = async (url, options = {}) => {
    calls.push({ url: String(url), body: options.body });
    if (String(url).endsWith('/auth/v1/user')) return Response.json({ id: '00000000-0000-0000-0000-000000000001' });
    if (String(url).includes('/rest/v1/daily_fortunes')) {
      if (options.method === 'DELETE') { saved.clear(); return new Response(null, { status: 204 }); }
      if (options.method === 'POST') {
        const row = JSON.parse(options.body);
        saved.set(row.user_id, row);
        return new Response(null, { status: 204 });
      }
      const row = saved.get('00000000-0000-0000-0000-000000000001');
      return Response.json(row ? [row] : []);
    }
    if (String(url).includes('integrate.api.nvidia.com')) {
      aiCalls++;
      return Response.json({ choices: [{ message: { content: '오늘은 차분히 흐름을 살펴보세요.\n가까운 사람과 마음을 나눠 보세요.\n작은 계획 하나를 실행해 보세요.' } }] });
    }
    throw new Error('Unexpected URL ' + url);
  };
  vm.runInNewContext(source, {
    Deno: { env: { get: key => ({ SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'public', SUPABASE_SERVICE_ROLE_KEY: 'secret', NVIDIA_API_KEY: 'private' })[key] }, serve: fn => { handler = fn; } },
    fetch: fakeFetch, Request, Response, TextEncoder, AbortController, crypto: webcrypto, setTimeout, clearTimeout, console,
  }, { filename: 'saju-ai/index.ts' });
  const invoke = async body => handler(new Request('https://example.supabase.co/functions/v1/saju-ai', {
    method: 'POST', headers: { authorization: 'Bearer valid', 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }));
  let response = await invoke(input);
  assert.equal(response.status, 200);
  let result = await response.json();
  assert.equal(result.lines.length, 3);
  assert.equal(result.cached, false);
  assert.equal(aiCalls, 1);
  const sent = JSON.parse(calls.find(c => c.url.includes('integrate.api.nvidia.com')).body);
  assert.equal(JSON.stringify(sent).includes('1994-02-15'), false, 'Birth date is not sent to NVIDIA');
  assert.equal(JSON.stringify(sent).includes('17:59'), false, 'Birth time is not sent to NVIDIA');
  response = await invoke(input);
  result = await response.json();
  assert.equal(result.cached, true);
  assert.equal(aiCalls, 1, 'Same-day result is cached');
  response = await invoke({ ...input, mine: 'invalid' });
  assert.equal(response.status, 400);
  assert.equal(aiCalls, 1, 'Invalid values cannot become model instructions');
  response = await invoke({ action: 'forget' });
  assert.equal(response.status, 200);
  assert.equal(saved.size, 0, 'Forget removes saved interpretation');
  console.log('PASS: three AI lines, computed-only input, same-day cache, invalid input rejected, saved result deleted.');
})().catch(error => { console.error(error); process.exit(1); });
