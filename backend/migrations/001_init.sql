-- ============================================================================
-- Hospital Management System - Initial Schema
-- Database: PostgreSQL 13+
-- Run with: npm run migrate
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- Sequence-backed ID generators (safe under concurrency, survive restarts)
-- We use dedicated sequence tables rather than app-side counters so that
-- "SELECT nextval()" is atomic at the database level.
-- ----------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS patient_id_seq START 1;
CREATE SEQUENCE IF NOT EXISTS visit_id_seq START 1;
CREATE SEQUENCE IF NOT EXISTS admission_id_seq START 1;
CREATE SEQUENCE IF NOT EXISTS report_id_seq START 1;
CREATE SEQUENCE IF NOT EXISTS discharge_id_seq START 1;
CREATE SEQUENCE IF NOT EXISTS appointment_id_seq START 1;
CREATE SEQUENCE IF NOT EXISTS doctor_id_seq START 1;
CREATE SEQUENCE IF NOT EXISTS log_id_seq START 1;

-- ----------------------------------------------------------------------------
-- admins
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admins (
    admin_id        VARCHAR(20) PRIMARY KEY,
    full_name       VARCHAR(150) NOT NULL,
    email           VARCHAR(150) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    role            VARCHAR(20) NOT NULL DEFAULT 'ADMIN' CHECK (role IN ('SUPER_ADMIN','ADMIN')),
    status          VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
    failed_login_attempts INT NOT NULL DEFAULT 0,
    locked_until    TIMESTAMP NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- specialities
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS specialities (
    speciality_id           VARCHAR(20) PRIMARY KEY,
    speciality_name         VARCHAR(150) NOT NULL UNIQUE,
    department_description  TEXT,
    status                  VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
    created_at              TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- doctors
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS doctors (
    doctor_id           VARCHAR(20) PRIMARY KEY,
    doctor_name         VARCHAR(150) NOT NULL,
    speciality_id       VARCHAR(20) NOT NULL REFERENCES specialities(speciality_id) ON DELETE RESTRICT,
    qualification       VARCHAR(200),
    experience_years    INT DEFAULT 0 CHECK (experience_years >= 0),
    mobile              VARCHAR(20) NOT NULL,
    email               VARCHAR(150) UNIQUE,
    consultation_fee    NUMERIC(10,2) DEFAULT 0,
    available_days      VARCHAR(100),
    available_from      TIME,
    available_to        TIME,
    status              VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
    created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_doctors_speciality ON doctors(speciality_id);

-- ----------------------------------------------------------------------------
-- wards
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wards (
    ward_id      VARCHAR(20) PRIMARY KEY,
    ward_name    VARCHAR(150) NOT NULL,
    ward_type    VARCHAR(50) NOT NULL,
    floor        INT,
    total_beds   INT NOT NULL DEFAULT 0,
    status       VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
    created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- beds  (current_patient_id kept in sync only via transactions in application code)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS beds (
    bed_id              VARCHAR(20) PRIMARY KEY,
    ward_id             VARCHAR(20) NOT NULL REFERENCES wards(ward_id) ON DELETE RESTRICT,
    bed_number          VARCHAR(20) NOT NULL,
    bed_type            VARCHAR(50) DEFAULT 'General',
    status              VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE','OCCUPIED','MAINTENANCE')),
    current_patient_id  VARCHAR(20) NULL,
    last_updated        TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(ward_id, bed_number)
);
CREATE INDEX IF NOT EXISTS idx_beds_ward ON beds(ward_id);
CREATE INDEX IF NOT EXISTS idx_beds_status ON beds(status);

-- ----------------------------------------------------------------------------
-- patients
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS patients (
    patient_id          VARCHAR(20) PRIMARY KEY,
    full_name           VARCHAR(150) NOT NULL,
    mobile              VARCHAR(20) NOT NULL,
    gender              VARCHAR(20) NOT NULL CHECK (gender IN ('Male','Female','Other')),
    date_of_birth       DATE,
    address             TEXT,
    blood_group         VARCHAR(5),
    emergency_contact   VARCHAR(20),
    problem             TEXT,
    reason_for_visit    TEXT,
    patient_type        VARCHAR(20) NOT NULL DEFAULT 'OPD' CHECK (patient_type IN ('OPD','EMERGENCY','ADMITTED','DISCHARGED')),
    registration_date   DATE NOT NULL DEFAULT CURRENT_DATE,
    registration_time   TIME NOT NULL DEFAULT CURRENT_TIME,
    status              VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','ADMITTED','DISCHARGED','INACTIVE')),
    created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_patients_mobile ON patients(mobile);
CREATE INDEX IF NOT EXISTS idx_patients_name ON patients(full_name);
CREATE INDEX IF NOT EXISTS idx_patients_status ON patients(status);
CREATE INDEX IF NOT EXISTS idx_patients_reg_date ON patients(registration_date);

-- ----------------------------------------------------------------------------
-- patient_visits (OPD)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS patient_visits (
    visit_id       VARCHAR(20) PRIMARY KEY,
    patient_id     VARCHAR(20) NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
    doctor_id      VARCHAR(20) NOT NULL REFERENCES doctors(doctor_id) ON DELETE RESTRICT,
    speciality_id  VARCHAR(20) NOT NULL REFERENCES specialities(speciality_id) ON DELETE RESTRICT,
    visit_date     DATE NOT NULL,
    visit_time     TIME NOT NULL,
    visit_type     VARCHAR(20) NOT NULL DEFAULT 'OPD',
    complaint      TEXT,
    diagnosis      TEXT,
    treatment      TEXT,
    status         VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED','IN_PROGRESS','COMPLETED','CANCELLED')),
    notes          TEXT,
    created_at     TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_visits_patient ON patient_visits(patient_id);
CREATE INDEX IF NOT EXISTS idx_visits_doctor ON patient_visits(doctor_id);
CREATE INDEX IF NOT EXISTS idx_visits_date ON patient_visits(visit_date);

-- ----------------------------------------------------------------------------
-- admissions
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admissions (
    admission_id       VARCHAR(20) PRIMARY KEY,
    patient_id         VARCHAR(20) NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
    doctor_id          VARCHAR(20) NOT NULL REFERENCES doctors(doctor_id) ON DELETE RESTRICT,
    speciality_id      VARCHAR(20) NOT NULL REFERENCES specialities(speciality_id) ON DELETE RESTRICT,
    ward_id            VARCHAR(20) NOT NULL REFERENCES wards(ward_id) ON DELETE RESTRICT,
    bed_id             VARCHAR(20) NOT NULL REFERENCES beds(bed_id) ON DELETE RESTRICT,
    admission_date     DATE NOT NULL,
    admission_time     TIME NOT NULL,
    discharge_date     DATE NULL,
    discharge_time     TIME NULL,
    admission_reason   TEXT,
    initial_condition  TEXT,
    status             VARCHAR(20) NOT NULL DEFAULT 'ADMITTED' CHECK (status IN ('ADMITTED','DISCHARGED')),
    created_at         TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_admissions_patient ON admissions(patient_id);
CREATE INDEX IF NOT EXISTS idx_admissions_bed ON admissions(bed_id);
CREATE INDEX IF NOT EXISTS idx_admissions_status ON admissions(status);
-- A bed can have at most one ACTIVE (ADMITTED) admission at a time.
CREATE UNIQUE INDEX IF NOT EXISTS uq_one_active_admission_per_bed
    ON admissions(bed_id) WHERE status = 'ADMITTED';
-- A patient can have at most one ACTIVE admission at a time.
CREATE UNIQUE INDEX IF NOT EXISTS uq_one_active_admission_per_patient
    ON admissions(patient_id) WHERE status = 'ADMITTED';

-- ----------------------------------------------------------------------------
-- daily_patient_reports
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS daily_patient_reports (
    report_id          VARCHAR(20) PRIMARY KEY,
    admission_id       VARCHAR(20) NOT NULL REFERENCES admissions(admission_id) ON DELETE CASCADE,
    patient_id         VARCHAR(20) NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
    report_date        DATE NOT NULL,
    report_time        TIME NOT NULL DEFAULT CURRENT_TIME,
    day_number         INT NOT NULL,
    temperature        NUMERIC(4,1),
    blood_pressure     VARCHAR(20),
    pulse_rate         INT,
    spo2               INT,
    patient_condition  VARCHAR(50),
    symptoms           TEXT,
    treatment_given    TEXT,
    doctor_notes       TEXT,
    next_plan          TEXT,
    created_at         TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMP NOT NULL DEFAULT NOW(),
    -- CRITICAL: prevents duplicate report for same admission + same date
    UNIQUE (admission_id, report_date)
);
CREATE INDEX IF NOT EXISTS idx_reports_admission ON daily_patient_reports(admission_id);
CREATE INDEX IF NOT EXISTS idx_reports_patient ON daily_patient_reports(patient_id);

-- ----------------------------------------------------------------------------
-- discharges
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS discharges (
    discharge_id       VARCHAR(20) PRIMARY KEY,
    admission_id       VARCHAR(20) NOT NULL UNIQUE REFERENCES admissions(admission_id) ON DELETE CASCADE,
    patient_id         VARCHAR(20) NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
    discharge_date     DATE NOT NULL,
    discharge_time     TIME NOT NULL,
    discharge_type     VARCHAR(50) NOT NULL DEFAULT 'Normal Discharge',
    final_diagnosis    TEXT,
    treatment_summary  TEXT,
    doctor_advice      TEXT,
    follow_up_date     DATE NULL,
    status             VARCHAR(20) NOT NULL DEFAULT 'FINALIZED' CHECK (status IN ('FINALIZED')),
    created_at         TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_discharges_patient ON discharges(patient_id);

-- ----------------------------------------------------------------------------
-- appointments
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS appointments (
    appointment_id     VARCHAR(20) PRIMARY KEY,
    patient_id         VARCHAR(20) NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
    doctor_id          VARCHAR(20) NOT NULL REFERENCES doctors(doctor_id) ON DELETE RESTRICT,
    speciality_id      VARCHAR(20) NOT NULL REFERENCES specialities(speciality_id) ON DELETE RESTRICT,
    appointment_date   DATE NOT NULL,
    appointment_time   TIME NOT NULL,
    appointment_type   VARCHAR(30) NOT NULL DEFAULT 'CONSULTATION',
    reason             TEXT,
    status             VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED','COMPLETED','CANCELLED','NO_SHOW')),
    created_at         TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_appt_patient ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appt_doctor_date ON appointments(doctor_id, appointment_date);
-- Prevent an obvious doctor/time double-book among active (non-cancelled) appointments.
CREATE UNIQUE INDEX IF NOT EXISTS uq_doctor_slot_active
    ON appointments(doctor_id, appointment_date, appointment_time)
    WHERE status IN ('SCHEDULED');

-- ----------------------------------------------------------------------------
-- audit_logs
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    log_id       VARCHAR(20) PRIMARY KEY,
    admin_id     VARCHAR(20) REFERENCES admins(admin_id) ON DELETE SET NULL,
    action       VARCHAR(50) NOT NULL,
    entity_type  VARCHAR(50),
    entity_id    VARCHAR(50),
    description  TEXT,
    created_at   TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_admin ON audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);

COMMIT;


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
