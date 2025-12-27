import { Events, type Message, PermissionFlagsBits } from "discord.js";
import { log } from "../core/logger.js";
import { getGuildConfig } from "../core/guildConfig.js";
import { createAuditLog } from "../core/audit.js";

export const name = Events.MessageCreate;
export const once = false;

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

  // Check if bot has permission to timeout members
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
