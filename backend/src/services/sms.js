// SMS sender. SMS_MODE=LOG (default) only records messages in sms_log.
// SMS_MODE=PROVIDER is reserved for a real provider. In India, real SMS needs
// TRAI DLT registration (sender ID and approved templates) before it can be used.
const { query } = require('../config/db');

function maskMobile(mobile) {
  const digits = String(mobile || '').replace(/\D/g, '');
  return 'XXXXXX' + digits.slice(-4);
}

async function sendSms(mobile, message) {
  const mode = String(process.env.SMS_MODE || 'LOG').toUpperCase();

  if (mode === 'PROVIDER') {
    throw new Error('SMS provider is not configured yet. Set up DLT registration first.');
  }

  await query(
    'INSERT INTO sms_log (mobile_masked, message, mode, status) VALUES ($1, $2, $3, $4)',
    [maskMobile(mobile), message, 'LOG', 'LOGGED']
  );
  return { mode: 'LOG' };
}

module.exports = { sendSms, maskMobile };
