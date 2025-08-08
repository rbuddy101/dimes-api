import { Response } from 'express';
import { db } from '../../db';
import { 
  coinTossCompetitions, 
  coinTossSessions,
  coinTossFlips,
  coinTossAchievements,
  coinTossSettings
} from '../../db/schema';
import { and, eq, gte, lte, desc } from 'drizzle-orm';
import { AuthRequest } from '../../utils/auth';

export const getSession = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
    }

    const userId = parseInt(req.user.id);
    const now = new Date();

    // Find current active competition
    const [competition] = await db
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

    if (!competition) {
      return res.json({
        success: true,
        session: null,
        competition: null,
        recentFlips: [],
        achievements: [],
      });
    }

    // Get user's session for this competition
    const [userSession] = await db
      .select()
      .from(coinTossSessions)
      .where(
        and(
          eq(coinTossSessions.competitionId, competition.id),
          eq(coinTossSessions.userId, userId)
        )
      )
      .limit(1);

    if (!userSession) {
      return res.json({
        success: true,
        session: null,
        competition: {
          id: competition.id,
          startTime: competition.startTime,
          endTime: competition.endTime,
          timeRemaining: Math.max(0, competition.endTime.getTime() - now.getTime()),
        },
        recentFlips: [],
        achievements: [],
      });
    }

    // Get recent flips
    const recentFlips = await db
      .select({
        id: coinTossFlips.id,
        result: coinTossFlips.result,
        streakCount: coinTossFlips.streakCount,
        flippedAt: coinTossFlips.flippedAt,
      })
      .from(coinTossFlips)
      .where(eq(coinTossFlips.sessionId, userSession.id))
      .orderBy(desc(coinTossFlips.flippedAt))
      .limit(10);

    // Get achievements
    const achievements = await db
      .select({
        id: coinTossAchievements.id,
        achievementType: coinTossAchievements.achievementType,
        streakValue: coinTossAchievements.streakValue,
        achievedAt: coinTossAchievements.achievedAt,
      })
      .from(coinTossAchievements)
      .where(eq(coinTossAchievements.sessionId, userSession.id))
      .orderBy(desc(coinTossAchievements.achievedAt));

    // Get settings for daily fail limit
    const [settings] = await db.select().from(coinTossSettings).limit(1);
    const dailyFailLimit = settings?.dailyFailLimit || 3;
    
    // Calculate statistics
    const winRate = (userSession.totalFlips || 0) > 0 
      ? ((userSession.totalHeads || 0) / (userSession.totalFlips || 0) * 100).toFixed(1)
      : '0.0';

    return res.json({
      success: true,
      session: {
        id: userSession.id,
        totalFlips: userSession.totalFlips,
        totalHeads: userSession.totalHeads,
        totalTails: userSession.totalTails,
        currentStreak: userSession.currentStreak,
        bestHeadsStreak: userSession.bestHeadsStreak,
        winRate,
        lastFlipAt: userSession.lastFlipAt,
        dailyFailsUsed: userSession.dailyFailsUsed || 0,
      },
      dailyFailLimit,
      competition: {
        id: competition.id,
        startTime: competition.startTime,
        endTime: competition.endTime,
        timeRemaining: Math.max(0, competition.endTime.getTime() - now.getTime()),
        totalPlayers: competition.totalPlayers,
        totalFlips: competition.totalFlips,
      },
      recentFlips: recentFlips.reverse(), // Show oldest to newest
      achievements: achievements.map(a => ({
        ...a,
        label: getAchievementLabel(a.achievementType),
        emoji: getAchievementEmoji(a.achievementType),
      })),
    });
  } catch (error) {
    console.error('Error fetching session:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch session'
    });
  }
};

function getAchievementLabel(type: string): string {
  const labels: Record<string, string> = {
    'streak_5': '5 Heads Streak',
    'streak_10': '10 Heads Streak',
    'streak_15': '15 Heads Streak',
    'streak_20': '20 Heads Streak',
  };
  return labels[type] || type;
}

function getAchievementEmoji(type: string): string {
  const emojis: Record<string, string> = {
    'streak_5': '🔥',
    'streak_10': '⚡',
    'streak_15': '🌟',
    'streak_20': '👑',
  };
  return emojis[type] || '🏆';
}