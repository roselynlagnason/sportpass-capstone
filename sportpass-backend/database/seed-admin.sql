-- Creates the first administrator account for a fresh database.
--   Email:    admin@sportpass.local
--   Password: ChangeMe@2026
-- Log in and change the password right away (Settings > Change Password).

INSERT INTO users (email, password, role)
SELECT 'admin@sportpass.local',
       '$2b$10$R/aMBPmfMC6pfk.BaCRhV.uAK.pxCP2v7lSSi9bVEz3xr6ktuvyny',
       'admin'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@sportpass.local');
