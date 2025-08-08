#!/usr/bin/env tsx

/**
 * Script to make a user admin by wallet address
 * Usage: npx tsx scripts/make-admin.ts <wallet-address>
 * Example: npx tsx scripts/make-admin.ts 0x1234567890abcdef1234567890abcdef12345678
 */

import { db } from '../src/db';
import { userProfiles } from '../src/db/schema';
import { eq } from 'drizzle-orm';

async function makeAdmin(walletAddress: string) {
  try {
    console.log(`Making user admin: ${walletAddress}`);
    
    // Normalize wallet address to lowercase
    const normalizedAddress = walletAddress.toLowerCase();
    
    // Check if user exists
    const [user] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.walletAddress, normalizedAddress))
      .limit(1);
    
    if (!user) {
      console.error(`❌ User with wallet address ${normalizedAddress} not found`);
      console.log('User must sign in at least once before being made admin');
      process.exit(1);
    }
    
    console.log(`Found user:`, {
      id: user.id,
      walletAddress: user.walletAddress,
      username: user.username,
      currentIsAdmin: user.isAdmin
    });
    
    if (user.isAdmin) {
      console.log('✅ User is already an admin');
      process.exit(0);
    }
    
    // Update user to admin
    await db
      .update(userProfiles)
      .set({ isAdmin: true })
      .where(eq(userProfiles.id, user.id));
    
    console.log('✅ User successfully made admin');
    
    // Verify the update
    const [updatedUser] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.id, user.id))
      .limit(1);
    
    console.log('Updated user:', {
      id: updatedUser.id,
      walletAddress: updatedUser.walletAddress,
      username: updatedUser.username,
      isAdmin: updatedUser.isAdmin
    });
    
  } catch (error) {
    console.error('❌ Error making user admin:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Get wallet address from command line
const walletAddress = process.argv[2];

if (!walletAddress) {
  console.error('❌ Usage: npx tsx scripts/make-admin.ts <wallet-address>');
  console.error('Example: npx tsx scripts/make-admin.ts 0x1234567890abcdef1234567890abcdef12345678');
  process.exit(1);
}

if (!walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
  console.error('❌ Invalid wallet address format. Must be 40 hex characters with 0x prefix');
  process.exit(1);
}

makeAdmin(walletAddress);