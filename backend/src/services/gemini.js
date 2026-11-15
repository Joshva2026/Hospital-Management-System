const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Calls the Gemini generateContent API and returns the response parts.
 */
async function generate({ systemInstruction, contents, tools }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured on the server.');

  const model = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
  const started = Date.now();

  let res;
  try {
    res = await fetch(`${BASE}/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents,
        tools: tools ? [{ functionDeclarations: tools }] : undefined,
        generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
      }),
      signal: AbortSignal.timeout(60000),
    });
  } catch (err) {
    console.error('[Gemini] network error after', Date.now() - started, 'ms:',
      err.name, err.message, err.cause ? `cause=${err.cause.code || err.cause.message}` : '');
    throw new Error('The AI assistant is unavailable right now. Please try again.');
  }

  const data = await res.json().catch(() => ({}));
  console.log('[Gemini] status', res.status, 'in', Date.now() - started, 'ms');

  if (!res.ok) {
    console.error('[Gemini]', res.status, data?.error?.message);
    throw new Error('The AI assistant is unavailable right now. Please try again.');
  }
  return data.candidates?.[0]?.content?.parts || [];
}

module.exports = { generate };