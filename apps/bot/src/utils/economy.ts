import { db } from "../db/index.js";
import { economy, transactions } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { ensureUser } from "../db/utils.js";

/**
 * Get or create economy record for a user in a guild
 */
export async function getEconomy(userId: string, guildId: string) {
  await ensureUser({ id: userId } as any);

  let record = await db
    .select()
    .from(economy)
    .where(and(eq(economy.userId, userId), eq(economy.guildId, guildId)))
    .limit(1);

  if (record.length === 0) {
    await db.insert(economy).values({
      id: nanoid(),
      userId,
      guildId,
      balance: 0,
      bank: 0,
      totalEarned: 0,
      totalSpent: 0,
    });

    record = await db
      .select()
      .from(economy)
      .where(and(eq(economy.userId, userId), eq(economy.guildId, guildId)))
      .limit(1);
  }

  return record[0];
}

/**
 * Add currency to user's balance
 */
export async function addBalance(
  userId: string,
  guildId: string,
  amount: number,
  source: string
): Promise<number> {
  const eco = await getEconomy(userId, guildId);

  await db
    .update(economy)
    .set({
      balance: eco.balance + amount,
      totalEarned: eco.totalEarned + amount,
      updatedAt: new Date(),
    })
    .where(and(eq(economy.userId, userId), eq(economy.guildId, guildId)));

  // Log transaction
  await db.insert(transactions).values({
    id: nanoid(),
    userId,
    guildId,
    type: "earn",
    amount,
    source,
  });

  return eco.balance + amount;
}

/**
 * Remove currency from user's balance
 */
export async function removeBalance(
  userId: string,
  guildId: string,
  amount: number,
  source: string
): Promise<number | null> {
  const eco = await getEconomy(userId, guildId);

  if (eco.balance < amount) {
    return null; // Insufficient funds
  }

  await db
    .update(economy)
    .set({
      balance: eco.balance - amount,
      totalSpent: eco.totalSpent + amount,
      updatedAt: new Date(),
    })
    .where(and(eq(economy.userId, userId), eq(economy.guildId, guildId)));

  // Log transaction
  await db.insert(transactions).values({
    id: nanoid(),
    userId,
    guildId,
    type: "spend",
    amount,
    source,
  });

  return eco.balance - amount;
}

/**
 * Transfer currency between users
 */
export async function transferBalance(
  fromUserId: string,
  toUserId: string,
  guildId: string,
  amount: number
): Promise<boolean> {
  const fromEco = await getEconomy(fromUserId, guildId);

  if (fromEco.balance < amount) {
    return false; // Insufficient funds
  }

  const toEco = await getEconomy(toUserId, guildId);

  // Remove from sender
  await db
    .update(economy)
    .set({
      balance: fromEco.balance - amount,
      updatedAt: new Date(),
    })
    .where(and(eq(economy.userId, fromUserId), eq(economy.guildId, guildId)));

  // Add to receiver
  await db
    .update(economy)
    .set({
      balance: toEco.balance + amount,
      updatedAt: new Date(),
    })
    .where(and(eq(economy.userId, toUserId), eq(economy.guildId, guildId)));

  // Log transactions
  await db.insert(transactions).values([
    {
      id: nanoid(),
      userId: fromUserId,
      guildId,
      type: "transfer",
      amount: -amount,
      source: "pay",
      metadata: { to: toUserId },
    },
    {
      id: nanoid(),
      userId: toUserId,
      guildId,
      type: "transfer",
      amount,
      source: "pay",
      metadata: { from: fromUserId },
    },
  ]);

  return true;
}

/**
 * Format currency amount
 */
export function formatCurrency(amount: number): string {
  return `💰 ${amount.toLocaleString()}`;
}

/**
 * Calculate daily reward amount (with streak bonus)
 */
export function calculateDailyReward(): number {
  return Math.floor(Math.random() * 500) + 500; // 500-1000
}

/**
 * Calculate work reward amount
 */
export function calculateWorkReward(): number {
  return Math.floor(Math.random() * 300) + 200; // 200-500
}
