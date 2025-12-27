import { beforeAll, afterAll, afterEach } from "vitest";

// Set test environment variables before any imports
process.env.BOT_TOKEN = "test-bot-token";
process.env.CLIENT_ID = "test-client-id";
process.env.GUILD_ID = "test-guild-id";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.REDIS_URL = "redis://localhost:6379";
process.env.LOG_LEVEL = "silent"; // Suppress logs during tests
process.env.ADMIN_USER_IDS = "123456789,987654321";
process.env.ADMIN_ROLE_IDS = "111111111,222222222";

beforeAll(() => {
  // Setup code that runs once before all tests
});

afterEach(() => {
  // Cleanup after each test
});

afterAll(() => {
  // Cleanup code that runs once after all tests
});
