import { calculateLevelFromXP } from '../services/gamification.js';

const BASE_URL = 'http://localhost:5000/api';

async function runPhase8Tests() {
  console.log('=== Starting Phase 8 Gamification & Revision Verification Suite ===\n');

  try {
    // 1. Level Math Verification
    console.log('1. Verifying Level Progression Math...');
    const level0 = calculateLevelFromXP(0);
    const level1 = calculateLevelFromXP(150);
    const level2 = calculateLevelFromXP(500);
    const level5 = calculateLevelFromXP(2500);

    if (level0.level !== 1 || level1.level !== 1 || level2.level !== 2 || level5.level !== 6) {
      throw new Error(`Level calculation error: 0XP=${level0.level}, 150XP=${level1.level}, 500XP=${level2.level}, 2500XP=${level5.level}`);
    }
    console.log(`✔ Level calculation verified: 0 XP = Lvl ${level0.level}, 150 XP = Lvl ${level1.level}, 500 XP = Lvl ${level2.level}, 2500 XP = Lvl ${level5.level}`);

    // 2. Student Authentication
    console.log('\n2. Logging in Student (student@shakti.com)...');
    const studentLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'student@shakti.com', password: 'student123', role: 'STUDENT' })
    });
    const studentLogin = await studentLoginRes.json();
    if (!studentLogin.token) throw new Error('Student login failed: ' + JSON.stringify(studentLogin));
    const studentToken = studentLogin.token;
    console.log('✔ Student login successful.');

    // 3. Unauthenticated Access Protection
    console.log('\n3. Verifying Security: Unauthenticated access blocked on student endpoints...');
    const unauthRes = await fetch(`${BASE_URL}/student/dashboard`);
    if (unauthRes.status !== 401 && unauthRes.status !== 403) {
      throw new Error(`Security fail: expected 401/403 for unauth dashboard access, got ${unauthRes.status}`);
    }
    console.log('✔ Security verified: Unauthenticated request returned 401/403.');

    // 4. Student Dashboard Data Fetch
    console.log('\n4. Fetching Student Dashboard (`GET /api/student/dashboard`)...');
    const dashboardRes = await fetch(`${BASE_URL}/student/dashboard`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    const dashboard = await dashboardRes.json();
    if (!dashboard.success || !dashboard.dashboard) {
      throw new Error('Failed to fetch student dashboard: ' + JSON.stringify(dashboard));
    }
    const userStats = dashboard.dashboard.user;
    console.log(`✔ Student Dashboard fetched successfully.`);
    console.log(`   - Level: ${userStats.level} (XP: ${userStats.xp})`);
    console.log(`   - Streak: 🔥 ${userStats.streak} days`);
    console.log(`   - Coins: 🪙 ${userStats.coins}`);

    // 5. Fetch Daily Challenge Paper
    console.log('\n5. Fetching Daily Challenge (`GET /api/student/daily-challenge`)...');
    const challengeRes = await fetch(`${BASE_URL}/student/daily-challenge`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    const challengeData = await challengeRes.json();
    if (!challengeData.success || !challengeData.dailyChallenge) {
      throw new Error('Failed to fetch daily challenge: ' + JSON.stringify(challengeData));
    }
    const challenge = challengeData.dailyChallenge;
    console.log(`✔ Daily Challenge loaded: Date = ${challenge.dateStr}, Questions = ${challenge.questions.length}, Attempted = ${challenge.alreadyAttempted}`);

    // 6. Submit Daily Challenge Test (if not already completed today)
    if (!challenge.alreadyAttempted) {
      console.log('\n6. Submitting Daily Challenge test answers...');
      const sampleAnswers = challenge.questions.map((q, idx) => ({
        questionId: q._id,
        selectedOption: idx % 4
      }));

      const submitChallengeRes = await fetch(`${BASE_URL}/student/daily-challenge/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentToken}`
        },
        body: JSON.stringify({ answers: sampleAnswers })
      });
      const submitResult = await submitChallengeRes.json();
      if (!submitResult.success) {
        throw new Error('Daily challenge submission failed: ' + JSON.stringify(submitResult));
      }
      console.log(`✔ Daily Challenge submitted. Score: ${submitResult.result.score}/${submitResult.result.total}, XP Earned: +${submitResult.result.xpEarned}, Coins Earned: +${submitResult.result.coinsEarned}`);
    } else {
      console.log('\n6. Daily Challenge was already completed today.');
    }

    // 7. Verify Daily Challenge Idempotency (Cannot claim reward twice)
    console.log('\n7. Verifying Daily Challenge duplicate claim protection...');
    const sampleAnswersRetry = challenge.questions.map(q => ({ questionId: q._id, selectedOption: 0 }));
    const retrySubmitRes = await fetch(`${BASE_URL}/student/daily-challenge/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`
      },
      body: JSON.stringify({ answers: sampleAnswersRetry })
    });
    const retryResult = await retrySubmitRes.json();
    if (retrySubmitRes.status !== 400 || retryResult.success !== false) {
      throw new Error('Idempotency failure: allowed duplicate daily challenge submission!');
    }
    console.log('✔ Duplicate submission blocked: "Daily Challenge reward already claimed for today!"');

    // 8. Fetch Revision & Mistake Queue
    console.log('\n8. Fetching Spaced Revision Summary (`GET /api/student/revision`)...');
    const revisionRes = await fetch(`${BASE_URL}/student/revision`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    const revisionData = await revisionRes.json();
    if (!revisionData.success || !revisionData.revisionSummary) {
      throw new Error('Failed to fetch revision queue: ' + JSON.stringify(revisionData));
    }
    console.log(`✔ Spaced Revision Summary fetched: ${revisionData.revisionSummary.dueQuestions.length} items due, ${revisionData.revisionSummary.masteredCount} mastered.`);

    console.log('\n9. Fetching Mistake Book (`GET /api/student/mistakes`)...');
    const mistakeRes = await fetch(`${BASE_URL}/student/mistakes`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    const mistakeData = await mistakeRes.json();
    if (!mistakeData.success || !Array.isArray(mistakeData.mistakeBook)) {
      throw new Error('Failed to fetch mistake book: ' + JSON.stringify(mistakeData));
    }
    console.log(`✔ Mistake Book fetched: ${mistakeData.mistakeBook.length} incorrect questions stored for remediation.`);

    // 10. Fetch Weak Topic Analysis
    console.log('\n10. Fetching Weak Topics with Sample Size Guard (`GET /api/student/weak-topics`)...');
    const weakRes = await fetch(`${BASE_URL}/student/weak-topics`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    const weakData = await weakRes.json();
    if (!weakData.success || !Array.isArray(weakData.topicAnalysis)) {
      throw new Error('Failed to fetch weak topics: ' + JSON.stringify(weakData));
    }
    console.log(`✔ Weak Topics analysis complete: ${weakData.topicAnalysis.length} topic analysis records evaluated.`);

    // 11. Fetch Today's Study Plan
    console.log('\n11. Fetching Today\'s Study Plan (`GET /api/student/today-plan`)...');
    const planRes = await fetch(`${BASE_URL}/student/today-plan`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    const planData = await planRes.json();
    if (!planData.success || !Array.isArray(planData.todayPlan)) {
      throw new Error('Failed to fetch study plan: ' + JSON.stringify(planData));
    }
    console.log(`✔ Today's Study Plan retrieved: ${planData.todayPlan.length} tasks scheduled.`);

    // 12. Achievements Grid
    console.log('\n12. Fetching Achievements Grid (`GET /api/student/achievements`)...');
    const achRes = await fetch(`${BASE_URL}/student/achievements`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    const achData = await achRes.json();
    if (!achData.success || !Array.isArray(achData.achievements)) {
      throw new Error('Failed to fetch achievements: ' + JSON.stringify(achData));
    }
    const unlockedCount = achData.achievements.filter(a => a.unlocked).length;
    console.log(`✔ Achievements fetched: ${unlockedCount}/${achData.achievements.length} unlocked.`);

    // 13. Public Leaderboard Privacy & Email Masking Check
    console.log('\n13. Verifying Public Leaderboard Privacy (`GET /api/student/leaderboard`)...');
    const lbRes = await fetch(`${BASE_URL}/student/leaderboard`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    const lbData = await lbRes.json();
    if (!lbData.success || !Array.isArray(lbData.leaderboard)) {
      throw new Error('Failed to fetch leaderboard: ' + JSON.stringify(lbData));
    }
    
    // Ensure no email address or private hash is returned
    for (const entry of lbData.leaderboard) {
      if (entry.email || entry.password || entry.hash) {
        throw new Error(`PRIVACY VIOLATION: Leaderboard exposed sensitive fields! ${JSON.stringify(entry)}`);
      }
    }
    console.log(`✔ Leaderboard verified: ${lbData.leaderboard.length} entries. Sensitive user fields (email/password) strictly excluded.`);

    console.log('\n=============================================================');
    console.log('🎉 ALL PHASE 8 GAMIFICATION & REVISION TESTS PASSED SUCCESSFULLY!');
    console.log('=============================================================\n');

  } catch (error) {
    console.error('\n❌ PHASE 8 VERIFICATION FAILED:');
    console.error(error);
    process.exit(1);
  }
}

runPhase8Tests();
