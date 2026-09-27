const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const SEED_FILE = path.join(__dirname, '../data/seed.xlsx');

function sheetRows(workbook, name) {
  const sheet = workbook.Sheets[name];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, { defval: null, raw: false });
}

function cleanTime(v) { return v ? String(v).trim() : null; }
function cleanDate(v) { return v ? String(v).trim().slice(0, 10) : null; }

const wb = XLSX.readFile(SEED_FILE, { cellDates: false });

const data = {
  admins: sheetRows(wb, 'admins'),
  specialities: sheetRows(wb, 'specialities'),
  doctors: sheetRows(wb, 'doctors'),
  wards: sheetRows(wb, 'wards'),
  beds: sheetRows(wb, 'beds'),
  patients: sheetRows(wb, 'patients'),
  patient_visits: sheetRows(wb, 'patient_visits'),
  admissions: sheetRows(wb, 'admissions'),
  daily_patient_reports: sheetRows(wb, 'daily_patient_reports'),
  discharges: sheetRows(wb, 'discharges'),
  appointments: sheetRows(wb, 'appointments'),
  audit_logs: sheetRows(wb, 'audit_logs')
};

const mismatches = [];

function checkEnum(sheet, row, col, val, allowed) {
  if (val && !allowed.includes(val)) {
    mismatches.push({
      Severity: 'CRITICAL', Sheet: sheet, RowID: row, Column: col, Value: val, Allowed: allowed.join(', '), 
      Problem: 'Value not in allowed ENUM/CHECK constraint',
      Recommendation: `Change to one of: ${allowed.join(', ')}`
    });
  }
}

function checkFK(sheet, row, col, val, parentSheet, parentCol) {
  if (val && !data[parentSheet].some(p => p[parentCol] === val)) {
    mismatches.push({
      Severity: 'CRITICAL', Sheet: sheet, RowID: row, Column: col, Value: val, Allowed: `Must exist in ${parentSheet}.${parentCol}`,
      Problem: 'Foreign Key Violation',
      Recommendation: `Create parent record or update ID`
    });
  }
}

// 1. Enums and Basic Data
data.admins.forEach(r => {
  checkEnum('admins', r.admin_id, 'role', r.role, ['SUPER_ADMIN', 'ADMIN']);
  checkEnum('admins', r.admin_id, 'status', r.status, ['ACTIVE', 'INACTIVE']);
});

data.specialities.forEach(r => {
  checkEnum('specialities', r.speciality_id, 'status', r.status, ['ACTIVE', 'INACTIVE']);
});

data.doctors.forEach(r => {
  checkEnum('doctors', r.doctor_id, 'status', r.status, ['ACTIVE', 'INACTIVE']);
  checkFK('doctors', r.doctor_id, 'speciality_id', r.speciality_id, 'specialities', 'speciality_id');
});

data.wards.forEach(r => {
  checkEnum('wards', r.ward_id, 'status', r.status, ['ACTIVE', 'INACTIVE']);
});

data.beds.forEach(r => {
  checkEnum('beds', r.bed_id, 'status', r.status, ['AVAILABLE', 'OCCUPIED', 'MAINTENANCE']);
  checkFK('beds', r.bed_id, 'ward_id', r.ward_id, 'wards', 'ward_id');
});

data.patients.forEach(r => {
  checkEnum('patients', r.patient_id, 'gender', r.gender, ['Male', 'Female', 'Other']);
  checkEnum('patients', r.patient_id, 'patient_type', r.patient_type, ['OPD', 'EMERGENCY', 'ADMITTED', 'DISCHARGED']);
  checkEnum('patients', r.patient_id, 'status', r.status, ['ACTIVE', 'ADMITTED', 'DISCHARGED', 'INACTIVE']);
});

data.patient_visits.forEach(r => {
  checkEnum('patient_visits', r.visit_id, 'status', r.status, ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']);
  checkFK('patient_visits', r.visit_id, 'patient_id', r.patient_id, 'patients', 'patient_id');
  checkFK('patient_visits', r.visit_id, 'doctor_id', r.doctor_id, 'doctors', 'doctor_id');
  checkFK('patient_visits', r.visit_id, 'speciality_id', r.speciality_id, 'specialities', 'speciality_id');
});

data.admissions.forEach(r => {
  checkEnum('admissions', r.admission_id, 'status', r.status, ['ADMITTED', 'DISCHARGED']);
  checkFK('admissions', r.admission_id, 'patient_id', r.patient_id, 'patients', 'patient_id');
  checkFK('admissions', r.admission_id, 'doctor_id', r.doctor_id, 'doctors', 'doctor_id');
  checkFK('admissions', r.admission_id, 'speciality_id', r.speciality_id, 'specialities', 'speciality_id');
  checkFK('admissions', r.admission_id, 'ward_id', r.ward_id, 'wards', 'ward_id');
  checkFK('admissions', r.admission_id, 'bed_id', r.bed_id, 'beds', 'bed_id');
  
  // Date check
  if (r.discharge_date && r.admission_date) {
    if (new Date(r.discharge_date) < new Date(r.admission_date)) {
      mismatches.push({
        Severity: 'CRITICAL', Sheet: 'admissions', RowID: r.admission_id, Column: 'discharge_date', Value: r.discharge_date, Allowed: `>= ${r.admission_date}`,
        Problem: 'Chronological Violation', Recommendation: 'Fix dates'
      });
    }
  }
});

data.daily_patient_reports.forEach(r => {
  checkFK('daily_patient_reports', r.report_id, 'admission_id', r.admission_id, 'admissions', 'admission_id');
  checkFK('daily_patient_reports', r.report_id, 'patient_id', r.patient_id, 'patients', 'patient_id');
});

data.discharges.forEach(r => {
  checkEnum('discharges', r.discharge_id, 'status', r.status, ['FINALIZED']);
  checkFK('discharges', r.discharge_id, 'admission_id', r.admission_id, 'admissions', 'admission_id');
  checkFK('discharges', r.discharge_id, 'patient_id', r.patient_id, 'patients', 'patient_id');
});

data.appointments.forEach(r => {
  checkEnum('appointments', r.appointment_id, 'status', r.status, ['SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW']);
  checkFK('appointments', r.appointment_id, 'patient_id', r.patient_id, 'patients', 'patient_id');
  checkFK('appointments', r.appointment_id, 'doctor_id', r.doctor_id, 'doctors', 'doctor_id');
  checkFK('appointments', r.appointment_id, 'speciality_id', r.speciality_id, 'specialities', 'speciality_id');
});

// Primary Key Uniqueness
function checkPKUnique(sheet, pkCol) {
  const seen = new Set();
  data[sheet].forEach(r => {
    if (seen.has(r[pkCol])) {
      mismatches.push({
        Severity: 'CRITICAL', Sheet: sheet, RowID: r[pkCol], Column: pkCol, Value: r[pkCol], Allowed: 'Unique',
        Problem: 'Duplicate Primary Key', Recommendation: 'Change ID'
      });
    }
    seen.add(r[pkCol]);
  });
}
checkPKUnique('specialities', 'speciality_id');
checkPKUnique('doctors', 'doctor_id');
checkPKUnique('wards', 'ward_id');
checkPKUnique('beds', 'bed_id');
checkPKUnique('patients', 'patient_id');
checkPKUnique('patient_visits', 'visit_id');
checkPKUnique('admissions', 'admission_id');
checkPKUnique('daily_patient_reports', 'report_id');
checkPKUnique('discharges', 'discharge_id');
checkPKUnique('appointments', 'appointment_id');

// Unique constraints
const bedWards = new Set();
data.beds.forEach(r => {
  const k = r.ward_id + '-' + r.bed_number;
  if (bedWards.has(k)) {
    mismatches.push({
      Severity: 'CRITICAL', Sheet: 'beds', RowID: r.bed_id, Column: 'bed_number', Value: r.bed_number, Allowed: 'Unique per ward',
      Problem: 'UNIQUE(ward_id, bed_number)', Recommendation: 'Change bed_number'
    });
  }
  bedWards.add(k);
});

const reportAdmDates = new Set();
data.daily_patient_reports.forEach(r => {
  const k = r.admission_id + '-' + cleanDate(r.report_date);
  if (reportAdmDates.has(k)) {
    mismatches.push({
      Severity: 'CRITICAL', Sheet: 'daily_patient_reports', RowID: r.report_id, Column: 'report_date', Value: r.report_date, Allowed: 'Unique per admission',
      Problem: 'UNIQUE(admission_id, report_date)', Recommendation: 'Change report_date'
    });
  }
  reportAdmDates.add(k);
});

const activeAdmBed = new Set();
const activeAdmPatient = new Set();
data.admissions.forEach(r => {
  if (r.status === 'ADMITTED') {
    if (activeAdmBed.has(r.bed_id)) {
      mismatches.push({
        Severity: 'CRITICAL', Sheet: 'admissions', RowID: r.admission_id, Column: 'bed_id', Value: r.bed_id, Allowed: 'One active per bed',
        Problem: 'UNIQUE INDEX uq_one_active_admission_per_bed', Recommendation: 'Set previous to DISCHARGED or change bed'
      });
    }
    activeAdmBed.add(r.bed_id);
    
    if (activeAdmPatient.has(r.patient_id)) {
      mismatches.push({
        Severity: 'CRITICAL', Sheet: 'admissions', RowID: r.admission_id, Column: 'patient_id', Value: r.patient_id, Allowed: 'One active per patient',
        Problem: 'UNIQUE INDEX uq_one_active_admission_per_patient', Recommendation: 'Set previous to DISCHARGED'
      });
    }
    activeAdmPatient.add(r.patient_id);
  }
});

const activeApptSlots = new Set();
data.appointments.forEach(r => {
  if (r.status === 'SCHEDULED') {
    const k = r.doctor_id + '-' + cleanDate(r.appointment_date) + '-' + cleanTime(r.appointment_time);
    if (activeApptSlots.has(k)) {
      mismatches.push({
        Severity: 'CRITICAL', Sheet: 'appointments', RowID: r.appointment_id, Column: 'appointment_time', Value: r.appointment_time, Allowed: 'Unique doctor slot',
        Problem: 'UNIQUE INDEX uq_doctor_slot_active', Recommendation: 'Change time or status'
      });
    }
    activeApptSlots.add(k);
  }
});

fs.writeFileSync(path.join(__dirname, 'audit_results.json'), JSON.stringify(mismatches, null, 2));
