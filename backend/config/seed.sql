-- SurakshaAI – Seed Data

-- Insert System Settings
INSERT INTO system_settings (key, value, description) VALUES
('app_name', 'SurakshaAI Portal', 'Application Title'),
('maintenance_mode', 'false', 'Prevents client interactions when true'),
('max_file_size_bytes', '10485760', 'Max upload limit per file: 10MB');

-- Insert Sample Profiles (User, Admin)
-- Use static raw UUID strings for demo mappings
INSERT INTO profiles (id, email, full_name, gender, phone, role) VALUES
('b23dfda4-25e4-4d8e-9c76-d98c25345710', 'admin@suraksha.gov.in', 'Inspector Shreya Sharma', 'female', '+911122334455', 'admin'),
('c34efea5-36f5-5e9f-ad87-ea9d36456821', 'priya.sharma@gmail.com', 'Priya Sharma', 'female', '+919988776655', 'user'),
('d45f0fb6-47a6-6fa0-be98-fb0e47567932', 'rahul.kumar@gmail.com', 'Rahul Kumar', 'male', '+918877665544', 'user');

-- Insert Admin User Profiles Mappings
INSERT INTO admin_users (profile_id, badge_number, department) VALUES
('b23dfda4-25e4-4d8e-9c76-d98c25345710', 'SH-4091', 'Women Cell, Zone-1');

-- Insert Sample Incident Reports
INSERT INTO reports (
    id, case_id, reporter_id, incident_type, victim_type, description, 
    incident_date, incident_time, location_name, latitude, longitude, 
    is_anonymous, is_draft, status, priority, ai_risk_level, ai_summary
) VALUES
(
    'e5601fc7-58b7-7ab1-cf09-0c1f58678043',
    'WCS-2026-000001',
    'c34efea5-36f5-5e9f-ad87-ea9d36456821',
    'Domestic Violence',
    'Women',
    'Consistent harassment and physical threats by husband for the last 3 months.',
    '2026-07-04',
    '21:30:00',
    'Rohini Sector 15, New Delhi',
    28.729124,
    77.121545,
    FALSE,
    FALSE,
    'submitted',
    'high',
    'high',
    'Report lists recurring spousal physical threats and harassment. Evaluated as High Risk.'
),
(
    'f67120d8-69c8-8bc2-df1a-1d2f69789154',
    'WCS-2026-000002',
    NULL,
    'Kidnapping',
    'Child',
    'Saw a young child being dragged into a black SUV near Sector 5 market square.',
    '2026-07-05',
    '11:15:00',
    'Sector 5 Market Square, Noida',
    28.582451,
    77.324541,
    TRUE,
    FALSE,
    'submitted',
    'critical',
    'critical',
    'Anonymous witness reports active kidnapping incident involving a child and black SUV. Action required immediately.'
);

-- Insert Sample Attachments
INSERT INTO report_attachments (report_id, file_path, file_size, file_type) VALUES
('e5601fc7-58b7-7ab1-cf09-0c1f58678043', 'uploads/incidents/domestic_violence_proof.pdf', 2450000, 'pdf');

-- Insert Sample Emergency Alerts (SOS panic triggers)
INSERT INTO emergency_alerts (user_id, latitude, longitude, status, notes) VALUES
('c34efea5-36f5-5e9f-ad87-ea9d36456821', 28.729124, 77.121545, 'triggered', 'Active panic button alert pressed from portal client.');
