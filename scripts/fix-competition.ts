import { db } from '../src/db';
import { coinTossCompetitions } from '../src/db/schema';
import { eq } from 'drizzle-orm';

async function fixCompetition() {
  try {
    // Update the current competition to remove the problematic image URL
    await db
      .update(coinTossCompetitions)
      .set({ 
        prizeImageUrl: null,
        prizeText: 'Daily Champion Prize - Congratulations on winning today\'s coin toss competition!'
      })
      .where(eq(coinTossCompetitions.id, 5));
    
    console.log('✅ Competition prize fixed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error fixing competition:', error);
    process.exit(1);
  }
}

fixCompetition();