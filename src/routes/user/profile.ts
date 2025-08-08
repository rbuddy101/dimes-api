import { Response } from 'express';
import { AuthRequest } from '../../utils/auth';
import { db } from '../../db';
import { userProfiles } from '../../db/schema';
import { eq } from 'drizzle-orm';

// Get user profile
export const getUserProfile = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        error: 'Not authenticated' 
      });
    }

    const profiles = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.id, parseInt(userId)))
      .limit(1);

    const profile = profiles[0];
    
    if (!profile) {
      return res.status(404).json({
        success: false,
        error: 'Profile not found'
      });
    }

    return res.json({
      success: true,
      profile: {
        id: profile.id,
        walletAddress: profile.walletAddress,
        username: profile.username,
        avatarUrl: profile.avatarUrl,
        isAdmin: profile.isAdmin
      }
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch profile'
    });
  }
};

// Sync Farcaster username with profile
export const syncFarcasterUsername = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { farcasterUsername, walletAddress } = req.body;
    
    if (!userId && !walletAddress) {
      return res.status(401).json({ 
        success: false, 
        error: 'Not authenticated' 
      });
    }

    if (!farcasterUsername) {
      return res.status(400).json({
        success: false,
        error: 'Farcaster username is required'
      });
    }

    let profile;
    
    // If we have a wallet address, try to find or create profile
    if (walletAddress) {
      const existingProfiles = await db
        .select()
        .from(userProfiles)
        .where(eq(userProfiles.walletAddress, walletAddress.toLowerCase()))
        .limit(1);

      if (existingProfiles.length > 0) {
        profile = existingProfiles[0];
        
        // Only sync if username is not already set or different
        if (!profile.username || profile.username !== farcasterUsername) {
          await db
            .update(userProfiles)
            .set({ 
              username: farcasterUsername,
              updatedAt: new Date()
            })
            .where(eq(userProfiles.id, profile.id));
          
          profile.username = farcasterUsername;
        }
      } else {
        // Create new profile with Farcaster username
        const result = await db
          .insert(userProfiles)
          .values({
            walletAddress: walletAddress.toLowerCase(),
            username: farcasterUsername
          });
        
        const newProfiles = await db
          .select()
          .from(userProfiles)
          .where(eq(userProfiles.walletAddress, walletAddress.toLowerCase()))
          .limit(1);
        
        profile = newProfiles[0];
      }
    } else if (userId) {
      // Update existing user's username
      const profiles = await db
        .select()
        .from(userProfiles)
        .where(eq(userProfiles.id, parseInt(userId)))
        .limit(1);

      profile = profiles[0];
      
      if (!profile) {
        return res.status(404).json({
          success: false,
          error: 'Profile not found'
        });
      }

      // Only sync if username is not already set or different
      if (!profile.username || profile.username !== farcasterUsername) {
        await db
          .update(userProfiles)
          .set({ 
            username: farcasterUsername,
            updatedAt: new Date()
          })
          .where(eq(userProfiles.id, profile.id));
        
        profile.username = farcasterUsername;
      }
    }

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: 'Profile not found'
      });
    }

    return res.json({
      success: true,
      profile: {
        id: profile.id,
        walletAddress: profile.walletAddress,
        username: profile.username,
        avatarUrl: profile.avatarUrl
      },
      synced: true
    });
  } catch (error) {
    console.error('Error syncing Farcaster username:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to sync username'
    });
  }
};

// Update username
export const updateUsername = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { username, walletAddress } = req.body;
    
    if (!userId && !walletAddress) {
      return res.status(401).json({ 
        success: false, 
        error: 'Not authenticated' 
      });
    }

    if (!username || username.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Username is required'
      });
    }

    // Validate username length
    if (username.length > 50) {
      return res.status(400).json({
        success: false,
        error: 'Username must be 50 characters or less'
      });
    }

    // Sanitize username (basic validation)
    const sanitizedUsername = username.trim();
    
    let profile;
    
    if (walletAddress) {
      // Find or create profile by wallet address
      const existingProfiles = await db
        .select()
        .from(userProfiles)
        .where(eq(userProfiles.walletAddress, walletAddress.toLowerCase()))
        .limit(1);

      if (existingProfiles.length > 0) {
        profile = existingProfiles[0];
        
        await db
          .update(userProfiles)
          .set({ 
            username: sanitizedUsername,
            updatedAt: new Date()
          })
          .where(eq(userProfiles.id, profile.id));
      } else {
        // Create new profile
        const result = await db
          .insert(userProfiles)
          .values({
            walletAddress: walletAddress.toLowerCase(),
            username: sanitizedUsername
          });
        
        const newProfiles = await db
          .select()
          .from(userProfiles)
          .where(eq(userProfiles.walletAddress, walletAddress.toLowerCase()))
          .limit(1);
        
        profile = newProfiles[0];
      }
    } else if (userId) {
      // Update by user ID
      await db
        .update(userProfiles)
        .set({ 
          username: sanitizedUsername,
          updatedAt: new Date()
        })
        .where(eq(userProfiles.id, parseInt(userId)));

      const profiles = await db
        .select()
        .from(userProfiles)
        .where(eq(userProfiles.id, parseInt(userId)))
        .limit(1);

      profile = profiles[0];
    }

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: 'Profile not found'
      });
    }

    return res.json({
      success: true,
      profile: {
        id: profile.id,
        walletAddress: profile.walletAddress,
        username: sanitizedUsername,
        avatarUrl: profile.avatarUrl
      }
    });
  } catch (error) {
    console.error('Error updating username:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update username'
    });
  }
};

// Get or create profile by wallet address
export const getOrCreateProfile = async (req: AuthRequest, res: Response) => {
  try {
    const { walletAddress } = req.params;
    
    if (!walletAddress) {
      return res.status(400).json({
        success: false,
        error: 'Wallet address is required'
      });
    }

    const normalizedAddress = walletAddress.toLowerCase();
    
    let profiles = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.walletAddress, normalizedAddress))
      .limit(1);

    let profile = profiles[0];
    
    if (!profile) {
      // Create new profile
      await db
        .insert(userProfiles)
        .values({
          walletAddress: normalizedAddress
        });
      
      profiles = await db
        .select()
        .from(userProfiles)
        .where(eq(userProfiles.walletAddress, normalizedAddress))
        .limit(1);
      
      profile = profiles[0];
    }

    return res.json({
      success: true,
      profile: {
        id: profile.id,
        walletAddress: profile.walletAddress,
        username: profile.username,
        avatarUrl: profile.avatarUrl,
        isAdmin: profile.isAdmin
      }
    });
  } catch (error) {
    console.error('Error getting/creating profile:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get or create profile'
    });
  }
};