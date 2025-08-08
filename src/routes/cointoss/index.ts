import { Router } from 'express';
import { getSettings, updateSettings } from './settings';
import { getCompetition, createCompetition } from './competition';
import { getSession } from './session';
import { recordFlip } from './flip';
import { getLeaderboard } from './leaderboard';
import { authenticateUser, requireAdmin, optionalAuth } from '../../utils/auth';
import { flipRateLimiter } from '../../middleware/rateLimiter';

const router = Router();

// Settings routes
router.get('/settings', getSettings);
router.put('/settings', authenticateUser, requireAdmin, updateSettings);

// Competition routes
router.get('/competition', getCompetition);
router.post('/competition', authenticateUser, requireAdmin, createCompetition);

// Session routes
router.get('/session', authenticateUser, getSession);

// Flip route with rate limiting
router.post('/flip', authenticateUser, flipRateLimiter, recordFlip);

// Leaderboard route
router.get('/leaderboard', optionalAuth, getLeaderboard);

export default router;