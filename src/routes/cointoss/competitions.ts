import { Response } from 'express';
import { db } from '../../db';
import { coinTossCompetitions, coinTossSessions, coinTossWinners, userProfiles, coinTossPresetPrizes, coinTossSettings } from '../../db/schema';
import { and, eq, desc, sql, gte, lte } from 'drizzle-orm';
import { SecureAuthRequest } from '../../utils/auth-secure';
import { logAdminAction, AdminAction } from '../../utils/auditLog';
import { validateParams, validateBody, validateQuery, schemas } from '../../utils/validation';
import Joi from 'joi';

// Get all competitions with pagination
export const getAllCompetitions = async (req: SecureAuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;
    const includeActive = req.query.includeActive === 'true';

    // Build where clause
    const whereConditions = includeActive ? undefined : eq(coinTossCompetitions.isActive, false);

    // Get total count
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(coinTossCompetitions)
      .where(whereConditions);

    const totalCount = Number(countResult?.count || 0);

    // Get competitions with winner info
    const competitions = await db
      .select({
        id: coinTossCompetitions.id,
        startTime: coinTossCompetitions.startTime,
        endTime: coinTossCompetitions.endTime,
        isActive: coinTossCompetitions.isActive,
        totalPlayers: coinTossCompetitions.totalPlayers,
        totalFlips: coinTossCompetitions.totalFlips,
        prizeText: coinTossCompetitions.prizeText,
        prizeImageUrl: coinTossCompetitions.prizeImageUrl,
        winnersSelected: coinTossCompetitions.winnersSelected,
        prizeDelivered: coinTossCompetitions.prizeDelivered,
        createdAt: coinTossCompetitions.createdAt,
        winnerCount: sql<number>`(
          SELECT COUNT(*) FROM coin_toss_winners 
          WHERE competition_id = ${coinTossCompetitions.id}
        )`,
      })
      .from(coinTossCompetitions)
      .where(whereConditions)
      .orderBy(desc(coinTossCompetitions.startTime))
      .limit(limit)
      .offset(offset);

    // Calculate time remaining for active competitions
    const now = new Date();
    const competitionsWithTime = competitions.map(comp => ({
      ...comp,
      timeRemaining: comp.isActive ? Math.max(0, comp.endTime.getTime() - now.getTime()) : 0,
      status: comp.isActive 
        ? (comp.endTime > now ? 'active' : 'pending_end')
        : (comp.winnersSelected 
          ? (comp.prizeDelivered ? 'completed' : 'winners_selected')
          : 'ended'),
    }));

    return res.json({
      success: true,
      competitions: competitionsWithTime,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching competitions:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch competitions',
    });
  }
};

// Get specific competition details with leaderboard
export const getCompetitionDetails = async (req: SecureAuthRequest, res: Response) => {
  try {
    const competitionId = parseInt(req.params.id);
    
    if (isNaN(competitionId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid competition ID',
      });
    }

    // Get competition
    const [competition] = await db
      .select()
      .from(coinTossCompetitions)
      .where(eq(coinTossCompetitions.id, competitionId))
      .limit(1);

    if (!competition) {
      return res.status(404).json({
        success: false,
        error: 'Competition not found',
      });
    }

    // Get settings for minimum streak
    const [settings] = await db
      .select()
      .from(coinTossSettings)
      .limit(1);
    
    const minStreak = settings?.minStreakForLeaderboard || 5;

    // Get all players for this competition (admin view shows all with at least 1 flip)
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
      .leftJoin(userProfiles, eq(coinTossSessions.userId, userProfiles.id))
      .where(
        and(
          eq(coinTossSessions.competitionId, competitionId),
          gte(coinTossSessions.totalFlips, 1)
        )
      )
      .orderBy(desc(coinTossSessions.bestHeadsStreak), desc(coinTossSessions.totalFlips));
    
    // Add rank and displayName to each player
    const leaderboard = leaderboardData.map((player, index) => ({
      ...player,
      rank: index + 1,
      displayName: player.username || 
        `${player.walletAddress?.slice(0, 6)}...${player.walletAddress?.slice(-4)}` || 
        'Anonymous'
    }));

    // Get winners if selected
    const winners = await db
      .select({
        id: coinTossWinners.id,
        userId: coinTossWinners.userId,
        finalStreak: coinTossWinners.finalStreak,
        position: coinTossWinners.position,
        selectedAt: coinTossWinners.selectedAt,
        username: userProfiles.username,
        walletAddress: userProfiles.walletAddress,
      })
      .from(coinTossWinners)
      .leftJoin(userProfiles, eq(coinTossWinners.userId, userProfiles.id))
      .where(eq(coinTossWinners.competitionId, competitionId))
      .orderBy(coinTossWinners.position);

    const now = new Date();
    return res.json({
      success: true,
      competition: {
        ...competition,
        timeRemaining: competition.isActive ? Math.max(0, competition.endTime.getTime() - now.getTime()) : 0,
        status: competition.isActive 
          ? (competition.endTime > now ? 'active' : 'pending_end')
          : (competition.winnersSelected 
            ? (competition.prizeDelivered ? 'completed' : 'winners_selected')
            : 'ended'),
      },
      leaderboard: leaderboard.map((player, index) => ({
        ...player,
        rank: index + 1,
        displayName: player.username || `${player.walletAddress?.slice(0, 6)}...${player.walletAddress?.slice(-4)}` || 'Anonymous',
      })),
      winners,
    });
  } catch (error) {
    console.error('Error fetching competition details:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch competition details',
    });
  }
};

// End a competition manually
export const endCompetition = async (req: SecureAuthRequest, res: Response) => {
  try {
    const competitionId = parseInt(req.params.id);
    
    if (isNaN(competitionId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid competition ID',
      });
    }

    // Get competition
    const [competition] = await db
      .select()
      .from(coinTossCompetitions)
      .where(eq(coinTossCompetitions.id, competitionId))
      .limit(1);

    if (!competition) {
      return res.status(404).json({
        success: false,
        error: 'Competition not found',
      });
    }

    if (!competition.isActive) {
      return res.status(400).json({
        success: false,
        error: 'Competition is already ended',
      });
    }

    // Get all players before ending (admin can select from all with at least 1 flip)
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
      .leftJoin(userProfiles, eq(coinTossSessions.userId, userProfiles.id))
      .where(
        and(
          eq(coinTossSessions.competitionId, competitionId),
          gte(coinTossSessions.totalFlips, 1)
        )
      )
      .orderBy(desc(coinTossSessions.bestHeadsStreak), desc(coinTossSessions.totalFlips));
    
    // Add rank and displayName
    const leaderboard = leaderboardData.map((player, index) => ({
      ...player,
      rank: index + 1,
      displayName: player.username || 
        `${player.walletAddress?.slice(0, 6)}...${player.walletAddress?.slice(-4)}` || 
        'Anonymous'
    }));

    // End the competition
    await db
      .update(coinTossCompetitions)
      .set({ 
        isActive: false,
        endTime: new Date(),
      })
      .where(eq(coinTossCompetitions.id, competitionId));

    return res.json({
      success: true,
      message: 'Competition ended successfully',
      leaderboard: leaderboard.map((player, index) => ({
        ...player,
        rank: index + 1,
        displayName: player.username || `${player.walletAddress?.slice(0, 6)}...${player.walletAddress?.slice(-4)}` || 'Anonymous',
      })),
      competition: {
        ...competition,
        isActive: false,
        status: 'ended',
      },
    });
  } catch (error) {
    console.error('Error ending competition:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to end competition',
    });
  }
};

// Auto-select winners based on leaderboard
export const autoSelectWinners = async (req: SecureAuthRequest, res: Response) => {
  try {
    const competitionId = parseInt(req.params.id);
    const { topCount = 3 } = req.body;
    
    if (isNaN(competitionId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid competition ID',
      });
    }

    // Get competition
    const [competition] = await db
      .select()
      .from(coinTossCompetitions)
      .where(eq(coinTossCompetitions.id, competitionId))
      .limit(1);

    if (!competition) {
      return res.status(404).json({
        success: false,
        error: 'Competition not found',
      });
    }

    if (competition.isActive) {
      return res.status(400).json({
        success: false,
        error: 'Cannot select winners for active competition',
      });
    }

    if (competition.winnersSelected) {
      return res.status(400).json({
        success: false,
        error: 'Winners already selected for this competition',
      });
    }

    // Get settings for minimum streak
    const [settings] = await db
      .select()
      .from(coinTossSettings)
      .limit(1);
    
    const minStreak = settings?.minStreakForLeaderboard || 5;

    // Get top players from leaderboard
    const topPlayers = await db
      .select({
        userId: coinTossSessions.userId,
        bestHeadsStreak: coinTossSessions.bestHeadsStreak,
      })
      .from(coinTossSessions)
      .where(
        and(
          eq(coinTossSessions.competitionId, competitionId),
          gte(coinTossSessions.bestHeadsStreak, minStreak)
        )
      )
      .orderBy(desc(coinTossSessions.bestHeadsStreak))
      .limit(topCount);

    if (topPlayers.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No eligible players found for this competition',
      });
    }

    // Insert winners
    const winnersData = topPlayers.map((player, index) => ({
      competitionId,
      userId: player.userId,
      finalStreak: player.bestHeadsStreak || 0,
      position: index + 1,
      selectedById: parseInt(req.user!.id),
    }));

    await db.insert(coinTossWinners).values(winnersData);

    // Update competition
    await db
      .update(coinTossCompetitions)
      .set({ 
        winnersSelected: true,
        winnerUserId: topPlayers[0]?.userId, // Set the first place winner
      })
      .where(eq(coinTossCompetitions.id, competitionId));

    return res.json({
      success: true,
      message: `${topPlayers.length} winners selected successfully`,
      winners: winnersData,
    });
  } catch (error) {
    console.error('Error auto-selecting winners:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to auto-select winners',
    });
  }
};

// Process expired competitions (can be called by a cron job)
export const processExpiredCompetitions = async (req: SecureAuthRequest, res: Response) => {
  try {
    const now = new Date();
    
    // Get settings for minimum streak
    const [settings] = await db
      .select()
      .from(coinTossSettings)
      .limit(1);
    
    const minStreak = settings?.minStreakForLeaderboard || 5;
    
    // Find expired active competitions
    const expiredCompetitions = await db
      .select()
      .from(coinTossCompetitions)
      .where(
        and(
          eq(coinTossCompetitions.isActive, true),
          lte(coinTossCompetitions.endTime, now)
        )
      );

    const processed = [];
    
    for (const competition of expiredCompetitions) {
      // End the competition
      await db
        .update(coinTossCompetitions)
        .set({ isActive: false })
        .where(eq(coinTossCompetitions.id, competition.id));

      // Auto-select top 3 winners if not already selected
      if (!competition.winnersSelected) {
        const topPlayers = await db
          .select({
            userId: coinTossSessions.userId,
            bestHeadsStreak: coinTossSessions.bestHeadsStreak,
          })
          .from(coinTossSessions)
          .where(
            and(
              eq(coinTossSessions.competitionId, competition.id),
              gte(coinTossSessions.bestHeadsStreak, minStreak)
            )
          )
          .orderBy(desc(coinTossSessions.bestHeadsStreak))
          .limit(3);

        if (topPlayers.length > 0) {
          const winnersData = topPlayers.map((player, index) => ({
            competitionId: competition.id,
            userId: player.userId,
            finalStreak: player.bestHeadsStreak || 0,
            position: index + 1,
            selectedById: req.user?.id ? parseInt(req.user.id) : 1, // System user ID
          }));

          await db.insert(coinTossWinners).values(winnersData);

          await db
            .update(coinTossCompetitions)
            .set({ 
              winnersSelected: true,
              winnerUserId: topPlayers[0]?.userId,
            })
            .where(eq(coinTossCompetitions.id, competition.id));
        }
      }

      processed.push({
        id: competition.id,
        endTime: competition.endTime,
        winnersSelected: competition.winnersSelected,
      });
    }

    return res.json({
      success: true,
      message: `Processed ${processed.length} expired competitions`,
      processed,
    });
  } catch (error) {
    console.error('Error processing expired competitions:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to process expired competitions',
    });
  }
};