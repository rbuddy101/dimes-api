import { Response } from 'express';
import { db } from '../../db';
import { coinTossCompetitions, coinTossWinners, userProfiles, coinTossSessions } from '../../db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { SecureAuthRequest } from '../../utils/auth-secure';
import { logAdminAction, AdminAction } from '../../utils/auditLog';

// Get winners for a competition
export const getCompetitionWinners = async (req: SecureAuthRequest, res: Response) => {
  try {
    const competitionId = parseInt(req.params.id);
    
    if (isNaN(competitionId) || competitionId <= 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid competition ID' 
      });
    }

    // Get existing winners for this competition
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
      .innerJoin(userProfiles, eq(coinTossWinners.userId, userProfiles.id))
      .where(eq(coinTossWinners.competitionId, competitionId))
      .orderBy(coinTossWinners.position);

    return res.json({
      success: true,
      winners
    });
  } catch (error) {
    console.error('Error fetching competition winners:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch winners'
    });
  }
};

// Manually select winners for a competition
export const selectCompetitionWinners = async (req: SecureAuthRequest, res: Response) => {
  try {
    const competitionId = parseInt(req.params.id);
    const { winners } = req.body;
    
    if (isNaN(competitionId) || competitionId <= 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid competition ID' 
      });
    }

    if (!winners || !Array.isArray(winners) || winners.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Winners array is required and must not be empty'
      });
    }

    // Validate each winner object
    for (const winner of winners) {
      if (!winner.userId || typeof winner.userId !== 'number') {
        return res.status(400).json({
          success: false,
          error: 'Each winner must have a valid userId'
        });
      }
    }

    // Check if competition exists and is ended
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

    if (competition.isActive) {
      return res.status(400).json({
        success: false,
        error: 'Cannot select winners for an active competition. End it first.'
      });
    }

    // Get admin user ID from the authenticated request
    const adminUserId = parseInt(req.user!.id);

    // Clear existing winners for this competition
    await db
      .delete(coinTossWinners)
      .where(eq(coinTossWinners.competitionId, competitionId));

    // Get session data for each winner to include their final streak
    const winnersWithStreaks = await Promise.all(
      winners.map(async (winner, index) => {
        // Get the user's session for this competition
        const [session] = await db
          .select({
            bestHeadsStreak: coinTossSessions.bestHeadsStreak
          })
          .from(coinTossSessions)
          .where(
            and(
              eq(coinTossSessions.competitionId, competitionId),
              eq(coinTossSessions.userId, winner.userId)
            )
          )
          .limit(1);

        return {
          competitionId,
          userId: winner.userId,
          finalStreak: winner.finalStreak || session?.bestHeadsStreak || 0,
          position: index + 1,
          selectedById: adminUserId
        };
      })
    );

    // Insert new winners
    await db.insert(coinTossWinners).values(winnersWithStreaks);

    // Update competition to mark winners as selected
    await db
      .update(coinTossCompetitions)
      .set({ 
        winnersSelected: true,
        updatedAt: new Date()
      })
      .where(eq(coinTossCompetitions.id, competitionId));

    // Log admin action
    await logAdminAction(
      req,
      AdminAction.SELECT_WINNERS,
      'competition',
      competitionId,
      { 
        winnersCount: winnersWithStreaks.length,
        winnerIds: winners.map(w => w.userId)
      },
      true
    );

    return res.json({ 
      success: true, 
      message: `${winnersWithStreaks.length} winners selected successfully`,
      winners: winnersWithStreaks
    });

  } catch (error) {
    console.error('Error selecting winners:', error);
    
    // Log failed action
    await logAdminAction(
      req,
      AdminAction.SELECT_WINNERS,
      'competition',
      parseInt(req.params.id),
      { error: error instanceof Error ? error.message : 'Unknown error' },
      false,
      error instanceof Error ? error.message : 'Failed to select winners'
    );

    return res.status(500).json({
      success: false,
      error: 'Failed to select winners'
    });
  }
};

// Mark prize as delivered for a competition
export const markPrizeDelivered = async (req: SecureAuthRequest, res: Response) => {
  try {
    const competitionId = parseInt(req.params.id);
    
    if (isNaN(competitionId) || competitionId <= 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid competition ID' 
      });
    }

    // Check if competition exists
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

    if (!competition.winnersSelected) {
      return res.status(400).json({
        success: false,
        error: 'Cannot mark prize as delivered before selecting winners'
      });
    }

    // Update competition to mark prize as delivered
    await db
      .update(coinTossCompetitions)
      .set({ 
        prizeDelivered: true,
        updatedAt: new Date()
      })
      .where(eq(coinTossCompetitions.id, competitionId));

    // Log admin action
    await logAdminAction(
      req,
      AdminAction.MARK_PRIZE_DELIVERED,
      'competition',
      competitionId,
      {},
      true
    );

    return res.json({ 
      success: true, 
      message: 'Prize marked as delivered'
    });

  } catch (error) {
    console.error('Error marking prize as delivered:', error);
    
    await logAdminAction(
      req,
      AdminAction.MARK_PRIZE_DELIVERED,
      'competition',
      parseInt(req.params.id),
      { error: error instanceof Error ? error.message : 'Unknown error' },
      false,
      error instanceof Error ? error.message : 'Failed to mark prize as delivered'
    );

    return res.status(500).json({
      success: false,
      error: 'Failed to mark prize as delivered'
    });
  }
};