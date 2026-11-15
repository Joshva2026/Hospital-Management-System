CREATE TABLE IF NOT EXISTS hospital_info (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO hospital_info (key, value) VALUES
  ('visiting_hours',   'TO BE UPDATED'),
  ('opd_timings',      'TO BE UPDATED'),
  ('emergency_number', 'TO BE UPDATED'),
  ('address',          'TO BE UPDATED'),
  ('phone',            'TO BE UPDATED'),
  ('departments',      'TO BE UPDATED')
ON CONFLICT (key) DO NOTHING;
