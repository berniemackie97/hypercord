import { Events } from "discord.js";
export const name = Events.ClientReady;
export const once = true;
export async function execute(c: any) { /* handled in client.ts for logging */ }
