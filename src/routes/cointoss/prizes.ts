import { Response } from 'express';
import { db } from '../../db';
import { coinTossPresetPrizes } from '../../db/schema';
import { eq, desc } from 'drizzle-orm';
import { SecureAuthRequest } from '../../utils/auth-secure';
import { validateParams, validateBody, schemas } from '../../utils/validation';
import Joi from 'joi';

// Get all preset prizes
export const getPresetPrizes = async (req: SecureAuthRequest, res: Response) => {
  try {
    const activeOnly = req.query.activeOnly === 'true';
    
    const prizes = await db
      .select()
      .from(coinTossPresetPrizes)
      .where(activeOnly ? eq(coinTossPresetPrizes.isActive, true) : undefined)
      .orderBy(desc(coinTossPresetPrizes.isDefault), desc(coinTossPresetPrizes.createdAt));

    return res.json({
      success: true,
      prizes,
    });
  } catch (error) {
    console.error('Error fetching preset prizes:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch preset prizes',
    });
  }
};

// Create a new preset prize
export const createPresetPrize = async (req: SecureAuthRequest, res: Response) => {
  try {
    const { name, description, imageUrl, isDefault = false } = req.body;

    if (!name || !description) {
      return res.status(400).json({
        success: false,
        error: 'Name and description are required',
      });
    }

    // If setting as default, remove default from others
    if (isDefault) {
      await db
        .update(coinTossPresetPrizes)
        .set({ isDefault: false })
        .where(eq(coinTossPresetPrizes.isDefault, true));
    }

    await db.insert(coinTossPresetPrizes).values({
      name: name.trim(),
      description: description.trim(),
      imageUrl: imageUrl?.trim() || null,
      isDefault,
      isActive: true,
    });

    return res.json({
      success: true,
      message: 'Preset prize created successfully',
    });
  } catch (error) {
    console.error('Error creating preset prize:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create preset prize',
    });
  }
};

// Update a preset prize
export const updatePresetPrize = async (req: SecureAuthRequest, res: Response) => {
  try {
    const prizeId = parseInt(req.params.id);
    const { name, description, imageUrl, isDefault, isActive } = req.body;

    if (isNaN(prizeId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid prize ID',
      });
    }

    if (!name || !description) {
      return res.status(400).json({
        success: false,
        error: 'Name and description are required',
      });
    }

    // If setting as default, remove default from others
    if (isDefault) {
      await db
        .update(coinTossPresetPrizes)
        .set({ isDefault: false })
        .where(eq(coinTossPresetPrizes.isDefault, true));
    }

    const [updatedPrize] = await db
      .update(coinTossPresetPrizes)
      .set({
        name: name.trim(),
        description: description.trim(),
        imageUrl: imageUrl?.trim() || null,
        isDefault: isDefault || false,
        isActive: isActive !== undefined ? isActive : true,
      })
      .where(eq(coinTossPresetPrizes.id, prizeId));

    if (!updatedPrize) {
      return res.status(404).json({
        success: false,
        error: 'Prize not found',
      });
    }

    return res.json({
      success: true,
      message: 'Preset prize updated successfully',
    });
  } catch (error) {
    console.error('Error updating preset prize:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update preset prize',
    });
  }
};

// Delete a preset prize
export const deletePresetPrize = async (req: SecureAuthRequest, res: Response) => {
  try {
    const prizeId = parseInt(req.params.id);

    if (isNaN(prizeId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid prize ID',
      });
    }

    await db
      .delete(coinTossPresetPrizes)
      .where(eq(coinTossPresetPrizes.id, prizeId));

    return res.json({
      success: true,
      message: 'Preset prize deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting preset prize:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete preset prize',
    });
  }
};

// Set default preset prize
export const setDefaultPresetPrize = async (req: SecureAuthRequest, res: Response) => {
  try {
    const prizeId = parseInt(req.params.id);

    if (isNaN(prizeId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid prize ID',
      });
    }

    // Remove default from all prizes
    await db
      .update(coinTossPresetPrizes)
      .set({ isDefault: false })
      .where(eq(coinTossPresetPrizes.isDefault, true));

    // Set new default
    await db
      .update(coinTossPresetPrizes)
      .set({ isDefault: true })
      .where(eq(coinTossPresetPrizes.id, prizeId));

    return res.json({
      success: true,
      message: 'Default prize set successfully',
    });
  } catch (error) {
    console.error('Error setting default prize:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to set default prize',
    });
  }
};

// Get default preset prize
export const getDefaultPresetPrize = async (req: SecureAuthRequest, res: Response) => {
  try {
    const [defaultPrize] = await db
      .select()
      .from(coinTossPresetPrizes)
      .where(eq(coinTossPresetPrizes.isDefault, true))
      .limit(1);

    return res.json({
      success: true,
      defaultPrize: defaultPrize || null,
    });
  } catch (error) {
    console.error('Error fetching default prize:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch default prize',
    });
  }
};