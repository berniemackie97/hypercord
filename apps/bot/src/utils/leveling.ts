import { db } from "../db/index.js";
import { levels } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { ensureUser } from "../db/utils.js";

/**
 * Calculate XP needed for next level
 */
export function calculateXPForLevel(level: number): number {
  return 5 * (level ** 2) + (50 * level) + 100;
}

/**
 * Calculate level from total XP
 */
export function calculateLevelFromXP(totalXp: number): { level: number; xp: number } {
  let level = 0;
  let xp = totalXp;

  while (xp >= calculateXPForLevel(level)) {
    xp -= calculateXPForLevel(level);
    level++;
  }

  return { level, xp };
}

/**
 * Get or create level record for a user
 */
export async function getLevel(userId: string, guildId: string) {
  await ensureUser({ id: userId } as any);

  let record = await db
    .select()
    .from(levels)
    .where(and(eq(levels.userId, userId), eq(levels.guildId, guildId)))
    .limit(1);

  if (record.length === 0) {
    await db.insert(levels).values({
      id: nanoid(),
      userId,
      guildId,
      xp: 0,
      level: 0,
      totalXp: 0,
      messageCount: 0,
    });

    record = await db
      .select()
      .from(levels)
      .where(and(eq(levels.userId, userId), eq(levels.guildId, guildId)))
      .limit(1);
  }

  return record[0];
}

/**
 * Add XP to a user (returns true if leveled up)
 */
export async function addXP(userId: string, guildId: string, amount: number): Promise<{
  leveledUp: boolean;
  oldLevel: number;
  newLevel: number;
  xp: number;
}> {
  const levelRecord = await getLevel(userId, guildId);

  const newTotalXP = levelRecord.totalXp + amount;
  const { level: newLevel, xp: newXP } = calculateLevelFromXP(newTotalXP);
  const leveledUp = newLevel > levelRecord.level;

  await db
    .update(levels)
    .set({
      xp: newXP,
      level: newLevel,
      totalXp: newTotalXP,
      messageCount: levelRecord.messageCount + 1,
      lastXpGain: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(levels.userId, userId), eq(levels.guildId, guildId)));

  return {
    leveledUp,
    oldLevel: levelRecord.level,
    newLevel,
    xp: newXP,
  };
}

/**
 * Calculate random XP gain (15-25 XP per message)
 */
export function calculateMessageXP(): number {
  return Math.floor(Math.random() * 11) + 15; // 15-25
}
