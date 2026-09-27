const express = require('express');
const { query } = require('../config/db');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

router.get('/specialities', asyncHandler(async (req, res) => {
  // Return only safe fields for ACTIVE specialities
  const { rows } = await query(`
    SELECT speciality_id, speciality_name, department_description 
    FROM specialities 
    WHERE status = 'ACTIVE' 
    ORDER BY speciality_name ASC
  `);
  res.json({ success: true, data: rows });
}));

router.get('/doctors', asyncHandler(async (req, res) => {
  // Return only safe showcase fields for ACTIVE doctors
  // Do NOT return mobile, email, consultation_fee, etc.
  const { rows } = await query(`
    SELECT d.doctor_name, d.qualification, d.experience_years, d.speciality_id, s.speciality_name 
    FROM doctors d
    JOIN specialities s ON s.speciality_id = d.speciality_id
    WHERE d.status = 'ACTIVE' AND s.status = 'ACTIVE'
    ORDER BY d.doctor_name ASC
  `);
  res.json({ success: true, data: rows });
}));

module.exports = router;
