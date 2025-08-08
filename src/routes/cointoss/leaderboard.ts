import { Response } from 'express';
import { db } from '../../db';
import { 
  coinTossCompetitions, 
  coinTossSessions,
  coinTossSettings,
  userProfiles
} from '../../db/schema';
import { and, eq, gte, lte, desc, gte as greaterThanOrEqual, sql } from 'drizzle-orm';
import { AuthRequest } from '../../utils/auth';

export const getLeaderboard = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const limit = parseInt(req.query.limit as string || '10');
    const competitionId = req.query.competitionId as string;
    
    // Get settings for minimum streak
    const [settings] = await db.select().from(coinTossSettings).limit(1);
    const minStreak = settings?.minStreakForLeaderboard || 5;

    // Find competition
    let competition;
    if (competitionId) {
      [competition] = await db
        .select()
        .from(coinTossCompetitions)
        .where(eq(coinTossCompetitions.id, parseInt(competitionId)))
        .limit(1);
    } else {
      // Get current active competition
      const now = new Date();
      [competition] = await db
        .select()
        .from(coinTossCompetitions)
        .where(
          and(
            eq(coinTossCompetitions.isActive, true),
            lte(coinTossCompetitions.startTime, now),
            gte(coinTossCompetitions.endTime, now)
          )
        )
        .limit(1);
    }

    if (!competition) {
      return res.json({
        success: true,
        leaderboard: [],
        userRank: null,
        competition: null,
      });
    }

    // Get leaderboard entries
    const leaderboardEntries = await db
      .select({
        sessionId: coinTossSessions.id,
        userId: coinTossSessions.userId,
        bestHeadsStreak: coinTossSessions.bestHeadsStreak,
        totalFlips: coinTossSessions.totalFlips,
        totalHeads: coinTossSessions.totalHeads,
        username: userProfiles.username,
        walletAddress: userProfiles.walletAddress,
        avatarUrl: userProfiles.avatarUrl,
      })
      .from(coinTossSessions)
      .innerJoin(userProfiles, eq(coinTossSessions.userId, userProfiles.id))
      .where(
        and(
          eq(coinTossSessions.competitionId, competition.id),
          greaterThanOrEqual(coinTossSessions.bestHeadsStreak, minStreak)
        )
      )
      .orderBy(desc(coinTossSessions.bestHeadsStreak), desc(coinTossSessions.totalHeads))
      .limit(limit);

    // Format leaderboard with ranks
    const leaderboard = leaderboardEntries.map((entry, index) => ({
      rank: index + 1,
      userId: entry.userId,
      username: entry.username || formatAddress(entry.walletAddress),
      walletAddress: entry.walletAddress,
      avatarUrl: entry.avatarUrl,
      bestHeadsStreak: entry.bestHeadsStreak || 0,
      totalFlips: entry.totalFlips || 0,
      totalHeads: entry.totalHeads || 0,
      winRate: (entry.totalFlips || 0) > 0 ? ((entry.totalHeads || 0) / (entry.totalFlips || 0) * 100).toFixed(1) : '0.0',
      isCurrentUser: userId ? entry.userId === parseInt(userId) : false,
    }));

    // Get user's rank if authenticated
    let userRank = null;
    if (userId) {
      const [userSession] = await db
        .select({
          bestHeadsStreak: coinTossSessions.bestHeadsStreak,
          totalFlips: coinTossSessions.totalFlips,
          totalHeads: coinTossSessions.totalHeads,
        })
        .from(coinTossSessions)
        .where(
          and(
            eq(coinTossSessions.competitionId, competition.id),
            eq(coinTossSessions.userId, parseInt(userId))
          )
        )
        .limit(1);

      if (userSession && userSession.bestHeadsStreak !== null && userSession.bestHeadsStreak >= minStreak) {
        // Count how many users have better streaks
        const [betterUsers] = await db
          .select({ count: sql<number>`count(*)` })
          .from(coinTossSessions)
          .where(
            and(
              eq(coinTossSessions.competitionId, competition.id),
              greaterThanOrEqual(coinTossSessions.bestHeadsStreak, minStreak),
              sql`(${coinTossSessions.bestHeadsStreak} > ${userSession.bestHeadsStreak} 
                OR (${coinTossSessions.bestHeadsStreak} = ${userSession.bestHeadsStreak} 
                AND ${coinTossSessions.totalHeads} > ${userSession.totalHeads || 0}))`
            )
          );

        userRank = {
          rank: (betterUsers?.count || 0) + 1,
          bestHeadsStreak: userSession.bestHeadsStreak,
          totalFlips: userSession.totalFlips || 0,
          totalHeads: userSession.totalHeads || 0,
          winRate: (userSession.totalFlips || 0) > 0 ? ((userSession.totalHeads || 0) / (userSession.totalFlips || 0) * 100).toFixed(1) : '0.0',
        };
      }
    }

    // Get competition stats
    const competitionStats = {
      id: competition.id,
      startTime: competition.startTime,
      endTime: competition.endTime,
      isActive: competition.isActive,
      totalPlayers: competition.totalPlayers,
      totalFlips: competition.totalFlips,
      timeRemaining: Math.max(0, competition.endTime.getTime() - Date.now()),
    };

    return res.json({
      success: true,
      leaderboard,
      userRank,
      competition: competitionStats,
      minStreakRequired: minStreak,
    });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch leaderboard'
    });
  }
};

function formatAddress(address: string | null): string {
  if (!address) return 'Anonymous';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}