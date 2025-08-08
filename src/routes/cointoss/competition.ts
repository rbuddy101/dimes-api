import { Response } from 'express';
import { db } from '../../db';
import { coinTossCompetitions } from '../../db/schema';
import { and, gte, lte, eq, desc } from 'drizzle-orm';
import { AuthRequest } from '../../utils/auth';

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

      // Create new competition
      const endTime = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      
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

export const createCompetition = async (req: AuthRequest, res: Response) => {
  try {
    const { durationHours = 24 } = req.body;
    const now = new Date();
    const endTime = new Date(now.getTime() + durationHours * 60 * 60 * 1000);

    // End any active competitions
    await db
      .update(coinTossCompetitions)
      .set({ isActive: false })
      .where(eq(coinTossCompetitions.isActive, true));

    // Create new competition
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
    const [competition] = await db
      .select()
      .from(coinTossCompetitions)
      .where(eq(coinTossCompetitions.isActive, true))
      .orderBy(desc(coinTossCompetitions.id))
      .limit(1);

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