const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'backend/.env') });

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  // Create sequences
  const seqs = [
    { table: 'wards', prefix: 'WARD-', col: 'ward_id', seqName: 'wards_seq' },
    { table: 'specialities', prefix: 'SPEC-', col: 'speciality_id', seqName: 'specialities_seq' },
    { table: 'beds', prefix: 'BED-', col: 'bed_id', seqName: 'beds_seq' }
  ];

  for (let s of seqs) {
    const { rows } = await client.query(`SELECT ${s.col} FROM ${s.table} WHERE ${s.col} LIKE '${s.prefix}%' ORDER BY ${s.col} DESC LIMIT 1`);
    let max = 0;
    if (rows[0]) {
       max = parseInt(rows[0][s.col].split('-')[1], 10);
    }
    const next = max + 1;
    await client.query(`CREATE SEQUENCE IF NOT EXISTS ${s.seqName} START ${next}`);
    // Just in case sequence exists, set value
    await client.query(`SELECT setval('${s.seqName}', ${max}, true)`);
  }
  await client.end();
  
  // Rewrite backend routes
  // wards.js
  let wPath = path.join(__dirname, 'backend/src/routes/wards.js');
  let wContent = fs.readFileSync(wPath, 'utf8');
  wContent = wContent.replace(/async function nextWardId\(\) \{[\s\S]*?\}/, `async function nextWardId() {
  const { rows } = await query("SELECT nextval('wards_seq') AS seq");
  return \`WARD-\${String(rows[0].seq).padStart(3, '0')}\`;
}`);
  fs.writeFileSync(wPath, wContent);

  // specialities.js
  let sPath = path.join(__dirname, 'backend/src/routes/specialities.js');
  let sContent = fs.readFileSync(sPath, 'utf8');
  sContent = sContent.replace(/async function nextSpecialityId\(\) \{[\s\S]*?\}/, `async function nextSpecialityId() {
  const { rows } = await query("SELECT nextval('specialities_seq') AS seq");
  return \`SPEC-\${String(rows[0].seq).padStart(5, '0')}\`;
}`);
  fs.writeFileSync(sPath, sContent);

  // beds.js
  let bPath = path.join(__dirname, 'backend/src/routes/beds.js');
  let bContent = fs.readFileSync(bPath, 'utf8');
  bContent = bContent.replace(/async function nextBedId\(\) \{[\s\S]*?\}/, `async function nextBedId() {
  const { rows } = await query("SELECT nextval('beds_seq') AS seq");
  return \`BED-\${String(rows[0].seq).padStart(5, '0')}\`;
}`);
  fs.writeFileSync(bPath, bContent);

  console.log("Sequences created and routes updated.");
}

run().catch(console.error);
