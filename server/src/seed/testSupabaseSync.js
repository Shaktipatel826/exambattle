import { supabaseAdmin, supabaseServer } from '../lib/supabaseServer.js';

export const testSupabaseConnectionAndSync = async () => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKeyPresent = !!process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || supabaseUrl.trim().length === 0 || !serviceKeyPresent) {
    return {
      connected: false,
      message: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing in server/.env',
      studentSync: false,
      adminSync: false
    };
  }

  try {
    // 1. Verify Supabase connection by testing table presence
    const { data: pingData, error: pingErr } = await supabaseAdmin
      .from('profiles')
      .select('count', { count: 'exact', head: true });

    if (pingErr && !pingErr.message.includes('relation "public.profiles" does not exist')) {
      return {
        connected: false,
        message: `Supabase Connection Failed: ${pingErr.message}`,
        studentSync: false,
        adminSync: false
      };
    }

    // 2. Test Student Profile Sync (student@shakti.com)
    let studentSync = false;
    try {
      const { error: stErr } = await supabaseAdmin.from('profiles').upsert({
        name: 'Shakti Student',
        email: 'student@shakti.com',
        role: 'student',
        target_exams: ['SSC CGL', 'UP Police'],
        xp: 650,
        level: 2,
        streak: 7,
        last_active_at: new Date()
      }, { onConflict: 'email' });

      if (!stErr) studentSync = true;
    } catch (e) {
      studentSync = false;
    }

    // 3. Test Admin Profile Sync (admin@shakti.com)
    let adminSync = false;
    try {
      const { error: adErr } = await supabaseAdmin.from('profiles').upsert({
        name: 'Super Admin',
        email: 'admin@shakti.com',
        role: 'admin',
        target_exams: ['SSC CGL', 'UPSI'],
        xp: 1500,
        level: 4,
        last_active_at: new Date()
      }, { onConflict: 'email' });

      if (!adErr) adminSync = true;
    } catch (e) {
      adminSync = false;
    }

    return {
      connected: true,
      message: 'Successfully connected to Supabase PostgreSQL project.',
      studentSync,
      adminSync
    };
  } catch (err) {
    return {
      connected: false,
      message: `Supabase Error: ${err.message}`,
      studentSync: false,
      adminSync: false
    };
  }
};
