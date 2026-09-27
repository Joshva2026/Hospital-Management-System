const express = require('express');
const { query } = require('../config/db');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/analytics/doctor-workload
router.get('/doctor-workload', asyncHandler(async (req, res) => {
  const { rows } = await query(`
    SELECT d.doctor_id, d.doctor_name, s.speciality_name,
      COUNT(DISTINCT v.visit_id)::int AS total_visits,
      COUNT(DISTINCT a.admission_id)::int AS total_admissions,
      COUNT(DISTINCT ap.appointment_id)::int AS total_appointments
    FROM doctors d
    JOIN specialities s ON s.speciality_id = d.speciality_id
    LEFT JOIN patient_visits v ON v.doctor_id = d.doctor_id
    LEFT JOIN admissions a ON a.doctor_id = d.doctor_id
    LEFT JOIN appointments ap ON ap.doctor_id = d.doctor_id
    GROUP BY d.doctor_id, d.doctor_name, s.speciality_name
    ORDER BY total_visits DESC
  `);
  res.json({ success: true, data: rows });
}));

// GET /api/analytics/appointment-status
router.get('/appointment-status', asyncHandler(async (req, res) => {
  const { rows } = await query(`SELECT status, COUNT(*)::int AS count FROM appointments GROUP BY status`);
  res.json({ success: true, data: rows });
}));

// GET /api/analytics/registrations-trend?months=6
router.get('/registrations-trend', asyncHandler(async (req, res) => {
  const months = Math.min(24, Math.max(1, parseInt(req.query.months, 10) || 6));
  const { rows } = await query(`
    SELECT to_char(date_trunc('month', m), 'YYYY-MM') AS month,
      (SELECT COUNT(*) FROM patients p WHERE date_trunc('month', p.registration_date) = date_trunc('month', m)) AS registrations
    FROM generate_series(date_trunc('month', CURRENT_DATE) - ($1::int - 1) * interval '1 month', date_trunc('month', CURRENT_DATE), interval '1 month') AS m
    ORDER BY m ASC
  `, [months]);
  res.json({ success: true, data: rows });
}));

// GET /api/analytics/discharge-types
router.get('/discharge-types', asyncHandler(async (req, res) => {
  const { rows } = await query(`SELECT discharge_type, COUNT(*)::int AS count FROM discharges GROUP BY discharge_type`);
  res.json({ success: true, data: rows });
}));

module.exports = router;
