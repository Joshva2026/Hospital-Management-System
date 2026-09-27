const fs = require('fs');

// 1. Append sequences to 001_init.sql
const initFile = 'E:/hms awp project/backend/migrations/001_init.sql';
let sql = fs.readFileSync(initFile, 'utf8');
if (!sql.includes('wards_seq')) {
  sql += `

-- Safely create and initialize sequences based on existing table data to avoid collision
DO $$
DECLARE
    w_max INTEGER;
    s_max INTEGER;
    b_max INTEGER;
BEGIN
    SELECT COALESCE(MAX(CAST(SPLIT_PART(ward_id, '-', 2) AS INTEGER)), 0) INTO w_max FROM wards WHERE ward_id LIKE 'WARD-%';
    IF w_max = 0 THEN w_max := 1; END IF;
    EXECUTE 'CREATE SEQUENCE IF NOT EXISTS wards_seq START WITH ' || w_max;
    PERFORM setval('wards_seq', w_max, true);

    SELECT COALESCE(MAX(CAST(SPLIT_PART(speciality_id, '-', 2) AS INTEGER)), 0) INTO s_max FROM specialities WHERE speciality_id LIKE 'SPEC-%';
    IF s_max = 0 THEN s_max := 1; END IF;
    EXECUTE 'CREATE SEQUENCE IF NOT EXISTS specialities_seq START WITH ' || s_max;
    PERFORM setval('specialities_seq', s_max, true);

    SELECT COALESCE(MAX(CAST(SPLIT_PART(bed_id, '-', 2) AS INTEGER)), 0) INTO b_max FROM beds WHERE bed_id LIKE 'BED-%';
    IF b_max = 0 THEN b_max := 1; END IF;
    EXECUTE 'CREATE SEQUENCE IF NOT EXISTS beds_seq START WITH ' || b_max;
    PERFORM setval('beds_seq', b_max, true);
END $$;
`;
  fs.writeFileSync(initFile, sql, 'utf8');
}

// 2. Rewrite JS routes
function rewriteRoute(file, oldFnMatch, newCode) {
  let p = 'E:/hms awp project/backend/src/routes/' + file;
  let c = fs.readFileSync(p, 'utf8');
  c = c.replace(oldFnMatch, newCode);
  fs.writeFileSync(p, c, 'utf8');
}

rewriteRoute('wards.js', /async function nextWardId\(\) \{[\s\S]*?\}/, `async function nextWardId() {
  const { rows } = await query("SELECT nextval('wards_seq') AS seq");
  return 'WARD-' + String(rows[0].seq).padStart(3, '0');
}`);

rewriteRoute('specialities.js', /async function nextSpecialityId\(\) \{[\s\S]*?\}/, `async function nextSpecialityId() {
  const { rows } = await query("SELECT nextval('specialities_seq') AS seq");
  return 'SPEC-' + String(rows[0].seq).padStart(5, '0');
}`);

rewriteRoute('beds.js', /async function nextBedId\(\) \{[\s\S]*?\}/, `async function nextBedId() {
  const { rows } = await query("SELECT nextval('beds_seq') AS seq");
  return 'BED-' + String(rows[0].seq).padStart(5, '0');
}`);

console.log('SQL and routes updated for sequences!');
