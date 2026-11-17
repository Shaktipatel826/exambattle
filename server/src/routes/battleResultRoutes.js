import express from 'express';
import { BattleResult } from '../models/BattleResult.js';

const router = express.Router();

/**
 * GET /api/battle-results/:roomCode
 *
 * Returns the durable scorecard for a completed battle room.
 *
 * Security:
 *   - Requires a valid JWT via the Authorization header (same token used
 *     everywhere in ExamBattle).
 *   - Only players who participated in the battle can retrieve the result.
 *     The server verifies that req.userId is in result.leaderboard[].userId.
 *
 * Clients call this endpoint when:
 *   a) The socket battle_finished event was not received (Render spin-down
 *      between finishBattle() and the client's reconnection), OR
 *   b) Frontend polls after submission when battle_finished doesn't arrive
 *      within N seconds.
 *
 * Response shapes:
 *   200 { success: true,  result: { leaderboard, questions, finishedAt, config } }
 *   404 { success: false, message: 'Battle result not found or not yet finished.' }
 *   401 { success: false, message: 'Unauthorized.' }
 *   403 { success: false, message: 'Access denied.' }
 */
router.get('/:roomCode', async (req, res) => {
  try {
    // ── Auth: parse JWT manually (same logic used by other routes) ───────────
    // We do NOT import authMiddleware here because it uses next() which would
    // require wiring a 4-arg error handler; instead we do an inline token check.
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Unauthorized.' });
    }

    let userId;
    try {
      // Dynamic import so we don't create a circular dep on authMiddleware.
      const jwt = (await import('jsonwebtoken')).default;
      const secret = process.env.JWT_SECRET || 'examiq_secret_key_2024';
      const decoded = jwt.verify(authHeader.slice(7), secret);
      userId = decoded.userId || decoded.id || decoded._id;
    } catch {
      return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
    }

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized.' });
    }

    // ── Lookup by roomCode ───────────────────────────────────────────────────
    const roomCode = (req.params.roomCode || '').trim().toUpperCase();
    if (!roomCode) {
      return res.status(400).json({ success: false, message: 'Room code required.' });
    }

    const result = await BattleResult.findOne({ roomCode }).lean();
    if (!result) {
      return res.status(404).json({ success: false, message: 'Battle result not found or not yet finished.' });
    }

    // ── Authorization: only participants may read the result ─────────────────
    const isParticipant = result.leaderboard.some(
      entry => String(entry.userId) === String(userId)
    );
    if (!isParticipant) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    return res.json({
      success: true,
      result: {
        leaderboard: result.leaderboard,
        questions:   result.questions,
        finishedAt:  result.finishedAt,
        config:      result.config,
      },
    });
  } catch (err) {
    console.error('[BattleResultRoute] Error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error retrieving battle result.' });
  }
});

export default router;
