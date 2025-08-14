import { Router } from 'express';
import { getSettings, updateSettings } from './settings';
import { getCompetition, createCompetition } from './competition';
import { getAllCompetitions, getCompetitionDetails, endCompetition, autoSelectWinners, processExpiredCompetitions } from './competitions';
import { getPresetPrizes, createPresetPrize, updatePresetPrize, deletePresetPrize, setDefaultPresetPrize, getDefaultPresetPrize } from './prizes';
import { getCompetitionWinners, selectCompetitionWinners, markPrizeDelivered } from './winners';
import { getAdminStats, resetDailyStats, updateCompetitionPrize, getAdminLeaderboard } from './admin';
import { getSession } from './session';
import { recordFlip } from './flip';
import { getLeaderboard } from './leaderboard';
import { authenticateUser, requireAdmin, optionalAuth } from '../../utils/auth';
import { authenticateSecure, requireAdminSecure } from '../../utils/auth-secure';
import { adminRateLimiter, strictAdminRateLimiter } from '../../middleware/adminRateLimiter';
import { flipRateLimiter } from '../../middleware/rateLimiter';
import { validateParams, validateBody, schemas } from '../../utils/validation';
import Joi from 'joi';

const router = Router();

// Settings routes (public read, admin write)
router.get('/settings', getSettings);
router.put('/settings', authenticateSecure, requireAdminSecure, adminRateLimiter, updateSettings);

// Competition routes (public read, admin create)
router.get('/competition', getCompetition);
router.post('/competition', authenticateSecure, requireAdminSecure, strictAdminRateLimiter, createCompetition);

// Competition management routes (admin) - with validation and rate limiting
router.get('/competitions', authenticateSecure, requireAdminSecure, adminRateLimiter, getAllCompetitions);
router.get('/competitions/:id', 
  authenticateSecure, 
  requireAdminSecure, 
  adminRateLimiter,
  validateParams(Joi.object({ id: schemas.id })),
  getCompetitionDetails
);
router.post('/competitions/:id/end', 
  authenticateSecure, 
  requireAdminSecure, 
  strictAdminRateLimiter,
  validateParams(Joi.object({ id: schemas.id })),
  endCompetition
);
router.post('/competitions/:id/auto-winners', 
  authenticateSecure, 
  requireAdminSecure, 
  strictAdminRateLimiter,
  validateParams(Joi.object({ id: schemas.id })),
  autoSelectWinners
);
router.post('/competitions/process-expired', 
  authenticateSecure, 
  requireAdminSecure, 
  strictAdminRateLimiter,
  processExpiredCompetitions
);

// Winner management routes (admin) - with validation and rate limiting
router.get('/competitions/:id/winners',
  authenticateSecure,
  requireAdminSecure,
  adminRateLimiter,
  validateParams(Joi.object({ id: schemas.id })),
  getCompetitionWinners
);
router.post('/competitions/:id/winners',
  authenticateSecure,
  requireAdminSecure,
  strictAdminRateLimiter,
  validateParams(Joi.object({ id: schemas.id })),
  validateBody(Joi.object({ winners: schemas.winners.winners })),
  selectCompetitionWinners
);
router.post('/competitions/:id/prize-delivered',
  authenticateSecure,
  requireAdminSecure,
  strictAdminRateLimiter,
  validateParams(Joi.object({ id: schemas.id })),
  markPrizeDelivered
);

// Admin routes - with validation and rate limiting
router.get('/admin/stats', authenticateSecure, requireAdminSecure, adminRateLimiter, getAdminStats);
router.post('/admin/reset', authenticateSecure, requireAdminSecure, strictAdminRateLimiter, resetDailyStats);
router.put('/admin/prize', 
  authenticateSecure, 
  requireAdminSecure, 
  strictAdminRateLimiter,
  validateBody(Joi.object({
    competitionId: schemas.id.required(),
    prizeText: Joi.string().allow('', null),
    prizeImageUrl: Joi.string().uri().allow('', null),
    requiresAddress: Joi.boolean().default(false)
  })),
  updateCompetitionPrize
);
router.get('/admin/leaderboard', authenticateSecure, requireAdminSecure, adminRateLimiter, getAdminLeaderboard);

// Preset prize routes (admin) - with validation and rate limiting
router.get('/prizes', authenticateSecure, requireAdminSecure, adminRateLimiter, getPresetPrizes);
router.post('/prizes', 
  authenticateSecure, 
  requireAdminSecure, 
  strictAdminRateLimiter,
  validateBody(Joi.object(schemas.prize)),
  createPresetPrize
);
router.put('/prizes/:id', 
  authenticateSecure, 
  requireAdminSecure, 
  strictAdminRateLimiter,
  validateParams(Joi.object({ id: schemas.id })),
  validateBody(Joi.object(schemas.prize)),
  updatePresetPrize
);
router.delete('/prizes/:id', 
  authenticateSecure, 
  requireAdminSecure, 
  strictAdminRateLimiter,
  validateParams(Joi.object({ id: schemas.id })),
  deletePresetPrize
);
router.post('/prizes/:id/set-default', 
  authenticateSecure, 
  requireAdminSecure, 
  strictAdminRateLimiter,
  validateParams(Joi.object({ id: schemas.id })),
  setDefaultPresetPrize
);
router.get('/prizes/default', authenticateSecure, requireAdminSecure, adminRateLimiter, getDefaultPresetPrize);

// Session routes (regular user authentication)
router.get('/session', authenticateUser, getSession);

// Flip route with rate limiting (regular user authentication)
router.post('/flip', authenticateUser, flipRateLimiter, recordFlip);

// Leaderboard route (optional regular user authentication)
router.get('/leaderboard', optionalAuth, getLeaderboard);

export default router;