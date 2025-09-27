import { client } from "./core/client.js";
import { env } from "./core/config.js";
import { log } from "./core/logger.js";
import { loadCommands, loadEvents } from "./lib/loader.js";

await loadCommands();
await loadEvents(client);

await client.login(env.BOT_TOKEN);
process.on("SIGINT", () => { log.info("shutting down"); process.exit(0); });
