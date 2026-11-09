import * as command_8ball from "../commands/8ball.js";
import * as command_afk from "../commands/afk.js";
import * as command_ai_config from "../commands/ai-config.js";
import * as command_ai_grant from "../commands/ai-grant.js";
import * as command_ai_quota from "../commands/ai-quota.js";
import * as command_ai_stats from "../commands/ai-stats.js";
import * as command_audit_perms from "../commands/audit-perms.js";
import * as command_avatar from "../commands/avatar.js";
import * as command_balance from "../commands/balance.js";
import * as command_ban from "../commands/ban.js";
import * as command_blackjack from "../commands/blackjack.js";
import * as command_coinflip from "../commands/coinflip.js";
import * as command_config from "../commands/config.js";
import * as command_daily from "../commands/daily.js";
import * as command_diagnose from "../commands/diagnose.js";
import * as command_editsnipe from "../commands/editsnipe.js";
import * as command_giveaway from "../commands/giveaway.js";
import * as command_help from "../commands/help.js";
import * as command_kick from "../commands/kick.js";
import * as command_leaderboard from "../commands/leaderboard.js";
import * as command_modlogs from "../commands/modlogs.js";
import * as command_pay from "../commands/pay.js";
import * as command_ping from "../commands/ping.js";
import * as command_purge from "../commands/purge.js";
import * as command_rank from "../commands/rank.js";
import * as command_remind from "../commands/remind.js";
import * as command_serverinfo from "../commands/serverinfo.js";
import * as command_shop from "../commands/shop.js";
import * as command_snipe from "../commands/snipe.js";
import * as command_stats from "../commands/stats.js";
import * as command_timeout from "../commands/timeout.js";
import * as command_unban from "../commands/unban.js";
import * as command_userinfo from "../commands/userinfo.js";
import * as command_warn from "../commands/warn.js";
import * as command_warnings from "../commands/warnings.js";
import * as command_work from "../commands/work.js";
import * as event_guildCreate from "../events/guildCreate.js";
import * as event_guildDelete from "../events/guildDelete.js";
import * as event_guildMemberAdd from "../events/guildMemberAdd.js";
import * as event_guildMemberRemove from "../events/guildMemberRemove.js";
import * as event_interactionCreate from "../events/interactionCreate.js";
import * as event_messageCreate from "../events/messageCreate.js";
import * as event_messageDelete from "../events/messageDelete.js";
import * as event_messageUpdate from "../events/messageUpdate.js";
import * as event_ready from "../events/ready.js";

export const commandModules = [
  command_8ball,
  command_afk,
  command_ai_config,
  command_ai_grant,
  command_ai_quota,
  command_ai_stats,
  command_audit_perms,
  command_avatar,
  command_balance,
  command_ban,
  command_blackjack,
  command_coinflip,
  command_config,
  command_daily,
  command_diagnose,
  command_editsnipe,
  command_giveaway,
  command_help,
  command_kick,
  command_leaderboard,
  command_modlogs,
  command_pay,
  command_ping,
  command_purge,
  command_rank,
  command_remind,
  command_serverinfo,
  command_shop,
  command_snipe,
  command_stats,
  command_timeout,
  command_unban,
  command_userinfo,
  command_warn,
  command_warnings,
  command_work,
] as const;

export const eventModules = [
  event_guildCreate,
  event_guildDelete,
  event_guildMemberAdd,
  event_guildMemberRemove,
  event_interactionCreate,
  event_messageCreate,
  event_messageDelete,
  event_messageUpdate,
  event_ready,
] as const;
