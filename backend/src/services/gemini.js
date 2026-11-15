const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const FALLBACK_MODELS = (process.env.GEMINI_FALLBACK_MODELS || 'gemini-3.5-flash-lite')
  .split(',').map((m) => m.trim()).filter(Boolean);
const RETRYABLE = new Set([429, 500, 503]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Calls Gemini. Retries busy/overloaded responses, then falls back to another model.
 */
async function generate({ systemInstruction, contents, tools }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured on the server.');

  const primary = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
  const models = [primary, ...FALLBACK_MODELS.filter((m) => m !== primary)];

  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: systemInstruction }] },
    contents,
    tools: tools ? [{ functionDeclarations: tools }] : undefined,
    generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
  });

  for (const model of models) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      const started = Date.now();
      try {
        const res = await fetch(`${BASE}/${model}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body,
          signal: AbortSignal.timeout(25000),
        });
        const data = await res.json().catch(() => ({}));
        console.log('[Gemini]', model, 'attempt', attempt, 'status', res.status, 'in', Date.now() - started, 'ms');

        if (res.ok) return data.candidates?.[0]?.content?.parts || [];

        console.error('[Gemini]', model, res.status, data?.error?.message);
        if (!RETRYABLE.has(res.status)) break; // bad request or auth: do not retry
      } catch (err) {
        console.error('[Gemini]', model, 'network error:', err.name, err.message);
      }
      if (attempt === 1) await sleep(1500);
    }
  }

  throw new Error('The AI assistant is busy right now. Please try again in a minute, or use Quick Desk.');
}

module.exports = { generate };