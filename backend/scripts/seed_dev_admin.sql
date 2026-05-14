-- Dev helper: minimal admin row aligned with ids.user_key(1) / ids.dept_key(1).
-- Prefer `python scripts/dev_reseed_demo.py` for full seed + correct password hash.

BEGIN;

INSERT INTO departments (department_id, department_name, parent_department_id, manager_id)
VALUES (
  '01000000-0000-4000-8000-000000000001',
  '總公司',
  NULL,
  NULL
)
ON CONFLICT (department_id) DO NOTHING;

INSERT INTO users (user_id, employee_no, name, email, phone, status, password_hash)
VALUES (
  '02000000-0000-4000-8000-000000000001',
  'ADM001',
  'Dev Admin',
  'admin@test.com',
  NULL,
  'active',
  $pass$pbkdf2_sha256$100000$9c09bd5d1502dddf0576680ef86254bb$2ffff291c4ee9dd13750096da892f99f791a7e36ef1a41e6671c8ac96abfdcb2$pass$
)
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO user_departments (user_department_id, user_id, department_id, is_primary)
VALUES (
  '05000000-0000-4000-8000-000000000001',
  '02000000-0000-4000-8000-000000000001',
  '01000000-0000-4000-8000-000000000001',
  true
)
ON CONFLICT (user_id, department_id) DO NOTHING;

UPDATE departments
SET manager_id = '02000000-0000-4000-8000-000000000001'
WHERE department_id = '01000000-0000-4000-8000-000000000001';

INSERT INTO user_roles (user_id, role_id)
SELECT '02000000-0000-4000-8000-000000000001', r.role_id
FROM roles r
WHERE r.role_name = 'admin'
ON CONFLICT DO NOTHING;

COMMIT;
