import { Router } from 'express';
import { getUserProfile, syncFarcasterUsername, updateUsername, getOrCreateProfile } from './profile';
import { authenticateUser, optionalAuth } from '../../utils/auth';

const router = Router();

// Profile routes
router.get('/profile', authenticateUser, getUserProfile);
router.get('/profile/:walletAddress', getOrCreateProfile);
router.post('/profile/sync-farcaster', optionalAuth, syncFarcasterUsername);
router.put('/profile/username', optionalAuth, updateUsername);

export default router;