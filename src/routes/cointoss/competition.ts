import { Response } from 'express';
import { db } from '../../db';
import { coinTossCompetitions, coinTossPresetPrizes } from '../../db/schema';
import { and, gte, lte, eq, desc } from 'drizzle-orm';
import { AuthRequest } from '../../utils/auth';
import { SecureAuthRequest } from '../../utils/auth-secure';
import { logAdminAction, AdminAction } from '../../utils/auditLog';

export const getCompetition = async (req: AuthRequest, res: Response) => {
  try {
    const now = new Date();
    
    // Find active competition
    let [competition] = await db
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

    // If no active competition, create one
    if (!competition) {
      const endTime = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now
      
      await db
        .insert(coinTossCompetitions)
        .values({
          startTime: now,
          endTime: endTime,
          isActive: true,
          totalPlayers: 0,
          totalFlips: 0,
        });
      
      // Get the newly created competition
      [competition] = await db
        .select()
        .from(coinTossCompetitions)
        .where(eq(coinTossCompetitions.isActive, true))
        .orderBy(desc(coinTossCompetitions.id))
        .limit(1);
    }

    // Check if competition has ended
    if (competition.endTime < now) {
      // Mark as inactive
      await db
        .update(coinTossCompetitions)
        .set({ isActive: false })
        .where(eq(coinTossCompetitions.id, competition.id));

      // Get default prize if available
      let prizeText = null;
      let prizeImageUrl = null;
      let requiresAddress = false;
      
      const [defaultPrize] = await db
        .select()
        .from(coinTossPresetPrizes)
        .where(and(
          eq(coinTossPresetPrizes.isDefault, true),
          eq(coinTossPresetPrizes.isActive, true)
        ))
        .limit(1);

      if (defaultPrize) {
        prizeText = defaultPrize.description;
        prizeImageUrl = defaultPrize.imageUrl;
        requiresAddress = defaultPrize.requiresAddress;
      }

      // Create new competition with default prize
      const endTime = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      
      await db
        .insert(coinTossCompetitions)
        .values({
          startTime: now,
          endTime: endTime,
          isActive: true,
          totalPlayers: 0,
          totalFlips: 0,
          prizeText,
          prizeImageUrl,
          requiresAddress,
        });
      
      // Get the newly created competition
      [competition] = await db
        .select()
        .from(coinTossCompetitions)
        .where(eq(coinTossCompetitions.isActive, true))
        .orderBy(desc(coinTossCompetitions.id))
        .limit(1);
    }

    // Calculate time remaining
    const timeRemaining = competition.endTime.getTime() - now.getTime();

    return res.json({
      success: true,
      competition: {
        ...competition,
        timeRemaining: Math.max(0, timeRemaining),
        timeRemainingFormatted: formatTimeRemaining(timeRemaining),
      },
    });
  } catch (error) {
    console.error('Error fetching competition:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch competition'
    });
  }
};

export const createCompetition = async (req: SecureAuthRequest, res: Response) => {
  try {
    const { durationHours = 24, useDefaultPrize = true } = req.body;
    const now = new Date();
    const endTime = new Date(now.getTime() + durationHours * 60 * 60 * 1000);

    // End any active competitions
    await db
      .update(coinTossCompetitions)
      .set({ isActive: false })
      .where(eq(coinTossCompetitions.isActive, true));

    let prizeText = null;
    let prizeImageUrl = null;
    let requiresAddress = false;

    // Get default prize if requested
    if (useDefaultPrize) {
      const [defaultPrize] = await db
        .select()
        .from(coinTossPresetPrizes)
        .where(and(
          eq(coinTossPresetPrizes.isDefault, true),
          eq(coinTossPresetPrizes.isActive, true)
        ))
        .limit(1);

      if (defaultPrize) {
        prizeText = defaultPrize.description;
        prizeImageUrl = defaultPrize.imageUrl;
        requiresAddress = defaultPrize.requiresAddress;
      }
    }

    // Create new competition
    await db
      .insert(coinTossCompetitions)
      .values({
        startTime: now,
        endTime: endTime,
        isActive: true,
        totalPlayers: 0,
        totalFlips: 0,
        prizeText,
        prizeImageUrl,
        requiresAddress,
      });
    
    // Get the newly created competition
    const [competition] = await db
      .select()
      .from(coinTossCompetitions)
      .where(eq(coinTossCompetitions.isActive, true))
      .orderBy(desc(coinTossCompetitions.id))
      .limit(1);

    // Log admin action
    await logAdminAction(
      req,
      AdminAction.CREATE_COMPETITION,
      'competition',
      competition.id,
      { 
        durationHours,
        useDefaultPrize,
        prizeApplied: !!prizeText
      },
      true
    );

    return res.json({
      success: true,
      competition,
    });
  } catch (error) {
    console.error('Error creating competition:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create competition'
    });
  }
};

function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return 'Competition ended';
  
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((ms % (1000 * 60)) / 1000);
  
  return `${hours}h ${minutes}m ${seconds}s`;
}