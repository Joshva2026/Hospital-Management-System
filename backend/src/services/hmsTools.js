const { query } = require('../config/db');

// PII masking: set AI_MASK_PII=true to hide patient names and phone numbers from the model.
const MASK = process.env.AI_MASK_PII === 'true';
const maskName = (n) => (!MASK || !n ? n : n.split(' ').map((p) => p[0] + '.').join(' '));
const maskPhone = (m) => (!MASK || !m ? m : '******' + String(m).slice(-4));

function maskPatientRow(r) {
  const o = { ...r };
  if ('full_name' in o) o.full_name = maskName(o.full_name);
  if ('patient_name' in o) o.patient_name = maskName(o.patient_name);
  if ('mobile' in o) o.mobile = maskPhone(o.mobile);
  if ('emergency_contact' in o) o.emergency_contact = maskPhone(o.emergency_contact);
  return o;
}

const isDate = (s) => (typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null);
const like = (s) => (s ? `%${String(s).slice(0, 100)}%` : null);

// Tool declarations (what the model sees)
const declarations = [
  {
    name: 'get_dashboard_stats',
    description: "Live hospital KPIs: total patients, active admissions, available and occupied beds, today's OPD visits, today's scheduled appointments, and discharges today.",
  },
  {
    name: 'search_patients',
    description: 'Find patients by name, mobile number or patient ID. Returns up to 10 matches.',
    parameters: {
      type: 'OBJECT',
      properties: { query: { type: 'STRING', description: 'Name, mobile or patient ID (e.g. PAT-2026-000101)' } },
      required: ['query'],
    },
  },
  {
    name: 'get_patient_details',
    description: 'Full record for one patient: profile, current admission, last 5 visits, upcoming appointments and last 5 daily reports.',
    parameters: {
      type: 'OBJECT',
      properties: { patient_id: { type: 'STRING' } },
      required: ['patient_id'],
    },
  },
  {
    name: 'list_admissions',
    description: 'Admissions, optionally filtered by status. Most recent first.',
    parameters: {
      type: 'OBJECT',
      properties: {
        status: { type: 'STRING', enum: ['ADMITTED', 'DISCHARGED'] },
        limit: { type: 'INTEGER', description: 'Max rows, 1-100 (default 20)' },
      },
    },
  },
  {
    name: 'get_ward_occupancy',
    description: 'Each ward with available, occupied and maintenance bed counts.',
    parameters: {
      type: 'OBJECT',
      properties: { ward_name: { type: 'STRING', description: 'Optional partial ward name' } },
    },
  },
  {
    name: 'list_doctors',
    description: 'Doctors with speciality, qualification, availability window and consultation fee. Contact details are not available.',
    parameters: {
      type: 'OBJECT',
      properties: { speciality_name: { type: 'STRING', description: 'Optional partial speciality name' } },
    },
  },
  {
    name: 'list_appointments',
    description: 'Appointments for a date. Defaults to today.',
    parameters: {
      type: 'OBJECT',
      properties: {
        date: { type: 'STRING', description: 'YYYY-MM-DD' },
        doctor_name: { type: 'STRING', description: 'Optional partial doctor name' },
      },
    },
  },
  {
    name: 'list_visits',
    description: 'OPD visits for a date. Defaults to today.',
    parameters: {
      type: 'OBJECT',
      properties: { date: { type: 'STRING', description: 'YYYY-MM-DD' } },
    },
  },
  {
    name: 'get_recent_audit_logs',
    description: 'Recent audit log entries. Available to SUPER_ADMIN only.',
    parameters: {
      type: 'OBJECT',
      properties: { limit: { type: 'INTEGER', description: 'Max rows, 1-50 (default 20)' } },
    },
  },
];

// Handlers: all read-only, all parameterized.
const handlers = {
  async get_dashboard_stats() {
    const { rows } = await query(`
      SELECT
        (SELECT COUNT(*) FROM patients) AS total_patients,
        (SELECT COUNT(*) FROM admissions WHERE status = 'ADMITTED') AS active_admissions,
        (SELECT COUNT(*) FROM beds WHERE status = 'AVAILABLE') AS available_beds,
        (SELECT COUNT(*) FROM beds WHERE status = 'OCCUPIED') AS occupied_beds,
        (SELECT COUNT(*) FROM patient_visits WHERE visit_date = CURRENT_DATE) AS visits_today,
        (SELECT COUNT(*) FROM appointments WHERE appointment_date = CURRENT_DATE AND status = 'SCHEDULED') AS appointments_today,
        (SELECT COUNT(*) FROM discharges WHERE discharge_date = CURRENT_DATE) AS discharges_today
    `);
    return rows[0];
  },

  async search_patients({ query: q }) {
    if (!q) return { error: 'A search term is required.' };
    const { rows } = await query(`
      SELECT patient_id, full_name, mobile, gender, date_of_birth, status, patient_type, registration_date
      FROM patients
      WHERE full_name ILIKE $1 OR mobile ILIKE $1 OR patient_id ILIKE $1
      ORDER BY registration_date DESC
      LIMIT 10
    `, [like(q)]);
    return rows.map(maskPatientRow);
  },

  async get_patient_details({ patient_id }) {
    if (!patient_id) return { error: 'patient_id is required.' };
    const { rows: p } = await query(`
      SELECT patient_id, full_name, mobile, gender, date_of_birth, blood_group, address,
             emergency_contact, problem, reason_for_visit, patient_type, status, registration_date
      FROM patients WHERE patient_id = $1
    `, [patient_id]);
    if (!p.length) return { error: 'Patient not found.' };

    const [admission, visits, appointments, reports] = await Promise.all([
      query(`
        SELECT a.admission_id, a.admission_date, a.admission_reason, a.status,
               w.ward_name, b.bed_number, d.doctor_name
        FROM admissions a
        JOIN wards w ON w.ward_id = a.ward_id
        JOIN beds b ON b.bed_id = a.bed_id
        JOIN doctors d ON d.doctor_id = a.doctor_id
        WHERE a.patient_id = $1 AND a.status = 'ADMITTED' LIMIT 1
      `, [patient_id]),
      query(`
        SELECT v.visit_id, v.visit_date, v.visit_time, v.status, v.complaint, v.diagnosis, v.treatment, d.doctor_name
        FROM patient_visits v JOIN doctors d ON d.doctor_id = v.doctor_id
        WHERE v.patient_id = $1 ORDER BY v.visit_date DESC, v.visit_time DESC LIMIT 5
      `, [patient_id]),
      query(`
        SELECT appointment_id, appointment_date, appointment_time, status, reason
        FROM appointments
        WHERE patient_id = $1 AND appointment_date >= CURRENT_DATE
        ORDER BY appointment_date, appointment_time LIMIT 5
      `, [patient_id]),
      query(`
        SELECT report_date, day_number, temperature, blood_pressure, pulse_rate, spo2,
               patient_condition, doctor_notes
        FROM daily_patient_reports WHERE patient_id = $1
        ORDER BY report_date DESC LIMIT 5
      `, [patient_id]),
    ]);

    return {
      patient: maskPatientRow(p[0]),
      current_admission: admission.rows[0] || null,
      recent_visits: visits.rows,
      upcoming_appointments: appointments.rows,
      recent_daily_reports: reports.rows,
    };
  },

  async list_admissions({ status, limit } = {}) {
    const st = ['ADMITTED', 'DISCHARGED'].includes(status) ? status : null;
    const lim = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const { rows } = await query(`
      SELECT a.admission_id, p.patient_id, p.full_name AS patient_name, a.admission_date,
             a.status, w.ward_name, b.bed_number, d.doctor_name
      FROM admissions a
      JOIN patients p ON p.patient_id = a.patient_id
      JOIN wards w ON w.ward_id = a.ward_id
      JOIN beds b ON b.bed_id = a.bed_id
      JOIN doctors d ON d.doctor_id = a.doctor_id
      WHERE ($1::text IS NULL OR a.status = $1)
      ORDER BY a.admission_date DESC
      LIMIT $2
    `, [st, lim]);
    return rows.map(maskPatientRow);
  },

  async get_ward_occupancy({ ward_name } = {}) {
    const { rows } = await query(`
      SELECT w.ward_id, w.ward_name, w.ward_type, w.floor,
             COUNT(b.bed_id) FILTER (WHERE b.status = 'AVAILABLE') AS available,
             COUNT(b.bed_id) FILTER (WHERE b.status = 'OCCUPIED') AS occupied,
             COUNT(b.bed_id) FILTER (WHERE b.status = 'MAINTENANCE') AS maintenance
      FROM wards w
      LEFT JOIN beds b ON b.ward_id = w.ward_id
      WHERE w.ward_name ILIKE $1
      GROUP BY w.ward_id
      ORDER BY w.ward_name
    `, [like(ward_name) || '%']);
    return rows;
  },

  async list_doctors({ speciality_name } = {}) {
    const { rows } = await query(`
      SELECT d.doctor_id, d.doctor_name, s.speciality_name, d.qualification, d.experience_years,
             d.available_days, d.available_from, d.available_to, d.consultation_fee, d.status
      FROM doctors d
      JOIN specialities s ON s.speciality_id = d.speciality_id
      WHERE ($1::text IS NULL OR s.speciality_name ILIKE $1)
      ORDER BY d.doctor_name
    `, [like(speciality_name)]);
    return rows;
  },

  async list_appointments({ date, doctor_name } = {}) {
    const { rows } = await query(`
      SELECT a.appointment_id, a.appointment_date, a.appointment_time, a.status, a.reason,
             p.patient_id, p.full_name AS patient_name, d.doctor_name
      FROM appointments a
      JOIN patients p ON p.patient_id = a.patient_id
      JOIN doctors d ON d.doctor_id = a.doctor_id
      WHERE a.appointment_date = COALESCE($1::date, CURRENT_DATE)
        AND ($2::text IS NULL OR d.doctor_name ILIKE $2)
      ORDER BY a.appointment_time
      LIMIT 100
    `, [isDate(date), like(doctor_name)]);
    return rows.map(maskPatientRow);
  },

  async list_visits({ date } = {}) {
    const { rows } = await query(`
      SELECT v.visit_id, p.patient_id, p.full_name AS patient_name, v.visit_date, v.visit_time,
             v.status, v.complaint, d.doctor_name
      FROM patient_visits v
      JOIN patients p ON p.patient_id = v.patient_id
      JOIN doctors d ON d.doctor_id = v.doctor_id
      WHERE v.visit_date = COALESCE($1::date, CURRENT_DATE)
      ORDER BY v.visit_time
      LIMIT 100
    `, [isDate(date)]);
    return rows.map(maskPatientRow);
  },

  async get_recent_audit_logs({ limit } = {}, admin) {
    if (admin?.role !== 'SUPER_ADMIN') return { error: 'Only super admins can view audit logs.' };
    const lim = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
    const { rows } = await query(`
      SELECT action, entity_type, entity_id, description, created_at
      FROM audit_logs ORDER BY created_at DESC LIMIT $1
    `, [lim]);
    return rows;
  },
};

// Runs one tool call. Errors become a result the model can read, never a crash.
async function runTool(name, args, admin) {
  const fn = handlers[name];
  if (!fn) return { error: `Unknown tool: ${name}` };
  try {
    return await fn(args || {}, admin);
  } catch (err) {
    console.error('[AI tool]', name, err.message);
    return { error: 'The lookup failed. Try again or check the module directly.' };
  }
}

module.exports = { declarations, runTool };

