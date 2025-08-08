import { Response } from 'express';
import { db } from '../../db';
import { coinTossSettings } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { AuthRequest } from '../../utils/auth';

export const getSettings = async (req: AuthRequest, res: Response) => {
  try {
    let [settings] = await db.select().from(coinTossSettings).limit(1);
    
    if (!settings) {
      // Create default settings
      await db
        .insert(coinTossSettings)
        .values({
          minStreakForLeaderboard: 5,
          competitionDurationHours: 24,
          maxFlipsPerMinute: 60,
          dailyFailLimit: 3,
        });
      
      [settings] = await db.select().from(coinTossSettings).limit(1);
    }

    return res.json({
      success: true,
      settings: {
        minStreakForLeaderboard: settings.minStreakForLeaderboard,
        competitionDurationHours: settings.competitionDurationHours,
        maxFlipsPerMinute: settings.maxFlipsPerMinute,
        dailyFailLimit: settings.dailyFailLimit,
      },
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch settings'
    });
  }
};

export const updateSettings = async (req: AuthRequest, res: Response) => {
  try {
    const updates = req.body;
    
    // Validate inputs
    if (updates.minStreakForLeaderboard && updates.minStreakForLeaderboard < 1) {
      return res.status(400).json({
        success: false,
        error: 'Minimum streak must be at least 1'
      });
    }
    
    if (updates.competitionDurationHours && updates.competitionDurationHours < 1) {
      return res.status(400).json({
        success: false,
        error: 'Competition duration must be at least 1 hour'
      });
    }
    
    if (updates.maxFlipsPerMinute && updates.maxFlipsPerMinute < 1) {
      return res.status(400).json({
        success: false,
        error: 'Max flips per minute must be at least 1'
      });
    }
    
    if (updates.dailyFailLimit !== undefined && updates.dailyFailLimit < 0) {
      return res.status(400).json({
        success: false,
        error: 'Daily fail limit cannot be negative'
      });
    }

    // Get existing settings
    let [settings] = await db.select().from(coinTossSettings).limit(1);
    
    if (!settings) {
      // Create settings if they don't exist
      await db
        .insert(coinTossSettings)
        .values({
          minStreakForLeaderboard: updates.minStreakForLeaderboard || 5,
          competitionDurationHours: updates.competitionDurationHours || 24,
          maxFlipsPerMinute: updates.maxFlipsPerMinute || 60,
          dailyFailLimit: updates.dailyFailLimit !== undefined ? updates.dailyFailLimit : 3,
        });
      
      [settings] = await db.select().from(coinTossSettings).limit(1);
    } else {
      // Update existing settings
      await db
        .update(coinTossSettings)
        .set({
          ...(updates.minStreakForLeaderboard !== undefined && { 
            minStreakForLeaderboard: updates.minStreakForLeaderboard 
          }),
          ...(updates.competitionDurationHours !== undefined && { 
            competitionDurationHours: updates.competitionDurationHours 
          }),
          ...(updates.maxFlipsPerMinute !== undefined && { 
            maxFlipsPerMinute: updates.maxFlipsPerMinute 
          }),
          ...(updates.dailyFailLimit !== undefined && { 
            dailyFailLimit: updates.dailyFailLimit 
          }),
        })
        .where(eq(coinTossSettings.id, settings.id));
      
      [settings] = await db.select().from(coinTossSettings).where(eq(coinTossSettings.id, settings.id)).limit(1);
    }

    return res.json({
      success: true,
      settings: {
        minStreakForLeaderboard: settings.minStreakForLeaderboard,
        competitionDurationHours: settings.competitionDurationHours,
        maxFlipsPerMinute: settings.maxFlipsPerMinute,
        dailyFailLimit: settings.dailyFailLimit,
      },
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update settings'
    });
  }
};