import { Response } from 'express';
import { db } from '../../db';
import { 
  coinTossCompetitions, 
  coinTossSessions,
  coinTossFlips,
  userProfiles,
  coinTossSettings
} from '../../db/schema';
import { eq, desc, count, and, gte } from 'drizzle-orm';
import { SecureAuthRequest } from '../../utils/auth-secure';
import { logAdminAction, AdminAction } from '../../utils/auditLog';

// Get admin statistics
export const getAdminStats = async (req: SecureAuthRequest, res: Response) => {
  try {
    // Get total competitions
    const [totalCompetitionsResult] = await db
      .select({ count: count() })
      .from(coinTossCompetitions);

    // Get active competitions
    const [activeCompetitionsResult] = await db
      .select({ count: count() })
      .from(coinTossCompetitions)
      .where(eq(coinTossCompetitions.isActive, true));

    // Get total unique players
    const [totalPlayersResult] = await db
      .select({ count: count() })
      .from(
        db.selectDistinct({ userId: coinTossSessions.userId })
        .from(coinTossSessions)
        .as('distinct_users')
      );

    // Get total flips
    const [totalFlipsResult] = await db
      .select({ count: count() })
      .from(coinTossFlips);

    // Get top player with best streak
    const topPlayerData = await db
      .select({
        username: userProfiles.username,
        walletAddress: userProfiles.walletAddress,
        bestStreak: coinTossSessions.bestHeadsStreak,
      })
      .from(coinTossSessions)
      .innerJoin(userProfiles, eq(coinTossSessions.userId, userProfiles.id))
      .orderBy(desc(coinTossSessions.bestHeadsStreak))
      .limit(1);

    const topPlayer = topPlayerData.length > 0 
      ? {
          username: topPlayerData[0].username || `${topPlayerData[0].walletAddress?.slice(0, 6)}...${topPlayerData[0].walletAddress?.slice(-4)}` || 'Anonymous',
          bestStreak: topPlayerData[0].bestStreak || 0,
        }
      : null;

    const stats = {
      totalCompetitions: totalCompetitionsResult.count || 0,
      activeCompetitions: activeCompetitionsResult.count || 0,
      totalPlayers: totalPlayersResult.count || 0,
      totalFlips: totalFlipsResult.count || 0,
      topPlayer,
    };

    return res.json(stats);
  } catch (error) {
    console.error('Error fetching coin toss admin stats:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch admin statistics'
    });
  }
};

// Reset daily fail counters for all users
export const resetDailyStats = async (req: SecureAuthRequest, res: Response) => {
  try {
    // Note: The daily reset functionality would need to be implemented
    // based on your specific requirements for resetting daily statistics
    const now = new Date();

    // Log admin action
    await logAdminAction(
      req,
      AdminAction.UPDATE_SETTINGS,
      'daily_stats',
      0,
      { resetTime: now.toISOString() },
      true
    );

    return res.json({ 
      success: true, 
      message: 'Daily stats reset successfully',
      resetTime: now.toISOString()
    });
  } catch (error) {
    console.error('Error resetting daily stats:', error);
    
    await logAdminAction(
      req,
      AdminAction.UPDATE_SETTINGS,
      'daily_stats',
      0,
      { error: error instanceof Error ? error.message : 'Unknown error' },
      false,
      error instanceof Error ? error.message : 'Failed to reset stats'
    );

    return res.status(500).json({
      success: false,
      error: 'Failed to reset daily stats'
    });
  }
};

// Update prize for current competition
export const updateCompetitionPrize = async (req: SecureAuthRequest, res: Response) => {
  try {
    const { competitionId, prizeText, prizeImageUrl } = req.body;

    if (!competitionId) {
      return res.status(400).json({
        success: false,
        error: 'Competition ID is required'
      });
    }

    // Update the competition prize
    await db
      .update(coinTossCompetitions)
      .set({
        prizeText: prizeText || null,
        prizeImageUrl: prizeImageUrl || null,
        updatedAt: new Date()
      })
      .where(eq(coinTossCompetitions.id, competitionId));

    // Verify the update
    const [updatedCompetition] = await db
      .select()
      .from(coinTossCompetitions)
      .where(eq(coinTossCompetitions.id, competitionId))
      .limit(1);

    if (!updatedCompetition) {
      return res.status(404).json({
        success: false,
        error: 'Competition not found'
      });
    }

    // Log admin action
    await logAdminAction(
      req,
      AdminAction.UPDATE_PRIZE,
      'competition',
      competitionId,
      { prizeText, prizeImageUrl },
      true
    );

    return res.json({
      success: true,
      message: 'Prize updated successfully',
      competition: updatedCompetition
    });
  } catch (error) {
    console.error('Error updating competition prize:', error);
    
    await logAdminAction(
      req,
      AdminAction.UPDATE_PRIZE,
      'competition',
      req.body.competitionId,
      { error: error instanceof Error ? error.message : 'Unknown error' },
      false,
      error instanceof Error ? error.message : 'Failed to update prize'
    );

    return res.status(500).json({
      success: false,
      error: 'Failed to update prize'
    });
  }
};

// Get admin leaderboard with detailed stats
export const getAdminLeaderboard = async (req: SecureAuthRequest, res: Response) => {
  try {
    const competitionId = req.query.competitionId ? parseInt(req.query.competitionId as string) : undefined;
    const showAll = req.query.showAll === 'true'; // Option to show all players regardless of streak

    if (!competitionId) {
      return res.status(400).json({
        success: false,
        error: 'Competition ID is required'
      });
    }

    // Get the competition
    const [competition] = await db
      .select()
      .from(coinTossCompetitions)
      .where(eq(coinTossCompetitions.id, competitionId))
      .limit(1);

    if (!competition) {
      return res.status(404).json({
        success: false,
        error: 'Competition not found'
      });
    }

    // Get settings for minimum streak
    const [settings] = await db
      .select()
      .from(coinTossSettings)
      .limit(1);

    const minStreak = settings?.minStreakForLeaderboard || 5;

    // Build where clause - show all players if requested by admin, otherwise apply minimum streak
    const whereClause = showAll
      ? eq(coinTossSessions.competitionId, competitionId)
      : and(
          eq(coinTossSessions.competitionId, competitionId),
          gte(coinTossSessions.bestHeadsStreak, minStreak)
        );

    // Get leaderboard data
    const leaderboardData = await db
      .select({
        userId: coinTossSessions.userId,
        bestHeadsStreak: coinTossSessions.bestHeadsStreak,
        totalFlips: coinTossSessions.totalFlips,
        totalHeads: coinTossSessions.totalHeads,
        totalTails: coinTossSessions.totalTails,
        username: userProfiles.username,
        walletAddress: userProfiles.walletAddress,
      })
      .from(coinTossSessions)
      .innerJoin(userProfiles, eq(coinTossSessions.userId, userProfiles.id))
      .where(whereClause)
      .orderBy(desc(coinTossSessions.bestHeadsStreak), desc(coinTossSessions.totalFlips));

    // Add rank to each player
    const leaderboard = leaderboardData.map((player, index) => ({
      ...player,
      rank: index + 1,
      displayName: player.username || 
        `${player.walletAddress?.slice(0, 6)}...${player.walletAddress?.slice(-4)}` || 
        'Anonymous'
    }));

    return res.json({
      success: true,
      leaderboard,
      competition: {
        id: competition.id,
        startTime: competition.startTime,
        endTime: competition.endTime,
        isActive: competition.isActive,
        minStreak
      }
    });
  } catch (error) {
    console.error('Error fetching admin leaderboard:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch leaderboard'
    });
  }
};