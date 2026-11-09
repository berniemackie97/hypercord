import { db } from "../../db/index.js";
import { aiUserAccess } from "../../db/schema.js";
import { log } from "../../core/logger.js";

export async function resetAiQuotas(): Promise<{ usersReset: number }> {
  const result = await db
    .update(aiUserAccess)
    .set({ usedThisMonth: 0 })
    .returning({ userId: aiUserAccess.userId });

  log.info({ count: result.length }, "AI quotas reset");
  return { usersReset: result.length };
}
