import { Queue } from "bullmq";
import { env } from "../core/config.js";
import IORedis from "ioredis";

const connection = new IORedis(env.REDIS_URL);
export const jobs = {
  example: new Queue("example", { connection })
};
