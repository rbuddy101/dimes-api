import { Response } from 'express';
import { db } from '../../db';
import { 
  coinTossCompetitions, 
  coinTossSessions, 
  coinTossFlips,
  coinTossAchievements,
  coinTossSettings
} from '../../db/schema';
import { and, eq, gte, lte, sql } from 'drizzle-orm';
import { AuthRequest } from '../../utils/auth';

export const recordFlip = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        error: 'Please connect your wallet to play'
      });
    }

    const userId = parseInt(req.user.id);
    const now = new Date();

    // Get or create settings
    let [settings] = await db.select().from(coinTossSettings).limit(1);
    if (!settings) {
      await db
        .insert(coinTossSettings)
        .values({
          minStreakForLeaderboard: 5,
          competitionDurationHours: 24,
          maxFlipsPerMinute: 240,
          dailyFailLimit: 3,
        });
      
      [settings] = await db.select().from(coinTossSettings).limit(1);
    }

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
      return res.status(400).json({
        success: false,
        error: 'No active competition'
      });
    }

    // Get or create user session for this competition
    let [userSession] = await db
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
      // Create new session
      await db
        .insert(coinTossSessions)
        .values({
          competitionId: competition.id,
          userId: userId,
          totalFlips: 0,
          totalHeads: 0,
          totalTails: 0,
          currentStreak: 0,
          bestHeadsStreak: 0,
          bestTailsStreak: 0,
          dailyFailsUsed: 0,
        });
      
      // Get the newly created session
      [userSession] = await db
        .select()
        .from(coinTossSessions)
        .where(
          and(
            eq(coinTossSessions.competitionId, competition.id),
            eq(coinTossSessions.userId, userId)
          )
        )
        .limit(1);

      // Update competition player count
      await db
        .update(coinTossCompetitions)
        .set({ 
          totalPlayers: sql`${coinTossCompetitions.totalPlayers} + 1` 
        })
        .where(eq(coinTossCompetitions.id, competition.id));
    }

    // Check rate limiting (max flips per minute) - Allow 240 flips per minute (0.25 second minimum)
    if (userSession.lastFlipAt) {
      const timeSinceLastFlip = now.getTime() - userSession.lastFlipAt.getTime();
      const minTimeBetweenFlips = Math.max(250, 60000 / (settings.maxFlipsPerMinute || 240)); // Minimum 0.25 seconds
      if (timeSinceLastFlip < minTimeBetweenFlips) {
        return res.status(429).json({
          success: false,
          error: 'Too fast! Please wait a moment before flipping again.'
        });
      }
    }

    // Perform the coin flip
    const result = Math.random() < 0.5 ? 'heads' : 'tails';
    
    // Check daily fail limit for tails
    const dailyFailsUsed = userSession.dailyFailsUsed || 0;
    if (result === 'tails' && dailyFailsUsed >= (settings.dailyFailLimit || 3)) {
      return res.status(429).json({ 
        success: false, 
        error: `Daily fail limit reached! You can only get ${settings.dailyFailLimit || 3} tails per day. Admin can reset this limit.`,
        dailyFailsUsed,
        dailyFailLimit: settings.dailyFailLimit || 3
      });
    }
    
    // Calculate streak - now tracking both heads and tails
    const currentStreakType = userSession.currentStreak || 0;
    const isCurrentStreakHeads = currentStreakType > 0;
    const isCurrentStreakTails = currentStreakType < 0;
    
    let newStreak = 0;
    if (result === 'heads') {
      newStreak = isCurrentStreakHeads ? currentStreakType + 1 : 1;
    } else {
      newStreak = isCurrentStreakTails ? currentStreakType - 1 : -1;
    }
    
    const newBestHeadsStreak = result === 'heads' && newStreak > 0 
      ? Math.max(userSession.bestHeadsStreak || 0, newStreak)
      : userSession.bestHeadsStreak || 0;
    const newBestTailsStreak = result === 'tails' && newStreak < 0
      ? Math.max(userSession.bestTailsStreak || 0, Math.abs(newStreak))
      : userSession.bestTailsStreak || 0;

    // Record the flip
    await db
      .insert(coinTossFlips)
      .values({
        sessionId: userSession.id,
        userId: userId,
        result: result as 'heads' | 'tails',
        streakCount: Math.abs(newStreak),
        flippedAt: now,
      });
    
    // Get the created flip
    const [flip] = await db
      .select()
      .from(coinTossFlips)
      .where(eq(coinTossFlips.sessionId, userSession.id))
      .orderBy(sql`${coinTossFlips.id} DESC`)
      .limit(1);

    // Update session stats
    await db
      .update(coinTossSessions)
      .set({
        totalFlips: (userSession.totalFlips || 0) + 1,
        totalHeads: result === 'heads' ? (userSession.totalHeads || 0) + 1 : (userSession.totalHeads || 0),
        totalTails: result === 'tails' ? (userSession.totalTails || 0) + 1 : (userSession.totalTails || 0),
        currentStreak: newStreak,
        bestHeadsStreak: newBestHeadsStreak,
        bestTailsStreak: newBestTailsStreak,
        dailyFailsUsed: result === 'tails' ? dailyFailsUsed + 1 : dailyFailsUsed,
        lastFlipAt: now,
      })
      .where(eq(coinTossSessions.id, userSession.id));

    // Update competition total flips
    await db
      .update(coinTossCompetitions)
      .set({ 
        totalFlips: sql`${coinTossCompetitions.totalFlips} + 1` 
      })
      .where(eq(coinTossCompetitions.id, competition.id));

    // Check for achievements
    const achievements = [];
    const streakMilestones = [
      { value: 5, type: 'streak_5' as const },
      { value: 10, type: 'streak_10' as const },
      { value: 15, type: 'streak_15' as const },
      { value: 20, type: 'streak_20' as const },
    ];

    for (const milestone of streakMilestones) {
      if (Math.abs(newStreak) === milestone.value && newStreak > 0) {
        // Check if achievement already exists
        const [existing] = await db
          .select()
          .from(coinTossAchievements)
          .where(
            and(
              eq(coinTossAchievements.sessionId, userSession.id),
              eq(coinTossAchievements.achievementType, milestone.type)
            )
          )
          .limit(1);

        if (!existing) {
          await db
            .insert(coinTossAchievements)
            .values({
              sessionId: userSession.id,
              userId: userId,
              achievementType: milestone.type,
              streakValue: milestone.value,
              achievedAt: now,
            });
          
          achievements.push({
            type: milestone.type,
            value: milestone.value,
            message: `🎉 Amazing! ${milestone.value} heads in a row!`,
            label: `${milestone.value} Heads Streak`,
            emoji: getAchievementEmoji(milestone.type),
          });
        }
      }
    }

    // Prepare response with updated session info
    const updatedSession = {
      totalFlips: (userSession.totalFlips || 0) + 1,
      totalHeads: result === 'heads' ? (userSession.totalHeads || 0) + 1 : (userSession.totalHeads || 0),
      totalTails: result === 'tails' ? (userSession.totalTails || 0) + 1 : (userSession.totalTails || 0),
      currentStreak: newStreak,
      bestHeadsStreak: newBestHeadsStreak,
      bestTailsStreak: newBestTailsStreak,
      dailyFailsUsed: result === 'tails' ? dailyFailsUsed + 1 : dailyFailsUsed,
      winRate: Math.round(((result === 'heads' ? (userSession.totalHeads || 0) + 1 : (userSession.totalHeads || 0)) / ((userSession.totalFlips || 0) + 1)) * 100).toString(),
    };
    
    const response = {
      success: true,
      flip: {
        id: flip.id,
        result,
        streakCount: Math.abs(newStreak),
        timestamp: flip.flippedAt,
      },
      session: updatedSession,
      achievements,
      isOnLeaderboard: newBestHeadsStreak >= (settings.minStreakForLeaderboard || 5),
      dailyFailLimit: settings.dailyFailLimit || 3,
    };

    return res.json(response);
  } catch (error) {
    console.error('Error recording flip:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to record flip'
    });
  }
};

function getAchievementEmoji(type: string): string {
  const emojis: Record<string, string> = {
    'streak_5': '🔥',
    'streak_10': '⚡',
    'streak_15': '🌟',
    'streak_20': '👑',
  };
  return emojis[type] || '🏆';
}