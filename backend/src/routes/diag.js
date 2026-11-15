const express = require('express');
const dns = require('dns').promises;

const router = express.Router();

async function probe(url) {
  const t = Date.now();
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
    return { status: r.status, ms: Date.now() - t };
  } catch (e) {
    return { error: e.name + ': ' + e.message, cause: e.cause && (e.cause.code || e.cause.message), ms: Date.now() - t };
  }
}

router.get('/', async (req, res) => {
  const out = { node: process.version };
  try {
    out.dns = await dns.lookup('generativelanguage.googleapis.com', { all: true });
  } catch (e) {
    out.dnsError = e.message;
  }
  out.google = await probe('https://www.google.com/generate_204');
  out.gemini = await probe('https://generativelanguage.googleapis.com/v1beta/models');
  res.json(out);
});

module.exports = router;
