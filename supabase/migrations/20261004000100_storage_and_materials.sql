-- Supabase Migration: 20261004000100_storage_and_materials.sql
-- Storage Buckets Metadata & Admin Study Materials Pipeline

-- 1. Create study_materials Table
CREATE TABLE IF NOT EXISTS public.study_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    uploaded_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    uploader_name TEXT NOT NULL DEFAULT 'Admin',
    file_name TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    file_type TEXT NOT NULL,
    subject TEXT NOT NULL DEFAULT 'General Studies',
    topic TEXT NOT NULL DEFAULT 'General',
    exam TEXT DEFAULT 'General',
    extracted_text TEXT DEFAULT '',
    char_count INTEGER DEFAULT 0,
    processing_status TEXT CHECK (processing_status IN ('QUEUED', 'EXTRACTING', 'PROCESSED', 'FAILED')) DEFAULT 'QUEUED',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_study_materials_uploader ON public.study_materials(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_study_materials_lookup ON public.study_materials(subject, topic, processing_status);

-- 2. Enable RLS on study_materials
ALTER TABLE public.study_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full manage study materials" 
ON public.study_materials FOR ALL 
TO authenticated 
USING (public.is_admin()) 
WITH CHECK (public.is_admin());

CREATE POLICY "Students view own uploaded study materials" 
ON public.study_materials FOR SELECT 
TO authenticated 
USING (uploaded_by = auth.uid());

-- 3. Configure Storage Bucket Policies for 'study-materials' bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'study-materials', 
    'study-materials', 
    false, 
    26214400, -- 25MB Max
    ARRAY['text/plain', 'text/csv', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/json']
)
ON CONFLICT (id) DO UPDATE SET 
    public = false,
    file_size_limit = 26214400;

-- Storage RLS Policies
CREATE POLICY "Admin upload study materials storage" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'study-materials' AND public.is_admin());

CREATE POLICY "Admin read study materials storage" 
ON storage.objects FOR SELECT 
TO authenticated 
USING (bucket_id = 'study-materials' AND public.is_admin());

CREATE POLICY "Admin delete study materials storage" 
ON storage.objects FOR DELETE 
TO authenticated 
USING (bucket_id = 'study-materials' AND public.is_admin());
