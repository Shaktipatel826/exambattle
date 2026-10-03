import express from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { generateToken, authMiddleware } from '../middleware/auth.js';
import { supabaseAdmin } from '../lib/supabaseServer.js';

const router = express.Router();

// Register Student or Admin with Supabase Profile Sync
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, targetExams, role } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required.' });
    }

    const emailLower = email.toLowerCase().trim();

    // Check existing fallback DB user
    const existing = await User.findOne({ email: emailLower });
    if (existing) {
      return res.status(400).json({ success: false, message: 'An account with this email already exists.' });
    }

    const userRole = role === 'ADMIN' ? 'ADMIN' : 'STUDENT';
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user in primary application database
    const newUser = await User.create({
      name: name.trim(),
      email: emailLower,
      password: hashedPassword,
      role: userRole,
      targetExams: targetExams || ['SSC CGL', 'UP Police'],
      xp: 100, // Welcome XP
      level: 1,
      streak: 1
    });

    // Sync profile to Supabase Auth & PostgreSQL `profiles` table if Supabase Admin API configured
    if (supabaseAdmin) {
      try {
        const { data: sbUser, error: sbErr } = await supabaseAdmin.auth.admin.createUser({
          email: emailLower,
          password: password,
          email_confirm: true,
          user_metadata: { name: name.trim(), role: userRole }
        });

        if (sbUser && sbUser.user) {
          await supabaseAdmin.from('profiles').upsert({
            id: sbUser.user.id,
            name: name.trim(),
            email: emailLower,
            role: userRole.toLowerCase(),
            target_exams: targetExams || ['SSC CGL', 'UP Police'],
            xp: 100,
            level: 1,
            streak: 1
          });
          console.log(`[Supabase Auth Sync] Registered user & profile created for ${emailLower} (${userRole})`);
        }
      } catch (sbEx) {
        console.warn(`[Supabase Auth Sync Notice] ${sbEx.message}`);
      }
    }

    const token = generateToken(newUser);

    return res.status(201).json({
      success: true,
      message: 'Registration successful!',
      token,
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        targetExams: newUser.targetExams,
        xp: newUser.xp,
        level: newUser.level,
        streak: newUser.streak
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// Login Student or Admin
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const emailLower = email.toLowerCase().trim();

    const user = await User.findOne({ email: emailLower });
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid email or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Invalid email or password.' });
    }

    // Sync profile state to Supabase if configured
    if (supabaseAdmin) {
      try {
        await supabaseAdmin.from('profiles').upsert({
          name: user.name,
          email: emailLower,
          role: user.role.toLowerCase(),
          target_exams: user.targetExams || [],
          xp: user.xp || 0,
          level: user.level || 1,
          streak: user.streak || 1,
          last_active_at: new Date()
        }, { onConflict: 'email' });
      } catch (sbEx) {
        // Non-blocking sync notice
      }
    }

    const token = generateToken(user);

    return res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        targetExams: user.targetExams,
        xp: user.xp,
        level: user.level,
        streak: user.streak,
        unlockedBadges: user.unlockedBadges
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// Get Current User Profile
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User profile not found.' });
    }
    return res.json({ success: true, user });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
