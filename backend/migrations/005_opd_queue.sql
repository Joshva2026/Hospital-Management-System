-- OPD token queue. One running number per doctor per day.
CREATE TABLE IF NOT EXISTS opd_tokens (
    token_id     SERIAL PRIMARY KEY,
    doctor_id    VARCHAR(20) NOT NULL REFERENCES doctors(doctor_id) ON DELETE CASCADE,
    token_date   DATE NOT NULL,
    token_no     INT NOT NULL CHECK (token_no > 0),
    patient_id   VARCHAR(20) REFERENCES patients(patient_id) ON DELETE SET NULL,
    status       VARCHAR(20) NOT NULL DEFAULT 'WAITING' CHECK (status IN ('WAITING','CALLED','DONE')),
    created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
    called_at    TIMESTAMP,
    CONSTRAINT opd_tokens_unique_no UNIQUE (doctor_id, token_date, token_no)
);
CREATE INDEX IF NOT EXISTS idx_opd_tokens_day ON opd_tokens (token_date, doctor_id, status);
