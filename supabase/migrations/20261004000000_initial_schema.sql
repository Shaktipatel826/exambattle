-- Supabase PostgreSQL Schema & Security Policies Migration
-- Migration Name: 20261004000000_initial_schema.sql

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==========================================
-- 1. SECURITY DEFINER HELPER FUNCTIONS
-- ==========================================
CREATE OR REPLACE FUNCTION public.is_admin() 
RETURNS BOOLEAN 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ==========================================
-- 2. TABLE DEFINITIONS
-- ==========================================

-- A. PROFILES (Strict Private Account Data)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    avatar TEXT DEFAULT '',
    role TEXT NOT NULL CHECK (role IN ('student', 'admin')) DEFAULT 'student',
    target_exams TEXT[] DEFAULT '{}',
    xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    streak INTEGER DEFAULT 1,
    last_active_at TIMESTAMPTZ DEFAULT NOW(),
    language TEXT DEFAULT 'en',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_profiles_xp ON public.profiles(xp DESC);

CREATE TRIGGER trg_profiles_updated_at 
BEFORE UPDATE ON public.profiles 
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- B. LEADERBOARD SAFE PUBLIC VIEW (Non-sensitive display fields only)
CREATE OR REPLACE VIEW public.leaderboard_view AS
SELECT 
    id,
    name,
    avatar,
    xp,
    level,
    streak,
    target_exams[1] AS primary_target_exam
FROM public.profiles
ORDER BY xp DESC;

GRANT SELECT ON public.leaderboard_view TO authenticated;

-- C. SUBJECTS & TAXONOMY
CREATE TABLE public.subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    icon TEXT DEFAULT 'BookOpen',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.sub_subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
    sub_subject_id UUID REFERENCES public.sub_subjects(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    category TEXT CHECK (category IN ('SSC', 'Railway', 'Banking', 'UP State', 'Other')),
    description TEXT DEFAULT '',
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- D. QUESTION BANK
CREATE TABLE public.questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question TEXT NOT NULL,
    options TEXT[] NOT NULL CHECK (array_length(options, 1) = 4),
    correct_answer INTEGER NOT NULL CHECK (correct_answer BETWEEN 0 AND 3),
    explanation TEXT DEFAULT '',
    subject TEXT NOT NULL,
    sub_subject TEXT DEFAULT '',
    topic TEXT NOT NULL,
    exam TEXT DEFAULT 'General',
    exam_year INTEGER,
    exam_shift TEXT DEFAULT '',
    difficulty TEXT CHECK (difficulty IN ('Easy', 'Medium', 'Hard')) DEFAULT 'Medium',
    language TEXT CHECK (language IN ('en', 'hi', 'bilingual')) DEFAULT 'en',
    source TEXT DEFAULT 'Question Bank',
    source_type TEXT CHECK (source_type IN ('ADMIN_CREATED', 'VERIFIED_PYQ', 'IMPORTED', 'AI_GENERATED', 'SOURCE_TRANSCRIPT', 'CURRENT_AFFAIRS', 'STUDENT_PERSONAL')) DEFAULT 'ADMIN_CREATED',
    source_reference TEXT DEFAULT '',
    tags TEXT[] DEFAULT '{}',
    verified BOOLEAN DEFAULT FALSE,
    status TEXT CHECK (status IN ('PUBLISHED', 'PENDING_REVIEW', 'REJECTED', 'DRAFT')) DEFAULT 'PUBLISHED',
    created_by TEXT DEFAULT 'System',
    duplicate_flag BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_questions_lookup ON public.questions(subject, topic, exam, status);

-- E. AI STUDY PACKS (Private to Student)
CREATE TABLE public.study_packs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    file_name TEXT DEFAULT '',
    file_type TEXT DEFAULT 'TXT',
    source_type TEXT DEFAULT 'SOURCE_BASED',
    raw_content TEXT DEFAULT '',
    short_notes JSONB DEFAULT '[]'::jsonb,
    one_liners JSONB DEFAULT '[]'::jsonb,
    key_concepts JSONB DEFAULT '[]'::jsonb,
    important_points JSONB DEFAULT '[]'::jsonb,
    common_confusions JSONB DEFAULT '[]'::jsonb,
    new_mcqs JSONB DEFAULT '[]'::jsonb,
    revision_questions JSONB DEFAULT '[]'::jsonb,
    processing_status TEXT DEFAULT 'COMPLETED',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- F. STUDENT TEST ATTEMPTS & ANSWERS (Strictly Private)
CREATE TABLE public.attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    user_name TEXT NOT NULL,
    test_type TEXT CHECK (test_type IN ('SOLO', 'MOCK', 'BATTLE', 'REVISION', 'PYQ', 'WEAK_TOPIC')),
    subject TEXT NOT NULL,
    topic TEXT DEFAULT 'Mixed',
    exam TEXT DEFAULT 'General',
    room_id UUID,
    total_questions INTEGER NOT NULL,
    correct_count INTEGER NOT NULL,
    wrong_count INTEGER NOT NULL,
    unattempted_count INTEGER NOT NULL,
    score NUMERIC(6,2) NOT NULL,
    negative_marks NUMERIC(6,2) DEFAULT 0,
    accuracy NUMERIC(5,2) NOT NULL,
    time_taken_seconds INTEGER NOT NULL,
    answers JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- G. WRONG QUESTION NOTEBOOK (Strictly Private)
CREATE TABLE public.mistakes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    topic TEXT NOT NULL,
    wrong_count INTEGER DEFAULT 1,
    correct_streak INTEGER DEFAULT 0,
    last_attempted_at TIMESTAMPTZ DEFAULT NOW(),
    next_revision_at TIMESTAMPTZ DEFAULT NOW(),
    interval_days INTEGER DEFAULT 1,
    mastered BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- H. MULTIPLAYER BATTLE ROOMS & PLAYERS
CREATE TABLE public.rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_code TEXT UNIQUE NOT NULL,
    host_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    topic TEXT DEFAULT 'General',
    question_count INTEGER DEFAULT 10,
    time_limit_minutes INTEGER DEFAULT 5,
    negative_marking NUMERIC(4,2) DEFAULT 0.25,
    difficulty TEXT DEFAULT 'Medium',
    status TEXT CHECK (status IN ('LOBBY', 'IN_PROGRESS', 'FINISHED')) DEFAULT 'LOBBY',
    questions JSONB NOT NULL,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.room_players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    user_name TEXT NOT NULL,
    is_ready BOOLEAN DEFAULT TRUE,
    submitted_answers JSONB DEFAULT '{}'::jsonb,
    score NUMERIC(6,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(room_id, user_id)
);

-- I. QUESTION REPORTS (Escalations)
CREATE TABLE public.reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    comments TEXT DEFAULT '',
    status TEXT CHECK (status IN ('PENDING', 'RESOLVED', 'DISMISSED')) DEFAULT 'PENDING',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 3. ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sub_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mistakes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- A. PROFILES POLICIES (Strict Private Access for own row + Admin Override)
CREATE POLICY "Students can read own profile" 
ON public.profiles FOR SELECT 
TO authenticated 
USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "Students can update own profile except role" 
ON public.profiles FOR UPDATE 
TO authenticated 
USING (auth.uid() = id) 
WITH CHECK (
    auth.uid() = id 
    AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
);

-- B. TAXONOMY & QUESTIONS POLICIES (Public Read for published content)
CREATE POLICY "Read published questions" 
ON public.questions FOR SELECT 
TO authenticated 
USING (status = 'PUBLISHED' OR public.is_admin());

CREATE POLICY "Admin write questions" 
ON public.questions FOR ALL 
TO authenticated 
USING (public.is_admin());

CREATE POLICY "Public read subjects" ON public.subjects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Public read sub_subjects" ON public.sub_subjects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Public read topics" ON public.topics FOR SELECT TO authenticated USING (true);
CREATE POLICY "Public read exams" ON public.exams FOR SELECT TO authenticated USING (true);

-- C. PRIVATE STUDENT DATA POLICIES (Study Packs, Attempts, Mistakes)
CREATE POLICY "Own study packs select" ON public.study_packs FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "Own study packs insert" ON public.study_packs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Own study packs delete" ON public.study_packs FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Own attempts select" ON public.attempts FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "Own attempts insert" ON public.attempts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Own mistakes select" ON public.mistakes FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "Own mistakes write" ON public.mistakes FOR ALL TO authenticated USING (user_id = auth.uid());

-- D. MULTIPLAYER SECURITY POLICIES
CREATE POLICY "View joined room metadata" 
ON public.rooms FOR SELECT 
TO authenticated 
USING (
    EXISTS (SELECT 1 FROM public.room_players WHERE room_id = id AND user_id = auth.uid())
    OR host_id = auth.uid()
    OR public.is_admin()
);

CREATE POLICY "Host create or update room" 
ON public.rooms FOR ALL 
TO authenticated 
USING (host_id = auth.uid() OR public.is_admin());

CREATE POLICY "Players view room participants" 
ON public.room_players FOR SELECT 
TO authenticated 
USING (
    EXISTS (SELECT 1 FROM public.room_players rp WHERE rp.room_id = room_id AND rp.user_id = auth.uid())
    OR public.is_admin()
);

CREATE POLICY "Players insert or update own room player record" 
ON public.room_players FOR ALL 
TO authenticated 
USING (user_id = auth.uid() OR public.is_admin())
WITH CHECK (user_id = auth.uid() OR public.is_admin());

-- E. REPORTS POLICIES
CREATE POLICY "Students insert report" ON public.reports FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Students view own reports" ON public.reports FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "Admin manage reports" ON public.reports FOR ALL TO authenticated USING (public.is_admin());
