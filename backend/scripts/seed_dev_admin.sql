-- Dev helper: one admin user + department so POST /events works with X-User-Id.
-- Run after migrations: psql "$DATABASE_URL" -f scripts/seed_dev_admin.sql

BEGIN;

INSERT INTO departments (department_id, department_name, parent_department_id, manager_id)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'HQ',
  NULL,
  NULL
)
ON CONFLICT (department_id) DO NOTHING;

INSERT INTO users (user_id, employee_no, name, email, phone, department_id, status)
VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'ADMIN001',
  'Dev Admin',
  'admin@example.com',
  NULL,
  '11111111-1111-1111-1111-111111111111',
  'active'
)
ON CONFLICT (user_id) DO NOTHING;

UPDATE departments
SET manager_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
WHERE department_id = '11111111-1111-1111-1111-111111111111';

INSERT INTO user_roles (user_id, role_id)
SELECT 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', r.role_id
FROM roles r
WHERE r.role_name = 'admin'
ON CONFLICT DO NOTHING;

COMMIT;
