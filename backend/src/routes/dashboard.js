const express = require('express');
const { query } = require('../config/db');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/dashboard/summary -> the 8 KPI cards, all computed live from the DB
router.get('/summary', asyncHandler(async (req, res) => {
  const { rows } = await query(`
    SELECT
      (SELECT COUNT(*) FROM patients) AS total_patients,
      (SELECT COUNT(*) FROM patients WHERE status = 'ADMITTED') AS currently_admitted,
      (SELECT COUNT(*) FROM patient_visits WHERE visit_date = CURRENT_DATE AND visit_type = 'OPD') AS todays_opd,
      (SELECT COUNT(*) FROM admissions WHERE admission_date = CURRENT_DATE) AS todays_admissions,
      (SELECT COUNT(*) FROM discharges WHERE discharge_date = CURRENT_DATE) AS todays_discharges,
      (SELECT COUNT(*) FROM patients WHERE patient_type = 'EMERGENCY' AND status != 'DISCHARGED') AS emergency_cases,
      (SELECT COUNT(*) FROM beds WHERE status = 'AVAILABLE') AS available_beds,
      (SELECT COUNT(*) FROM beds WHERE status = 'OCCUPIED') AS occupied_beds
  `);
  res.json({ success: true, data: rows[0] });
}));

// GET /api/dashboard/charts/daily-trend?days=14
router.get('/charts/daily-trend', asyncHandler(async (req, res) => {
  const days = Math.min(90, Math.max(7, parseInt(req.query.days, 10) || 14));
  const { rows } = await query(`
    SELECT d::date AS date,
      (SELECT COUNT(*) FROM patients p WHERE p.registration_date = d::date) AS registrations,
      (SELECT COUNT(*) FROM patient_visits v WHERE v.visit_date = d::date) AS opd_visits
    FROM generate_series(CURRENT_DATE - ($1::int - 1), CURRENT_DATE, interval '1 day') AS d
    ORDER BY d ASC
  `, [days]);
  res.json({ success: true, data: rows });
}));

// GET /api/dashboard/charts/admissions-vs-discharges?days=14
router.get('/charts/admissions-vs-discharges', asyncHandler(async (req, res) => {
  const days = Math.min(90, Math.max(7, parseInt(req.query.days, 10) || 14));
  const { rows } = await query(`
    SELECT d::date AS date,
      (SELECT COUNT(*) FROM admissions a WHERE a.admission_date = d::date) AS admissions,
      (SELECT COUNT(*) FROM discharges dis WHERE dis.discharge_date = d::date) AS discharges
    FROM generate_series(CURRENT_DATE - ($1::int - 1), CURRENT_DATE, interval '1 day') AS d
    ORDER BY d ASC
  `, [days]);
  res.json({ success: true, data: rows });
}));

// GET /api/dashboard/charts/patient-type-distribution
router.get('/charts/patient-type-distribution', asyncHandler(async (req, res) => {
  const { rows } = await query(`SELECT patient_type, COUNT(*)::int AS count FROM patients GROUP BY patient_type ORDER BY count DESC`);
  res.json({ success: true, data: rows });
}));

// GET /api/dashboard/charts/speciality-distribution
router.get('/charts/speciality-distribution', asyncHandler(async (req, res) => {
  const { rows } = await query(`
    SELECT s.speciality_name, COUNT(v.visit_id)::int AS visit_count
    FROM specialities s
    LEFT JOIN patient_visits v ON v.speciality_id = s.speciality_id
    GROUP BY s.speciality_name ORDER BY visit_count DESC
  `);
  res.json({ success: true, data: rows });
}));

// GET /api/dashboard/charts/bed-occupancy
router.get('/charts/bed-occupancy', asyncHandler(async (req, res) => {
  const { rows } = await query(`
    SELECT w.ward_name,
      COUNT(b.bed_id) FILTER (WHERE b.status='OCCUPIED')::int AS occupied,
      COUNT(b.bed_id) FILTER (WHERE b.status='AVAILABLE')::int AS available,
      COUNT(b.bed_id) FILTER (WHERE b.status='MAINTENANCE')::int AS maintenance
    FROM wards w LEFT JOIN beds b ON b.ward_id = w.ward_id
    GROUP BY w.ward_name ORDER BY w.ward_name
  `);
  res.json({ success: true, data: rows });
}));

module.exports = router;
