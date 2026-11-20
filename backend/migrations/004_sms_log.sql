-- SMS messages are logged here. In LOG mode nothing is sent to a phone.
-- Only a masked mobile number is stored.
CREATE TABLE IF NOT EXISTS sms_log (
    sms_id         SERIAL PRIMARY KEY,
    mobile_masked  VARCHAR(20) NOT NULL,
    message        TEXT NOT NULL,
    mode           VARCHAR(10) NOT NULL DEFAULT 'LOG',
    status         VARCHAR(20) NOT NULL DEFAULT 'LOGGED',
    created_at     TIMESTAMP NOT NULL DEFAULT NOW()
);
