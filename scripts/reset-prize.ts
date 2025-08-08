import { db } from '../src/db';
import { coinTossPresetPrizes } from '../src/db/schema';

async function resetPrize() {
  try {
    // Delete all existing prizes
    await db.delete(coinTossPresetPrizes);
    
    // Insert a proper default prize without problematic URL
    await db.insert(coinTossPresetPrizes).values({
      name: 'Daily Champion Prize',
      description: 'Congratulations on winning today\'s coin toss competition! You\'ve proven your luck and skill.',
      imageUrl: null, // No image URL to avoid Next.js Image issues
      isDefault: true,
      isActive: true
    });
    
    console.log('✅ Prize reset successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error resetting prize:', error);
    process.exit(1);
  }
}

resetPrize();