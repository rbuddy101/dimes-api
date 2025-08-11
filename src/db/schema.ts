import { mysqlTable, varchar, timestamp, int, text, boolean, index, mysqlEnum, primaryKey } from 'drizzle-orm/mysql-core';
import { sql } from 'drizzle-orm';

// User profiles table (simplified for API)
export const userProfiles = mysqlTable('user_profiles', {
  id: int('id').autoincrement().notNull(),
  walletAddress: varchar('wallet_address', { length: 42 }).unique(),
  farcasterFid: int('farcaster_fid'),
  username: varchar('username', { length: 50 }),
  avatarUrl: varchar('avatar_url', { length: 255 }),
  isAdmin: boolean('is_admin').default(false),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at').default(sql`CURRENT_TIMESTAMP`).onUpdateNow(),
}, (table) => {
  return {
    farcasterFidIdx: index('farcaster_fid_idx').on(table.farcasterFid),
    primaryKey: primaryKey({ columns: [table.id], name: "user_profiles_id"}),
  };
});

// Coin Toss Competitions
export const coinTossCompetitions = mysqlTable('coin_toss_competitions', {
  id: int('id').autoincrement().notNull(),
  startTime: timestamp('start_time').notNull().default(sql`CURRENT_TIMESTAMP`),
  endTime: timestamp('end_time').notNull(),
  isActive: boolean('is_active').default(true),
  winnerUserId: int('winner_user_id').references(() => userProfiles.id),
  totalPlayers: int('total_players').default(0),
  totalFlips: int('total_flips').default(0),
  prizeText: text('prize_text'),
  prizeImageUrl: text('prize_image_url'),
  winnersSelected: boolean('winners_selected').default(false),
  prizeDelivered: boolean('prize_delivered').default(false),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at').default(sql`CURRENT_TIMESTAMP`).onUpdateNow(),
}, (table) => {
  return {
    activeIdx: index('competition_active_idx').on(table.isActive),
    endTimeIdx: index('competition_end_time_idx').on(table.endTime),
    primaryKey: primaryKey({ columns: [table.id], name: "coin_toss_competitions_id"}),
  };
});

// User sessions within a competition
export const coinTossSessions = mysqlTable('coin_toss_sessions', {
  id: int('id').autoincrement().notNull(),
  competitionId: int('competition_id').notNull().references(() => coinTossCompetitions.id, { onDelete: 'cascade' }),
  userId: int('user_id').notNull().references(() => userProfiles.id),
  totalFlips: int('total_flips').default(0),
  totalHeads: int('total_heads').default(0),
  totalTails: int('total_tails').default(0),
  currentStreak: int('current_streak').default(0),
  bestHeadsStreak: int('best_heads_streak').default(0),
  bestTailsStreak: int('best_tails_streak').default(0),
  dailyFailsUsed: int('daily_fails_used').default(0),
  lastFlipAt: timestamp('last_flip_at'),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at').default(sql`CURRENT_TIMESTAMP`).onUpdateNow(),
}, (table) => {
  return {
    competitionUserIdx: index('session_competition_user_idx').on(table.competitionId, table.userId),
    bestStreakIdx: index('session_best_streak_idx').on(table.bestHeadsStreak),
    bestTailsStreakIdx: index('session_best_tails_streak_idx').on(table.bestTailsStreak),
    primaryKey: primaryKey({ columns: [table.id], name: "coin_toss_sessions_id"}),
  };
});

// Individual coin flips
export const coinTossFlips = mysqlTable('coin_toss_flips', {
  id: int('id').autoincrement().notNull(),
  sessionId: int('session_id').notNull().references(() => coinTossSessions.id, { onDelete: 'cascade' }),
  userId: int('user_id').notNull().references(() => userProfiles.id),
  result: mysqlEnum('result', ['heads', 'tails']).notNull(),
  streakCount: int('streak_count').default(0),
  flippedAt: timestamp('flipped_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => {
  return {
    sessionIdx: index('flip_session_idx').on(table.sessionId),
    userIdx: index('flip_user_idx').on(table.userId),
    resultIdx: index('flip_result_idx').on(table.result),
    flippedAtIdx: index('flip_flipped_at_idx').on(table.flippedAt),
    primaryKey: primaryKey({ columns: [table.id], name: "coin_toss_flips_id"}),
  };
});

// Leaderboard achievements
export const coinTossAchievements = mysqlTable('coin_toss_achievements', {
  id: int('id').autoincrement().notNull(),
  sessionId: int('session_id').notNull().references(() => coinTossSessions.id, { onDelete: 'cascade' }),
  userId: int('user_id').notNull().references(() => userProfiles.id),
  achievementType: mysqlEnum('achievement_type', ['streak_5', 'streak_10', 'streak_15', 'streak_20']).notNull(),
  streakValue: int('streak_value').notNull(),
  achievedAt: timestamp('achieved_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => {
  return {
    sessionIdx: index('achievement_session_idx').on(table.sessionId),
    userIdx: index('achievement_user_idx').on(table.userId),
    typeIdx: index('achievement_type_idx').on(table.achievementType),
    achievedAtIdx: index('achievement_achieved_at_idx').on(table.achievedAt),
    primaryKey: primaryKey({ columns: [table.id], name: "coin_toss_achievements_id"}),
  };
});

// Coin toss game settings
export const coinTossSettings = mysqlTable('coin_toss_settings', {
  id: int('id').autoincrement().notNull(),
  minStreakForLeaderboard: int('min_streak_for_leaderboard').notNull().default(5),
  competitionDurationHours: int('competition_duration_hours').notNull().default(24),
  maxFlipsPerMinute: int('max_flips_per_minute').default(60),
  dailyFailLimit: int('daily_fail_limit').notNull().default(3),
  updatedAt: timestamp('updated_at').default(sql`CURRENT_TIMESTAMP`).onUpdateNow(),
}, (table) => {
  return {
    primaryKey: primaryKey({ columns: [table.id], name: "coin_toss_settings_id"}),
  };
});

// Competition winners tracking
export const coinTossWinners = mysqlTable('coin_toss_winners', {
  id: int('id').autoincrement().notNull(),
  competitionId: int('competition_id').notNull().references(() => coinTossCompetitions.id, { onDelete: 'cascade' }),
  userId: int('user_id').notNull().references(() => userProfiles.id),
  finalStreak: int('final_streak').notNull(),
  position: int('position').notNull(),
  selectedAt: timestamp('selected_at').default(sql`CURRENT_TIMESTAMP`),
  selectedById: int('selected_by_id').notNull().references(() => userProfiles.id),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at').default(sql`CURRENT_TIMESTAMP`).onUpdateNow(),
}, (table) => {
  return {
    competitionIdIdx: index('winners_competition_idx').on(table.competitionId),
    userIdIdx: index('winners_user_idx').on(table.userId),
    positionIdx: index('winners_position_idx').on(table.position),
    primaryKey: primaryKey({ columns: [table.id], name: "coin_toss_winners_id"}),
  };
});

// Preset prizes for competitions
export const coinTossPresetPrizes = mysqlTable('coin_toss_preset_prizes', {
  id: int('id').autoincrement().notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description').notNull(),
  imageUrl: text('image_url'),
  isDefault: boolean('is_default').default(false),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at').default(sql`CURRENT_TIMESTAMP`).onUpdateNow(),
}, (table) => {
  return {
    isDefaultIdx: index('preset_prize_is_default_idx').on(table.isDefault),
    isActiveIdx: index('preset_prize_is_active_idx').on(table.isActive),
    primaryKey: primaryKey({ columns: [table.id], name: "coin_toss_preset_prizes_id"}),
  };
});

// Export types
export type UserProfile = typeof userProfiles.$inferSelect;
export type CoinTossCompetition = typeof coinTossCompetitions.$inferSelect;
export type CoinTossSession = typeof coinTossSessions.$inferSelect;
export type CoinTossFlip = typeof coinTossFlips.$inferSelect;
export type CoinTossAchievement = typeof coinTossAchievements.$inferSelect;
export type CoinTossSettings = typeof coinTossSettings.$inferSelect;
export type CoinTossWinner = typeof coinTossWinners.$inferSelect;
export type CoinTossPresetPrize = typeof coinTossPresetPrizes.$inferSelect;