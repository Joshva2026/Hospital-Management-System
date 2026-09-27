// ============================================================================
// SEED SCRIPT
// Run with: npm run seed
//
// Imports the initial dataset from data/seed.xlsx into PostgreSQL.
// The Excel file is a ONE-TIME SEED SOURCE, never the runtime database - once
// this script has run, the application reads/writes only PostgreSQL.
//
// IDEMPOTENCY: every INSERT uses "ON CONFLICT (<primary key>) DO NOTHING",
// so running `npm run seed` a second (or fiftieth) time will NOT create
// duplicate rows. Existing rows are left untouched.
//
// SEQUENCE ALIGNMENT: after importing, each ID sequence (patient_id_seq,
// admission_id_seq, etc.) is advanced with setval() to MAX(imported number).
// This guarantees the very next backend-generated ID continues correctly
// (e.g. patients PAT-2026-000001..000100 imported -> next created patient
// is PAT-2026-000101), and this holds even after server/DB restarts because
// the sequence's position is stored inside PostgreSQL itself.
//
// ADMIN PASSWORDS: the Excel's admin sheet contains SYNTHETIC placeholder
// password hashes (not real bcrypt hashes of any usable password) - they are
// intentionally NOT imported as-is. Instead this script creates a real admin
// account using DEFAULT_ADMIN_EMAIL / DEFAULT_ADMIN_PASSWORD / DEFAULT_ADMIN_NAME
// from your .env, properly hashed with bcrypt, only if the admins table is
// still empty.
// ============================================================================

require('dotenv').config();
const path = require('path');
const bcrypt = require('bcrypt');
const XLSX = require('xlsx');
const { pool } = require('../src/config/db');

const SEED_FILE = path.join(__dirname, '..', 'data', 'seed.xlsx');

function sheetRows(workbook, name) {
  const sheet = workbook.Sheets[name];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, { defval: null, raw: false });
}

/** Excel time cells like "16:06:13" come through as strings already with raw:false. */
function cleanTime(v) {
  if (!v) return null;
  return String(v).trim();
}
function cleanDate(v) {
  if (!v) return null;
  return String(v).trim().slice(0, 10);
}
function cleanTimestamp(v) {
  if (!v) return null;
  return String(v).trim();
}

/** Extracts the trailing numeric portion of an ID like PAT-2026-000037 -> 37 */
function trailingNumber(id) {
  if (!id) return 0;
  const match = String(id).match(/(\d+)$/);
  return match ? parseInt(match[1], 10) : 0;
}

async function advanceSequence(client, seqName, maxValue) {
  if (maxValue <= 0) return;
  // setval(seq, N, true) means "N has been consumed", so nextval() returns N+1 next.
  await client.query(`SELECT setval('${seqName}', $1, true)`, [maxValue]);
}

async function run() {
  console.log(`Reading seed file: ${SEED_FILE}`);
  const wb = XLSX.readFile(SEED_FILE, { cellDates: false });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ---------------- admins (real bcrypt account, not the sheet's placeholders) -----
    const adminCountRes = await client.query('SELECT COUNT(*)::int AS c FROM admins');
    if (adminCountRes.rows[0].c === 0) {
      const email = (process.env.DEFAULT_ADMIN_EMAIL || 'admin@cityhospital.example.com').toLowerCase();
      const password = process.env.DEFAULT_ADMIN_PASSWORD;

      if (!password) {
        throw new Error('DEFAULT_ADMIN_PASSWORD must be set before running the seed script.');
      }
      const name = process.env.DEFAULT_ADMIN_NAME || 'System Administrator';
      const hash = await bcrypt.hash(password, 12);
      await client.query(
        `INSERT INTO admins (admin_id, full_name, email, password_hash, role, status)
         VALUES ('ADM-USR-001', $1, $2, $3, 'SUPER_ADMIN', 'ACTIVE') ON CONFLICT (admin_id) DO NOTHING`,
        [name, email, hash]
      );
      console.log(`✅ Created initial admin account: ${email}`);
    } else {
      console.log('ℹ️  admins table already has data - skipping default admin creation.');
    }

    // ---------------- specialities ----------------
    const specialities = sheetRows(wb, 'specialities');
    for (const s of specialities) {
      await client.query(
        `INSERT INTO specialities (speciality_id, speciality_name, department_description, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5) ON CONFLICT (speciality_id) DO NOTHING`,
        [s.speciality_id, s.speciality_name, s.department_description, cleanTimestamp(s.created_at), cleanTimestamp(s.updated_at)]
      );
    }
    console.log(`✅ Specialities: ${specialities.length} rows processed.`);

    // ---------------- doctors ----------------
    const doctors = sheetRows(wb, 'doctors');
    for (const d of doctors) {
      await client.query(
        `INSERT INTO doctors (doctor_id, doctor_name, speciality_id, qualification, experience_years,
           mobile, email, consultation_fee, available_days, available_from, available_to, status, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) ON CONFLICT (doctor_id) DO NOTHING`,
        [d.doctor_id, d.doctor_name, d.speciality_id, d.qualification, parseInt(d.experience_years, 10) || 0,
          d.mobile, d.email, parseFloat(d.consultation_fee) || 0, d.available_days,
          cleanTime(d.available_from), cleanTime(d.available_to), d.status || 'ACTIVE',
          cleanTimestamp(d.created_at), cleanTimestamp(d.updated_at)]
      );
    }
    console.log(`✅ Doctors: ${doctors.length} rows processed.`);
    await advanceSequence(client, 'doctor_id_seq', Math.max(...doctors.map((d) => trailingNumber(d.doctor_id)), 0));

    // ---------------- wards ----------------
    const wards = sheetRows(wb, 'wards');
    for (const w of wards) {
      await client.query(
        `INSERT INTO wards (ward_id, ward_name, ward_type, floor, total_beds, status, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (ward_id) DO NOTHING`,
        [w.ward_id, w.ward_name, w.ward_type, parseInt(w.floor, 10) || null, parseInt(w.total_beds, 10) || 0,
          w.status || 'ACTIVE', cleanTimestamp(w.created_at), cleanTimestamp(w.updated_at)]
      );
    }
    console.log(`✅ Wards: ${wards.length} rows processed.`);

    // ---------------- beds ----------------
    const beds = sheetRows(wb, 'beds');
    for (const b of beds) {
      await client.query(
        `INSERT INTO beds (bed_id, ward_id, bed_number, bed_type, status, current_patient_id, last_updated)
         VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (bed_id) DO NOTHING`,
        [b.bed_id, b.ward_id, b.bed_number, b.bed_type || 'General', b.status || 'AVAILABLE',
          b.current_patient_id || null, cleanTimestamp(b.last_updated)]
      );
    }
    console.log(`✅ Beds: ${beds.length} rows processed.`);

    // ---------------- patients ----------------
    const patients = sheetRows(wb, 'patients');
    for (const p of patients) {
      await client.query(
        `INSERT INTO patients (patient_id, full_name, mobile, gender, date_of_birth, address, blood_group,
           emergency_contact, problem, reason_for_visit, patient_type, registration_date, registration_time,
           status, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) ON CONFLICT (patient_id) DO NOTHING`,
        [p.patient_id, p.full_name, p.mobile, p.gender, cleanDate(p.date_of_birth), p.address, p.blood_group,
          p.emergency_contact, p.problem, p.reason_for_visit, p.patient_type, cleanDate(p.registration_date),
          cleanTime(p.registration_time), p.status || 'ACTIVE', cleanTimestamp(p.created_at), cleanTimestamp(p.updated_at)]
      );
    }
    console.log(`✅ Patients: ${patients.length} rows processed.`);
    // THE critical step for requirement #3: next generated patient continues from the imported max.
    await advanceSequence(client, 'patient_id_seq', Math.max(...patients.map((p) => trailingNumber(p.patient_id)), 0));

    // ---------------- patient_visits ----------------
    const visits = sheetRows(wb, 'patient_visits');
    for (const v of visits) {
      await client.query(
        `INSERT INTO patient_visits (visit_id, patient_id, doctor_id, speciality_id, visit_date, visit_time,
           visit_type, complaint, diagnosis, treatment, status, notes, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) ON CONFLICT (visit_id) DO NOTHING`,
        [v.visit_id, v.patient_id, v.doctor_id, v.speciality_id, cleanDate(v.visit_date), cleanTime(v.visit_time),
          v.visit_type || 'OPD', v.complaint, v.diagnosis, v.treatment, v.status || 'COMPLETED', v.notes,
          cleanTimestamp(v.created_at), cleanTimestamp(v.updated_at)]
      );
    }
    console.log(`✅ Patient visits: ${visits.length} rows processed.`);
    await advanceSequence(client, 'visit_id_seq', Math.max(...visits.map((v) => trailingNumber(v.visit_id)), 0));

    // ---------------- admissions ----------------
    const admissions = sheetRows(wb, 'admissions');
    for (const a of admissions) {
      await client.query(
        `INSERT INTO admissions (admission_id, patient_id, doctor_id, speciality_id, ward_id, bed_id,
           admission_date, admission_time, discharge_date, discharge_time, admission_reason, initial_condition,
           status, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) ON CONFLICT (admission_id) DO NOTHING`,
        [a.admission_id, a.patient_id, a.doctor_id, a.speciality_id, a.ward_id, a.bed_id,
          cleanDate(a.admission_date), cleanTime(a.admission_time), cleanDate(a.discharge_date), cleanTime(a.discharge_time),
          a.admission_reason, a.initial_condition, a.status || 'ADMITTED', cleanTimestamp(a.created_at), cleanTimestamp(a.updated_at)]
      );
    }
    console.log(`✅ Admissions: ${admissions.length} rows processed.`);
    await advanceSequence(client, 'admission_id_seq', Math.max(...admissions.map((a) => trailingNumber(a.admission_id)), 0));

    // ---------------- daily_patient_reports ----------------
    const reports = sheetRows(wb, 'daily_patient_reports');
    for (const r of reports) {
      await client.query(
        `INSERT INTO daily_patient_reports (report_id, admission_id, patient_id, report_date, report_time,
           day_number, temperature, blood_pressure, pulse_rate, spo2, patient_condition, symptoms,
           treatment_given, doctor_notes, next_plan, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
         ON CONFLICT (report_id) DO NOTHING`,
        [r.report_id, r.admission_id, r.patient_id, cleanDate(r.report_date), cleanTime(r.report_time),
          parseInt(r.day_number, 10) || 1, parseFloat(r.temperature) || null, r.blood_pressure,
          parseInt(r.pulse_rate, 10) || null, parseInt(r.spo2, 10) || null, r.patient_condition, r.symptoms,
          r.treatment_given, r.doctor_notes, r.next_plan, cleanTimestamp(r.created_at), cleanTimestamp(r.updated_at)]
      );
    }
    console.log(`✅ Daily patient reports: ${reports.length} rows processed.`);
    await advanceSequence(client, 'report_id_seq', Math.max(...reports.map((r) => trailingNumber(r.report_id)), 0));

    // ---------------- discharges ----------------
    const discharges = sheetRows(wb, 'discharges');
    for (const d of discharges) {
      await client.query(
        `INSERT INTO discharges (discharge_id, admission_id, patient_id, discharge_date, discharge_time,
           discharge_type, final_diagnosis, treatment_summary, doctor_advice, follow_up_date, status, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT (discharge_id) DO NOTHING`,
        [d.discharge_id, d.admission_id, d.patient_id, cleanDate(d.discharge_date), cleanTime(d.discharge_time),
          d.discharge_type, d.final_diagnosis, d.treatment_summary, d.doctor_advice, cleanDate(d.follow_up_date),
          d.status || 'FINALIZED', cleanTimestamp(d.created_at), cleanTimestamp(d.updated_at)]
      );
    }
    console.log(`✅ Discharges: ${discharges.length} rows processed.`);
    await advanceSequence(client, 'discharge_id_seq', Math.max(...discharges.map((d) => trailingNumber(d.discharge_id)), 0));

    // ---------------- appointments ----------------
    const appointments = sheetRows(wb, 'appointments');
    for (const a of appointments) {
      await client.query(
        `INSERT INTO appointments (appointment_id, patient_id, doctor_id, speciality_id, appointment_date,
           appointment_time, appointment_type, reason, status, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (appointment_id) DO NOTHING`,
        [a.appointment_id, a.patient_id, a.doctor_id, a.speciality_id, cleanDate(a.appointment_date),
          cleanTime(a.appointment_time), a.appointment_type || 'CONSULTATION', a.reason, a.status || 'SCHEDULED',
          cleanTimestamp(a.created_at), cleanTimestamp(a.updated_at)]
      );
    }
    console.log(`✅ Appointments: ${appointments.length} rows processed.`);
    await advanceSequence(client, 'appointment_id_seq', Math.max(...appointments.map((a) => trailingNumber(a.appointment_id)), 0));

    // ---------------- audit_logs (historical, informational only) ----------------
    const logs = sheetRows(wb, 'audit_logs');
    let maxLogNum = 0;
    for (const l of logs) {
      // Skip logs referencing admin ids we didn't import (only ADM-USR-001 exists post-seed
      // unless you also seed the sheet's other admin rows yourself).
      const adminExists = await client.query('SELECT 1 FROM admins WHERE admin_id = $1', [l.admin_id]);
      const adminId = adminExists.rows[0] ? l.admin_id : null;
      await client.query(
        `INSERT INTO audit_logs (log_id, admin_id, action, entity_type, entity_id, description, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (log_id) DO NOTHING`,
        [l.log_id, adminId, l.action, l.entity_type, l.entity_id, l.description, cleanTimestamp(l.created_at)]
      );
      maxLogNum = Math.max(maxLogNum, trailingNumber(l.log_id));
    }
    console.log(`✅ Audit logs: ${logs.length} rows processed.`);
    await advanceSequence(client, 'log_id_seq', maxLogNum);

    await client.query('COMMIT');
    console.log('\n🎉 Seed completed successfully. Running it again will NOT create duplicates.');
    console.log(`   Next patient ID will be: PAT-${new Date().getFullYear()}-${String(Math.max(...patients.map((p) => trailingNumber(p.patient_id)), 0) + 1).padStart(6, '0')}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seed failed, transaction rolled back:', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
