-- SurakshaAI – Women & Child Safety Portal
-- PostgreSQL Database Schema Setup for Supabase

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================================================================
-- 1. CREATE CUSTOM ENUM TYPES
-- =========================================================================

CREATE TYPE user_role AS ENUM ('user', 'admin', 'super_admin');
CREATE TYPE gender AS ENUM ('male', 'female', 'other', 'prefer_not_to_say');
CREATE TYPE incident_type AS ENUM (
  'Domestic Violence',
  'Kidnapping',
  'Child Abuse',
  'Cyber Crime',
  'Missing Child',
  'Threat',
  'Emergency',
  'Sexual Harassment',
  'Stalking',
  'Other'
);
CREATE TYPE victim_type AS ENUM ('Women', 'Child', 'Other');
CREATE TYPE report_status AS ENUM ('draft', 'submitted', 'under_review', 'assigned', 'in_progress', 'resolved', 'rejected', 'closed');
CREATE TYPE risk_level AS ENUM ('low', 'medium', 'high', 'critical', 'unknown');
CREATE TYPE priority_level AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE attachment_type AS ENUM ('image', 'audio', 'pdf');
CREATE TYPE notification_type AS ENUM ('alert', 'report_update', 'system_message');
CREATE TYPE emergency_status AS ENUM ('triggered', 'responding', 'resolved', 'cancelled');

-- =========================================================================
-- 2. CREATE SYSTEM FUNCTIONS & TRIGGERS
-- =========================================================================

-- Automatically update updated_at timestamp columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- =========================================================================
-- 3. CREATE TABLES
-- =========================================================================

-- profiles: User metadata table mapped to identity system
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(100),
    gender gender DEFAULT 'prefer_not_to_say',
    phone VARCHAR(20),
    role user_role DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TRIGGER update_profiles_updated_at 
BEFORE UPDATE ON profiles 
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();


-- otp_verifications: Handles custom passwordless email OTP sessions
CREATE TABLE otp_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL,
    otp_hash VARCHAR(255) NOT NULL,
    attempts INT DEFAULT 0 NOT NULL,
    max_attempts INT DEFAULT 3 NOT NULL,
    verified BOOLEAN DEFAULT FALSE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    CONSTRAINT chk_attempts CHECK (attempts <= max_attempts)
);


-- admin_users: Admin identity assignments
CREATE TABLE admin_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    badge_number VARCHAR(50) UNIQUE NOT NULL,
    department VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TRIGGER update_admin_users_updated_at 
BEFORE UPDATE ON admin_users 
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();


-- reports: Primary table storing safety incidents
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id VARCHAR(50) UNIQUE NOT NULL,
    reporter_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    incident_type incident_type NOT NULL,
    victim_type victim_type NOT NULL,
    description TEXT NOT NULL,
    incident_date DATE NOT NULL,
    incident_time TIME NOT NULL,
    location_name VARCHAR(255),
    latitude DECIMAL(9,6),
    longitude DECIMAL(9,6),
    is_anonymous BOOLEAN DEFAULT FALSE NOT NULL,
    is_draft BOOLEAN DEFAULT TRUE NOT NULL,
    status report_status DEFAULT 'draft' NOT NULL,
    priority priority_level DEFAULT 'low' NOT NULL,
    ai_summary TEXT,
    ai_risk_level risk_level DEFAULT 'unknown' NOT NULL,
    assigned_to UUID REFERENCES admin_users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMP WITH TIME ZONE,
    closed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    CONSTRAINT chk_anonymous_reporter CHECK (
        (is_anonymous IS TRUE AND reporter_id IS NULL) OR
        (is_anonymous IS FALSE AND reporter_id IS NOT NULL)
    ),
    CONSTRAINT chk_lat_range CHECK (latitude >= -90 AND latitude <= 90),
    CONSTRAINT chk_lng_range CHECK (longitude >= -180 AND longitude <= 180)
);

CREATE TRIGGER update_reports_updated_at 
BEFORE UPDATE ON reports 
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();


-- report_attachments: Links file attachments stored in Supabase Storage
CREATE TABLE report_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL, -- Supabase storage file path key
    file_size INT NOT NULL,  -- file size in bytes
    file_type attachment_type NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);


-- ai_conversations: Logs chat transcripts with the OpenAI assistant
CREATE TABLE ai_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE, -- NULL if anonymous visitor
    session_id UUID NOT NULL,
    role VARCHAR(10) NOT NULL CHECK (role IN ('user', 'assistant')),
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);


-- notifications: Dispatch logs for safety alerts and updates
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    type notification_type DEFAULT 'alert' NOT NULL,
    is_read BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);


-- emergency_alerts: Records instant panic triggers (SOS)
CREATE TABLE emergency_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    latitude DECIMAL(9,6) NOT NULL,
    longitude DECIMAL(9,6) NOT NULL,
    status emergency_status DEFAULT 'triggered' NOT NULL,
    triggered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    resolved_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    CONSTRAINT chk_alert_lat CHECK (latitude >= -90 AND latitude <= 90),
    CONSTRAINT chk_alert_lng CHECK (longitude >= -180 AND longitude <= 180)
);


-- system_settings: Portal-wide dynamic configurations
CREATE TABLE system_settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TRIGGER update_system_settings_updated_at 
BEFORE UPDATE ON system_settings 
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();


-- audit_logs: Administrative action history (for security tracking)
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    target_table VARCHAR(100) NOT NULL,
    target_row_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);


-- activity_logs: User interaction tracking
CREATE TABLE activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    action VARCHAR(150) NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);


-- refresh_tokens: Tracks active user sessions / devices
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE, -- SHA-256 hash is 64 hex characters
    device_info TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- =========================================================================
-- 4. CREATE PERFORMANCE OPTIMIZATION INDEXES
-- =========================================================================

-- Profiles Indexes
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_role ON profiles(role);

-- OTP Verifications Indexes
CREATE INDEX idx_otp_email ON otp_verifications(email);
CREATE INDEX idx_otp_created ON otp_verifications(created_at);

-- Reports Indexes
CREATE INDEX idx_reports_reporter ON reports(reporter_id);
CREATE INDEX idx_reports_type ON reports(incident_type);
CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_reports_priority ON reports(priority);
CREATE INDEX idx_reports_assigned ON reports(assigned_to);
CREATE INDEX idx_reports_is_draft ON reports(is_draft);
CREATE INDEX idx_reports_created ON reports(created_at);
-- Geospatial Index placeholder (in Postgres we can use GiST for geometric queries)
CREATE INDEX idx_reports_location ON reports(latitude, longitude);

-- AI Conversations Indexes
CREATE INDEX idx_ai_session ON ai_conversations(session_id);
CREATE INDEX idx_ai_user ON ai_conversations(user_id);

-- Notifications Indexes
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read);

-- Emergency Alerts Indexes
CREATE INDEX idx_emergency_status ON emergency_alerts(status);

-- Refresh Tokens Indexes
CREATE INDEX idx_refresh_token_hash ON refresh_tokens(token_hash);
CREATE INDEX idx_refresh_user ON refresh_tokens(user_id);

-- =========================================================================
-- 5. ENABLE ROW LEVEL SECURITY (RLS) POLICIES
-- =========================================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE otp_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;

-- 5* REFRESH TOKENS POLICY
CREATE POLICY select_own_refresh_tokens ON refresh_tokens
    FOR ALL
    USING (user_id = auth.uid());

-- 5a. PROFILES POLICIES
-- Users can view and update their own profile; Admins have full access.
CREATE POLICY select_own_profile ON profiles
    FOR SELECT
    USING (auth.uid() = id OR role = 'admin' OR role = 'super_admin');

CREATE POLICY update_own_profile ON profiles
    FOR UPDATE
    USING (auth.uid() = id OR role = 'admin' OR role = 'super_admin')
    WITH CHECK (auth.uid() = id OR role = 'admin' OR role = 'super_admin');

CREATE POLICY insert_profile ON profiles
    FOR INSERT
    WITH CHECK (TRUE);

-- 5b. REPORTS POLICIES
-- Users can read and write their own reports (if not anonymous). Anyone can file a report.
CREATE POLICY insert_any_report ON reports
    FOR INSERT
    WITH CHECK (TRUE); -- Allows guest/anonymous submissions and user creations

CREATE POLICY select_own_reports ON reports
    FOR SELECT
    USING (reporter_id = auth.uid() OR is_anonymous = TRUE OR EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    ));

CREATE POLICY update_own_drafts ON reports
    FOR UPDATE
    USING ((reporter_id = auth.uid() AND is_draft = TRUE) OR EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    ));

-- 5c. ATTACHMENTS POLICIES
CREATE POLICY select_related_attachments ON report_attachments
    FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM reports 
        WHERE reports.id = report_attachments.report_id 
        AND (reports.reporter_id = auth.uid() OR reports.is_anonymous = TRUE OR EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
        ))
    ));

CREATE POLICY insert_related_attachments ON report_attachments
    FOR INSERT
    WITH CHECK (TRUE); -- File uploads associated during ingestion

-- 5d. AI CONVERSATIONS POLICIES
-- Users can view their own chats. Session-level isolation handled in middleware.
CREATE POLICY select_own_ai_chat ON ai_conversations
    FOR SELECT
    USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY insert_own_ai_chat ON ai_conversations
    FOR INSERT
    WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- 5e. NOTIFICATIONS POLICIES
CREATE POLICY select_own_notifications ON notifications
    FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY update_own_notifications ON notifications
    FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- 5f. EMERGENCY ALERTS POLICIES
CREATE POLICY insert_sos_alert ON emergency_alerts
    FOR INSERT
    WITH CHECK (TRUE);

CREATE POLICY select_own_sos ON emergency_alerts
    FOR SELECT
    USING (user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    ));

-- 5g. AUDIT LOGS & SYSTEM LOGS POLICIES
-- Restricted entirely to Admin and Super Admin
CREATE POLICY admin_only_audit_logs ON audit_logs
    FOR ALL
    USING (EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    ));
