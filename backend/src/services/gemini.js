const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Calls the Gemini generateContent API and returns the response parts.
 * Uses the built-in fetch (Node 18+), so no extra SDK is needed.
 */
async function generate({ systemInstruction, contents, tools }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured on the server.');

  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  const res = await fetch(`${BASE}/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents,
      tools: tools ? [{ functionDeclarations: tools }] : undefined,
      generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
    }),
    signal: AbortSignal.timeout(30000),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('[Gemini]', res.status, data?.error?.message);
    throw new Error('The AI assistant is unavailable right now. Please try again.');
  }
  return data.candidates?.[0]?.content?.parts || [];
}

module.exports = { generate };

