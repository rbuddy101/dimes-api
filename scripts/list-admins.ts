#!/usr/bin/env tsx

/**
 * Script to list all admin users
 * Usage: npx tsx scripts/list-admins.ts
 */

import { db } from '../src/db';
import { userProfiles } from '../src/db/schema';
import { eq } from 'drizzle-orm';

async function listAdmins() {
  try {
    console.log('🔍 Searching for admin users...');
    
    // Get all admin users
    const adminUsers = await db
      .select({
        id: userProfiles.id,
        walletAddress: userProfiles.walletAddress,
        username: userProfiles.username,
        isAdmin: userProfiles.isAdmin,
        createdAt: userProfiles.createdAt,
        updatedAt: userProfiles.updatedAt,
      })
      .from(userProfiles)
      .where(eq(userProfiles.isAdmin, true));
    
    if (adminUsers.length === 0) {
      console.log('⚠️  No admin users found');
      console.log('To make a user admin, run: npx tsx scripts/make-admin.ts <wallet-address>');
      return;
    }
    
    console.log(`✅ Found ${adminUsers.length} admin user${adminUsers.length === 1 ? '' : 's'}:`);
    console.log('');
    
    adminUsers.forEach((user, index) => {
      console.log(`${index + 1}. Admin User:`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Wallet: ${user.walletAddress || 'Not set'}`);
      console.log(`   Username: ${user.username || 'Not set'}`);
      console.log(`   Created: ${user.createdAt}`);
      console.log(`   Updated: ${user.updatedAt}`);
      console.log('');
    });
    
    // Also get total user count for context
    const totalUsers = await db
      .select()
      .from(userProfiles);
    
    console.log(`📊 Total users: ${totalUsers.length}`);
    console.log(`📊 Admin users: ${adminUsers.length}`);
    console.log(`📊 Regular users: ${totalUsers.length - adminUsers.length}`);
    
  } catch (error) {
    console.error('❌ Error listing admin users:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

listAdmins();