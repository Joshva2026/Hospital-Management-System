const express = require('express');
const { query, pool } = require('../config/db');
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
    SELECT d.doctor_id, d.doctor_name, d.qualification, d.experience_years, d.speciality_id, s.speciality_name 
    FROM doctors d
    JOIN specialities s ON s.speciality_id = d.speciality_id
    WHERE d.status = 'ACTIVE' AND s.status = 'ACTIVE'
    ORDER BY d.doctor_name ASC
  `);
  res.json({ success: true, data: rows });
}));

// ---------------------------------------------------------------------------
// ONLINE BOOKING (public, no login). Rate limited per IP.
// Returns only a booking reference. Never returns patient details.
// ---------------------------------------------------------------------------
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const { AppError } = require('../middleware/errorHandler');
const { nextId } = require('../utils/idGenerator');
const { sendSms } = require('../services/sms');

const bookingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many booking requests from this network. Please try again after 15 minutes.' },
});

const bookingValidators = [
  body('fullName').trim().isLength({ min: 2, max: 150 }).withMessage('Enter a valid full name.'),
  body('mobile').trim().matches(/^[6-9]\d{9}$/).withMessage('Enter a valid 10-digit mobile number.'),
  body('gender').isIn(['Male', 'Female', 'Other']).withMessage('Select a gender.'),
  body('doctorId').trim().notEmpty().withMessage('Select a doctor.'),
  body('appointmentDate').matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Select a valid date.'),
  body('appointmentTime').matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage('Select a valid time.'),
];

router.post(
  '/appointments',
  bookingLimiter,
  bookingValidators,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw new AppError(errors.array()[0].msg, 422);

    const { fullName, mobile, gender, doctorId, appointmentDate, appointmentTime } = req.body;
    const cleanName = fullName.trim();
    const cleanMobile = mobile.trim();

    const today = (await query("SELECT (NOW() AT TIME ZONE 'Asia/Kolkata')::date::text AS d")).rows[0].d;
    if (appointmentDate < today) throw new AppError('Choose today or a future date.', 422);

    const doc = await query(
      "SELECT doctor_id, speciality_id FROM doctors WHERE doctor_id = $1 AND status = 'ACTIVE'",
      [doctorId]
    );
    if (!doc.rows.length) throw new AppError('The selected doctor is not available.', 422);
    const speciality = doc.rows[0].speciality_id;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const taken = await client.query(
        `SELECT appointment_id FROM appointments
         WHERE doctor_id = $1 AND appointment_date = $2 AND appointment_time = $3 AND status = 'SCHEDULED'`,
        [doctorId, appointmentDate, appointmentTime]
      );
      if (taken.rows.length) throw new AppError('That time slot is already booked. Please choose another time.', 409);

      let patientId;
      const existing = await client.query(
        "SELECT patient_id FROM patients WHERE mobile = $1 AND status = 'ACTIVE' ORDER BY registration_date DESC LIMIT 1",
        [cleanMobile]
      );
      if (existing.rows.length) {
        patientId = existing.rows[0].patient_id;
      } else {
        patientId = await nextId('patient', client);
        await client.query(
          `INSERT INTO patients (patient_id, full_name, mobile, gender, patient_type, status)
           VALUES ($1, $2, $3, $4, 'OPD', 'ACTIVE')`,
          [patientId, cleanName, cleanMobile, gender]
        );
      }

      const appointmentId = await nextId('appointment', client);
      await client.query(
        `INSERT INTO appointments (appointment_id, patient_id, doctor_id, speciality_id, appointment_date, appointment_time, appointment_type, reason, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'CONSULTATION', 'Online booking', 'SCHEDULED')`,
        [appointmentId, patientId, doctorId, speciality, appointmentDate, appointmentTime]
      );

      await client.query('COMMIT');

      // Notification must never block or fail the booking.
      try {
        await sendSms(cleanMobile, `MARY Hospital: appointment request received for ${appointmentDate} ${appointmentTime}. Ref ${appointmentId}.`);
      } catch (smsErr) {
        console.warn('[SMS] notice not sent:', smsErr.message);
      }

      res.status(201).json({
        success: true,
        message: 'Your appointment request has been received.',
        data: { reference: appointmentId, appointmentDate, appointmentTime },
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  })
);

// ---------------------------------------------------------------------------
// PUBLIC QUEUE DISPLAY. Token numbers and doctor names only. No patient data.
// ---------------------------------------------------------------------------
router.get('/queue', asyncHandler(async (req, res) => {
  const today = (await query("SELECT (NOW() AT TIME ZONE 'Asia/Kolkata')::date::text AS d")).rows[0].d;
  const docs = await query("SELECT doctor_id, doctor_name FROM doctors WHERE status = 'ACTIVE' ORDER BY doctor_name");
  const tokens = await query(
    "SELECT doctor_id, token_no, status FROM opd_tokens WHERE token_date = $1 AND status IN ('CALLED','WAITING') ORDER BY token_no",
    [today]
  );
  const data = docs.rows
    .map((d) => {
      const mine = tokens.rows.filter((t) => t.doctor_id === d.doctor_id);
      const called = mine.find((t) => t.status === 'CALLED');
      return {
        doctor_name: d.doctor_name,
        now_serving: called ? called.token_no : null,
        waiting: mine.filter((t) => t.status === 'WAITING').slice(0, 5).map((t) => t.token_no),
      };
    })
    .filter((x) => x.now_serving !== null || x.waiting.length > 0);
  res.json({ success: true, date: today, data });
}));

module.exports = router;
