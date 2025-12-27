import { Events, type Message, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import { log } from "../core/logger.js";
import { getGuildConfig } from "../core/guildConfig.js";
import { createAuditLog } from "../core/audit.js";
import { addXP, calculateMessageXP } from "../utils/leveling.js";
import { db } from "../db/index.js";
import { messageCache, afkStatus, aiChannelConfig, aiUserAccess, guilds } from "../db/schema.js";
import { nanoid } from "nanoid";
import { eq, and } from "drizzle-orm";
import { callAI, checkQuota, type AIConfig } from "../services/ai.js";

export const name = Events.MessageCreate;
export const once = false;

// Track XP cooldowns (prevent XP spam)
const xpCooldowns = new Map<string, number>();
const XP_COOLDOWN = 60000; // 1 minute between XP gains

/**
 * Spam detection configuration
 */
interface SpamTracker {
  messages: number[];
  lastMessage: string;
  duplicateCount: number;
}

// Track message patterns per user per guild (in-memory)
const spamTrackers = new Map<string, SpamTracker>();

// Configuration
const SPAM_CONFIG = {
  // Time window in milliseconds
  timeWindow: 5000, // 5 seconds
  // Max messages in time window
  maxMessages: 5,
  // Max duplicate messages
  maxDuplicates: 3,
  // Timeout duration in minutes
  timeoutDuration: 10,
  // Cleanup interval
  cleanupInterval: 60000, // 1 minute
};

// Cleanup old trackers periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, tracker] of spamTrackers.entries()) {
    // Remove messages outside time window
    tracker.messages = tracker.messages.filter((t) => now - t < SPAM_CONFIG.timeWindow);

    // Remove tracker if no recent messages
    if (tracker.messages.length === 0) {
      spamTrackers.delete(key);
    }
  }
}, SPAM_CONFIG.cleanupInterval);

export async function execute(message: Message) {
  // Ignore bots and DMs
  if (message.author.bot || !message.guild) return;

  // Cache message for snipe command (non-blocking)
  cacheMessage(message).catch((err) => {
    log.error({ err, guild: message.guild?.id, messageId: message.id }, "failed to cache message");
  });

  // Check and clear AFK status (non-blocking)
  handleAFKStatus(message).catch((err) => {
    log.error({ err, guild: message.guild?.id, user: message.author.id }, "failed to handle AFK status");
  });

  // Check for AFK mentions (non-blocking)
  handleAFKMentions(message).catch((err) => {
    log.error({ err, guild: message.guild?.id, messageId: message.id }, "failed to handle AFK mentions");
  });

  // Handle AI assistant mentions (non-blocking)
  handleAIMention(message).catch((err) => {
    log.error({ err, guild: message.guild?.id, messageId: message.id }, "failed to handle AI mention");
  });

  // Handle XP gain (non-blocking)
  handleXPGain(message).catch((err) => {
    log.error({ err, guild: message.guild?.id, user: message.author.id }, "failed to add XP");
  });

  // Check if bot has permission to timeout members for spam detection
  const botMember = await message.guild.members.fetchMe().catch(() => null);
  if (!botMember || !botMember.permissions.has(PermissionFlagsBits.ModerateMembers)) {
    return;
  }

  // Get guild config to check if auto-mod is enabled
  const config = await getGuildConfig(message.guild.id);
  // For now, spam detection is always enabled. In future, add config option

  // Track spam
  const trackerId = `${message.guild.id}:${message.author.id}`;
  let tracker = spamTrackers.get(trackerId);

  if (!tracker) {
    tracker = {
      messages: [],
      lastMessage: "",
      duplicateCount: 0,
    };
    spamTrackers.set(trackerId, tracker);
  }

  const now = Date.now();

  // Remove messages outside time window
  tracker.messages = tracker.messages.filter((t) => now - t < SPAM_CONFIG.timeWindow);

  // Add current message
  tracker.messages.push(now);

  // Check for duplicate messages
  if (message.content === tracker.lastMessage && message.content.length > 0) {
    tracker.duplicateCount++;
  } else {
    tracker.lastMessage = message.content;
    tracker.duplicateCount = 1;
  }

  // Detect spam patterns
  let spamDetected = false;
  let reason = "";

  // Pattern 1: Too many messages in short time
  if (tracker.messages.length > SPAM_CONFIG.maxMessages) {
    spamDetected = true;
    reason = `Spam detected: ${tracker.messages.length} messages in ${SPAM_CONFIG.timeWindow / 1000} seconds`;
  }

  // Pattern 2: Duplicate messages
  if (tracker.duplicateCount > SPAM_CONFIG.maxDuplicates) {
    spamDetected = true;
    reason = `Spam detected: ${tracker.duplicateCount} duplicate messages`;
  }

  if (!spamDetected) return;

  // Get member
  const member = await message.guild.members.fetch(message.author.id).catch(() => null);
  if (!member) return;

  // Check if member is already timed out
  if (member.communicationDisabledUntil && member.communicationDisabledUntil > new Date()) {
    return;
  }

  // Check role hierarchy
  if (member.roles.highest.position >= botMember.roles.highest.position) {
    return;
  }

  try {
    // Apply timeout
    await member.timeout(
      SPAM_CONFIG.timeoutDuration * 60 * 1000,
      `Auto-mod: ${reason}`
    );

    // Delete recent spam messages
    const messagesToDelete = await message.channel.messages.fetch({ limit: 10 });
    const userMessages = messagesToDelete.filter(
      (msg) => msg.author.id === message.author.id && Date.now() - msg.createdTimestamp < 10000
    );

    if (userMessages.size > 0) {
      await message.channel.bulkDelete(userMessages).catch(() => {
        // If bulk delete fails, try individual deletes
        userMessages.forEach((msg) => msg.delete().catch(() => {}));
      });
    }

    // Log to audit
    try {
      await createAuditLog({
        guildId: message.guild.id,
        moderatorId: message.client.user!.id,
        action: "timeout",
        targetId: message.author.id,
        reason: `Auto-mod: ${reason}`,
        metadata: {
          duration: SPAM_CONFIG.timeoutDuration,
          messagesDeleted: userMessages.size,
          spamType: tracker.messages.length > SPAM_CONFIG.maxMessages ? "flood" : "duplicate",
        },
      });
    } catch (err) {
      log.error({ err }, "failed to create audit log for spam detection");
    }

    // Send notification to mod log channel if configured
    if (config.modLogChannel) {
      const channel = await message.guild.channels.fetch(config.modLogChannel).catch(() => null);
      if (channel && channel.isTextBased()) {
        await channel.send({
          content: `🤖 **Auto-Mod:** Timed out ${message.author.tag} for ${SPAM_CONFIG.timeoutDuration} minutes.\n**Reason:** ${reason}\n**Messages deleted:** ${userMessages.size}`,
        }).catch(() => {});
      }
    }

    // Clear tracker
    spamTrackers.delete(trackerId);

    log.info(
      {
        guild: message.guild.id,
        user: message.author.id,
        reason,
        duration: SPAM_CONFIG.timeoutDuration,
      },
      "spam detected and user timed out"
    );
  } catch (err) {
    log.error({ err, guild: message.guild.id, user: message.author.id }, "failed to timeout user for spam");
  }
}

/**
 * Handle XP gain from messages
 */
async function handleXPGain(message: Message) {
  if (!message.guild) return;

  const cooldownKey = `${message.guild.id}:${message.author.id}`;
  const now = Date.now();
  const lastXP = xpCooldowns.get(cooldownKey);

  // Check cooldown
  if (lastXP && now - lastXP < XP_COOLDOWN) {
    return;
  }

  // Add XP
  const xpAmount = calculateMessageXP();
  const result = await addXP(message.author.id, message.guild.id, xpAmount);

  // Update cooldown
  xpCooldowns.set(cooldownKey, now);

  // Send level up message if leveled up
  if (result.leveledUp) {
    const embed = new EmbedBuilder()
      .setTitle("🎉 Level Up!")
      .setDescription(`${message.author} reached **Level ${result.newLevel}**!`)
      .setColor(0x00ff00)
      .setThumbnail(message.author.displayAvatarURL())
      .addFields({
        name: "⭐ New Level",
        value: result.newLevel.toString(),
        inline: true,
      })
      .setFooter({ text: "Keep chatting to level up!" })
      .setTimestamp();

    await message.channel.send({ embeds: [embed] }).catch(() => {});
  }
}

// Cleanup old XP cooldowns periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of xpCooldowns.entries()) {
    if (now - timestamp > XP_COOLDOWN * 2) {
      xpCooldowns.delete(key);
    }
  }
}, 300000); // Every 5 minutes

/**
 * Cache message for snipe command
 */
async function cacheMessage(message: Message) {
  if (!message.guild) return;

  // Limit cache to 100 messages per channel (delete oldest)
  const existing = await db
    .select({ id: messageCache.id })
    .from(messageCache)
    .where(eq(messageCache.channelId, message.channelId))
    .orderBy(messageCache.createdAt)
    .limit(100);

  if (existing.length >= 100) {
    // Delete oldest message
    await db
      .delete(messageCache)
      .where(eq(messageCache.id, existing[0].id));
  }

  // Cache the message
  await db.insert(messageCache).values({
    id: nanoid(),
    messageId: message.id,
    channelId: message.channelId,
    guildId: message.guild.id,
    authorId: message.author.id,
    content: message.content || null,
    attachments: message.attachments.size > 0
      ? message.attachments.map((a) => ({
          id: a.id,
          url: a.url,
          name: a.name,
          size: a.size,
        }))
      : null,
  });
}

/**
 * Handle AFK status - remove if user is AFK
 */
async function handleAFKStatus(message: Message) {
  if (!message.guild) return;

  const afk = await db.query.afkStatus.findFirst({
    where: (a, { eq, and }) => and(
      eq(a.userId, message.author.id),
      eq(a.guildId, message.guild!.id)
    ),
  });

  if (afk) {
    await db
      .delete(afkStatus)
      .where(and(
        eq(afkStatus.userId, message.author.id),
        eq(afkStatus.guildId, message.guild.id)
      ));

    await message.reply({
      content: `👋 Welcome back! Your AFK status has been removed.`,
    }).catch(() => {});
  }
}

/**
 * Check for AFK mentions and notify
 */
async function handleAFKMentions(message: Message) {
  if (!message.guild) return;
  if (message.mentions.users.size === 0) return;

  const afkUsers: string[] = [];

  for (const [userId] of message.mentions.users) {
    const afk = await db.query.afkStatus.findFirst({
      where: (a, { eq, and }) => and(
        eq(a.userId, userId),
        eq(a.guildId, message.guild!.id)
      ),
    });

    if (afk) {
      const user = await message.client.users.fetch(userId).catch(() => null);
      if (user) {
        const reason = afk.reason ? ` - ${afk.reason}` : "";
        afkUsers.push(`**${user.tag}** is currently AFK${reason}`);
      }
    }
  }

  if (afkUsers.length > 0) {
    await message.reply({
      content: afkUsers.join("\n"),
      allowedMentions: { users: [] },
    }).catch(() => {});
  }
}

/**
 * Handle AI assistant mentions
 */
async function handleAIMention(message: Message) {
  if (!message.guild) return;

  // Check if bot was mentioned
  if (!message.mentions.has(message.client.user!.id)) return;

  // Get AI configuration priority: user > channel > guild default
  const aiConfig = await resolveAIConfig(message);
  if (!aiConfig) return; // AI disabled or not configured

  // Check role requirements if set
  if (aiConfig.requiredRole) {
    const member = await message.guild.members.fetch(message.user.id).catch(() => null);
    if (!member || !member.roles.cache.has(aiConfig.requiredRole)) {
      await message.reply({
        content: "❌ You don't have the required role to use AI in this channel.",
        allowedMentions: { users: [] },
      }).catch(() => {});
      return;
    }
  }

  // Check quota
  const hasQuota = await checkQuota(message.author.id, message.guild.id, aiConfig.provider, aiConfig.monthlyLimit);
  if (!hasQuota) {
    await message.reply({
      content: `❌ You've exceeded your monthly quota for ${aiConfig.provider}. Check \`/ai-quota\` for details.`,
      allowedMentions: { users: [] },
    }).catch(() => {});
    return;
  }

  // Extract prompt (remove bot mention)
  const prompt = message.content.replace(new RegExp(`<@!?${message.client.user!.id}>`), "").trim();
  if (!prompt) {
    await message.reply({
      content: "Ask me anything! Just mention me with your question.",
      allowedMentions: { users: [] },
    }).catch(() => {});
    return;
  }

  // Show typing indicator
  await message.channel.sendTyping();

  try {
    // Call AI service
    const response = await callAI(prompt, aiConfig, {
      userId: message.author.id,
      guildId: message.guild.id,
      channelId: message.channelId,
      messageId: message.id,
    });

    // Split response if too long (Discord limit: 2000 chars)
    const chunks = splitMessage(response.content, 2000);

    for (const chunk of chunks) {
      await message.reply({
        content: chunk,
        allowedMentions: { users: [] },
      });
    }
  } catch (error) {
    log.error({ error, userId: message.author.id }, "AI response failed");
    await message.reply({
      content: "❌ Sorry, I encountered an error processing your request. Please try again later.",
      allowedMentions: { users: [] },
    }).catch(() => {});
  }
}

/**
 * Resolve AI configuration based on priority: user > channel > guild
 */
async function resolveAIConfig(message: Message): Promise<(AIConfig & { requiredRole?: string; monthlyLimit?: number | null }) | null> {
  if (!message.guild) return null;

  // 1. Check user-level access
  const userAccess = await db.query.aiUserAccess.findFirst({
    where: (a, { eq, and }) => and(eq(a.userId, message.author.id), eq(a.guildId, message.guild!.id)),
  });

  if (userAccess) {
    // Check if expired
    if (userAccess.expiresAt && userAccess.expiresAt < new Date()) {
      // Expired, fall through to channel/guild config
    } else {
      return {
        provider: userAccess.provider as "openai" | "anthropic" | "gemini" | "grok",
        model: userAccess.model,
        monthlyLimit: userAccess.monthlyLimit,
      };
    }
  }

  // 2. Check channel-level config
  const channelConfig = await db.query.aiChannelConfig.findFirst({
    where: (c, { eq, and }) => and(eq(c.guildId, message.guild!.id), eq(c.channelId, message.channelId), eq(c.enabled, true)),
  });

  if (channelConfig) {
    return {
      provider: channelConfig.provider as "openai" | "anthropic" | "gemini" | "grok",
      model: channelConfig.model,
      systemPrompt: channelConfig.systemPrompt || undefined,
      requiredRole: channelConfig.requiredRole || undefined,
    };
  }

  // 3. Fall back to guild default
  const guild = await db.query.guilds.findFirst({
    where: (g, { eq }) => eq(g.id, message.guild!.id),
  });

  if (guild && guild.aiEnabled && guild.defaultAiProvider !== "disabled") {
    return {
      provider: guild.defaultAiProvider as "openai" | "anthropic" | "gemini" | "grok",
      model: guild.defaultAiModel || "gemini-1.5-flash",
    };
  }

  // AI disabled
  return null;
}

/**
 * Split long messages into chunks
 */
function splitMessage(text: string, maxLength: number): string[] {
  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    // Find last newline or space before maxLength
    let splitIndex = remaining.lastIndexOf("\n", maxLength);
    if (splitIndex === -1) {
      splitIndex = remaining.lastIndexOf(" ", maxLength);
    }
    if (splitIndex === -1) {
      splitIndex = maxLength;
    }

    chunks.push(remaining.slice(0, splitIndex));
    remaining = remaining.slice(splitIndex).trim();
  }

  return chunks;
}
