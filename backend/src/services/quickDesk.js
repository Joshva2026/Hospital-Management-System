const { query } = require('../config/db');
const { handlers } = require('./hmsTools');

const TZ = 'Asia/Kolkata';
const pad = (n) => String(n).padStart(2, '0');
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

// Today's date in Indian time, regardless of the server's timezone.
function istToday() {
  const [y, m, d] = new Date().toLocaleDateString('en-CA', { timeZone: TZ }).split('-').map(Number);
  return { y, m, d };
}

function dateOffset(days) {
  const t = istToday();
  return new Date(Date.UTC(t.y, t.m - 1, t.d + days)).toISOString().slice(0, 10);
}

function parseDate(t) {
  if (/\byesterday\b/.test(t)) return dateOffset(-1);
  if (/\btoday\b/.test(t)) return dateOffset(0);
  const iso = t.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return iso[0];
  const dm = t.match(/\b(\d{1,2})\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/);
  if (dm) return `${istToday().y}-${pad(MONTHS[dm[2]])}-${pad(dm[1])}`;
  return null;
}

function parseMonth(t) {
  const today = istToday();
  if (/last month|previous month/.test(t)) return new Date(Date.UTC(today.y, today.m - 2, 1)).toISOString().slice(0, 7);
  if (/this month|current month/.test(t)) return `${today.y}-${pad(today.m)}`;
  const ym = t.match(/\b(\d{4})-(\d{2})\b/);
  if (ym) return ym[0];
  const named = t.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{4})\b/);
  if (named) return `${named[2]}-${pad(MONTHS[named[1]])}`;
  return null;
}

const label = (k) => k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const fmt = (v) => (v instanceof Date ? v.toLocaleDateString('en-GB', { timeZone: TZ }) : v);

function kv(obj, names) {
  return names.map(([k, text]) => `${text}: ${obj[k] ?? 0}`).join('\n');
}

function table(rows, fields, max = 10) {
  if (!rows || !rows.length) return 'No records found.';
  const lines = rows.slice(0, max).map((r, i) =>
    `${i + 1}. ` + fields.map((f) => fmt(r[f])).filter((v) => v !== null && v !== undefined && v !== '').join(' | ')
  );
  if (rows.length > max) lines.push(`...and ${rows.length - max} more. Open the module for the full list.`);
  return lines.join('\n');
}

const MENU = [
  { label: 'ICU beds', text: 'beds in icu' },
  { label: 'All ward occupancy', text: 'ward occupancy' },
  { label: 'Doctors on duty', text: 'doctors' },
  { label: "Today's OPD visits", text: 'opd visits today' },
  { label: "Today's appointments", text: 'appointments today' },
  { label: 'Current admissions', text: 'admitted patients' },
  { label: 'Discharged today', text: 'discharged today' },
  { label: 'Find patient', text: 'find patient ' },
  { label: 'Monthly report (last month)', text: 'monthly report last month' },
  { label: "Today's summary", text: 'today summary' },
  { label: 'Visiting hours', text: 'visiting hours' },
  { label: 'Emergency number', text: 'emergency number' },
];

async function patientDetails(id) {
  const r = await handlers.get_patient_details({ patient_id: id });
  if (r.error) return { reply: r.error };
  const p = r.patient;
  let s = `${p.full_name} (${p.patient_id})\nMobile: ${p.mobile}\nGender: ${p.gender}\nStatus: ${p.status}\nType: ${p.patient_type}\nRegistered: ${fmt(p.registration_date)}`;
  if (r.current_admission) {
    s += `\n\nCurrently admitted: ${r.current_admission.ward_name}, bed ${r.current_admission.bed_number} (${r.current_admission.admission_id})`;
  }
  s += `\n\nLast visits:\n${table(r.recent_visits, ['visit_date', 'doctor_name', 'status'], 5)}`;
  s += `\n\nUpcoming appointments:\n${table(r.upcoming_appointments, ['appointment_date', 'appointment_time', 'status'], 5)}`;
  return { reply: s };
}

async function answer(message) {
  const raw = String(message || '').trim();
  const t = raw.toLowerCase();

  if (!t) {
    return { reply: 'Pick a topic below, or type your question. Example: "beds in icu" or "find patient Ravi".', suggestions: MENU };
  }

  // Help
  if (/\b(help|menu|options|what can you)\b/.test(t)) {
    return { reply: 'I can answer these without AI:\n' + MENU.map((m) => '- ' + m.label).join('\n'), suggestions: MENU };
  }

  // Patient by ID
  const pid = raw.match(/PAT-\d{4}-\d{6}/i);
  if (pid) return patientDetails(pid[0].toUpperCase());

  // Monthly report
  if (/\breport\b|\bmonthly\b/.test(t)) {
    const today = istToday();
    const month = parseMonth(t) || `${today.y}-${pad(today.m)}`;
    const r = await handlers.get_monthly_report({ month });
    if (r.error) return { reply: r.error };
    return {
      reply: `Monthly report for ${month}\n` + kv(r, [
        ['new_registrations', 'New registrations'],
        ['admissions', 'Admissions'],
        ['discharges', 'Discharges'],
        ['opd_visits', 'OPD visits'],
        ['appointments_completed', 'Appointments completed'],
        ['appointments_no_show', 'Appointments no-show'],
      ]),
    };
  }

  // Hospital info
  if (/visiting|emergency|ambulance|address|location|where is|department|contact|phone|opd timing|hospital timing/.test(t)) {
    const info = (await query('SELECT key, value FROM hospital_info ORDER BY key')).rows;
    const map = [
      [/visiting/, 'visiting_hours'],
      [/emergency|ambulance/, 'emergency_number'],
      [/address|location|where is/, 'address'],
      [/department/, 'departments'],
      [/contact|phone/, 'phone'],
      [/opd timing|hospital timing/, 'opd_timings'],
    ];
    const keys = map.filter(([re]) => re.test(t)).map(([, k]) => k);
    const rows = keys.length ? info.filter((r) => keys.includes(r.key)) : info;
    return { reply: rows.map((r) => `${label(r.key)}: ${r.value}`).join('\n') };
  }

  // Beds and wards
  if (/\b(bed|beds|icu|ward|wards|occupancy|vacant|available)\b/.test(t)) {
    const wards = (await query('SELECT ward_name FROM wards')).rows;
    const hit = wards.find((w) => w.ward_name.length >= 3 && t.includes(w.ward_name.toLowerCase()));
    const wardName = hit ? hit.ward_name : t.includes('icu') ? 'icu' : '';
    const rows = await handlers.get_ward_occupancy({ ward_name: wardName });
    if (rows.error) return { reply: rows.error };
    if (!rows.length) return { reply: wardName ? `No ward matches "${wardName}".` : 'No wards found.' };
    return {
      reply: `Ward occupancy${wardName ? ` for ${wardName}` : ''}:\n` + rows.map((w) =>
        `${w.ward_name}: ${w.available} free, ${w.occupied} occupied, ${w.maintenance} under maintenance`
      ).join('\n'),
    };
  }

  // Doctors
  if (/\b(doctor|doctors|specialist|specialists|speciality|specialities)\b/.test(t)) {
    const specs = (await query('SELECT speciality_name FROM specialities')).rows;
    const hit = specs.find((s) => t.includes(s.speciality_name.toLowerCase()));
    const rows = await handlers.list_doctors({ speciality_name: hit ? hit.speciality_name : '' });
    if (rows.error) return { reply: rows.error };
    return {
      reply: `Doctors${hit ? ' in ' + hit.speciality_name : ''}:\n` +
        table(rows, ['doctor_name', 'speciality_name', 'available_days', 'available_from', 'available_to'], 20),
    };
  }

  // Appointments
  if (/\bappointments?\b/.test(t)) {
    const date = parseDate(t);
    const rows = await handlers.list_appointments({ date: date || undefined });
    if (rows.error) return { reply: rows.error };
    return {
      reply: `Appointments for ${date || 'today'}:\n` +
        table(rows, ['appointment_time', 'patient_name', 'doctor_name', 'status'], 20),
    };
  }

  // OPD visits
  if (/\b(opd|visits?)\b/.test(t)) {
    const date = parseDate(t);
    const rows = await handlers.list_visits({ date: date || undefined });
    if (rows.error) return { reply: rows.error };
    return {
      reply: `OPD visits for ${date || 'today'} (${rows.length}):\n` +
        table(rows, ['visit_time', 'patient_name', 'doctor_name', 'status'], 20),
    };
  }

  // Admissions and discharges
  if (/\b(admit|admitted|admission|admissions|inpatient|inpatients|discharge|discharged)\b/.test(t)) {
    const status = /discharg/.test(t) ? 'DISCHARGED' : 'ADMITTED';
    const rows = await handlers.list_admissions({ status, limit: 30 });
    if (rows.error) return { reply: rows.error };
    return {
      reply: `${status === 'ADMITTED' ? 'Current admissions' : 'Discharged admissions'} (${rows.length}):\n` +
        table(rows, ['patient_name', 'ward_name', 'bed_number', 'doctor_name'], 30),
    };
  }

  // Today's summary
  if (/\b(today|dashboard|summary|stats|statistics|how many|count)\b/.test(t)) {
    const s = await handlers.get_dashboard_stats();
    return {
      reply: `Today's summary:\n` + kv(s, [
        ['total_patients', 'Total patients'],
        ['active_admissions', 'Active admissions'],
        ['available_beds', 'Available beds'],
        ['occupied_beds', 'Occupied beds'],
        ['visits_today', 'OPD visits today'],
        ['appointments_today', 'Appointments today'],
        ['discharges_today', 'Discharges today'],
      ]),
    };
  }

  // Patient search by name, mobile or ID
  if (/\b(find|search|lookup|look up|details of|history of|patient)\b/.test(t)) {
    const name = t
      .replace(/\b(find|search|lookup|look up|details of|history of|patient|details|history|for|of|the|show|please)\b/g, '')
      .trim();
    if (name.length < 2) {
      return { reply: "Type the patient's name, mobile number or ID. Example: \"find patient Ravi\" or \"PAT-2026-000101\"." };
    }
    const rows = await handlers.search_patients({ query: name });
    if (rows.error) return { reply: rows.error };
    if (!rows.length) return { reply: `No patient found for "${name}".` };
    return { reply: 'Matches:\n' + table(rows, ['patient_id', 'full_name', 'mobile', 'status']) + '\n\nType a patient ID for full details.' };
  }

  return {
    reply: "I didn't understand that. Pick a topic below, or try \"beds in icu\", \"find patient Ravi\", \"monthly report last month\" or \"visiting hours\".",
    suggestions: MENU,
  };
}

module.exports = { answer, MENU };

