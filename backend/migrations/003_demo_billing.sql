-- DEMO billing only. Sample invoices for demonstration. No payments are taken.
CREATE SEQUENCE IF NOT EXISTS invoice_id_seq START 1;

CREATE TABLE IF NOT EXISTS invoices (
    invoice_id   VARCHAR(20) PRIMARY KEY,
    patient_id   VARCHAR(20) NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
    visit_id     VARCHAR(20) REFERENCES patient_visits(visit_id) ON DELETE SET NULL,
    total        NUMERIC(10,2) NOT NULL DEFAULT 0,
    status       VARCHAR(20) NOT NULL DEFAULT 'DEMO' CHECK (status IN ('DEMO')),
    note         TEXT,
    created_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoice_items (
    item_id      SERIAL PRIMARY KEY,
    invoice_id   VARCHAR(20) NOT NULL REFERENCES invoices(invoice_id) ON DELETE CASCADE,
    description  TEXT NOT NULL,
    qty          INT NOT NULL DEFAULT 1 CHECK (qty > 0),
    rate         NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (rate >= 0),
    amount       NUMERIC(10,2) NOT NULL DEFAULT 0
);
