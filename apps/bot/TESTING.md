# Testing Guide

## Overview

This project uses [Vitest](https://vitest.dev/) as the testing framework with comprehensive test coverage for all core functionality.

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run tests with UI
npm run test:ui
```

## Test Structure

```
src/
  └── [feature]/
      ├── index.ts
      └── __tests__/
          └── [feature].test.ts
```

## Current Test Coverage

- ✅ **Utils Tests**: Date/duration parsing utilities (14 tests passing)
- ⚠️ **External Dependencies**: Tests requiring discord.js, pino, zod have module resolution issues with pnpm workspaces

## Known Issues

### pnpm Workspace Module Resolution

Vitest uses Vite's module resolution which doesn't work well with pnpm's symlinked `node_modules` in workspace setups.

**Symptoms:**
- Error: `Cannot find package 'discord.js'` (and other deps)
- Tests for pure TypeScript utilities work fine
- Tests importing external dependencies fail

**Solutions:**

1. **Use pnpm to run tests** (recommended):
   ```bash
   cd ../../  # Go to root
   pnpm test  # Uses pnpm's module resolution
   ```

2. **Install dependencies at bot level**:
   ```bash
   pnpm install --shamefully-hoist
   ```

3. **Use different test runner**: Consider Jest or native Node test runner

4. **Configure Vitest for pnpm** (add to vitest.config.ts):
   ```typescript
   export default defineConfig({
     resolve: {
       preserveSymlinks: true,
     },
   });
   ```

## Writing Tests

### Example: Unit Test

```typescript
import { describe, it, expect } from "vitest";
import { myFunction } from "../myModule.js";

describe("MyModule", () => {
  it("should do something", () => {
    expect(myFunction()).toBe(expected);
  });
});
```

### Example: Command Test

```typescript
import { describe, it, expect, vi } from "vitest";
import { data, execute } from "../commands/ping.js";

describe("Ping Command", () => {
  it("should have correct metadata", () => {
    expect(data.name).toBe("ping");
  });

  it("should execute correctly", async () => {
    const mockInteraction = {
      createdTimestamp: 1000,
      reply: vi.fn().mockResolvedValue({ createdTimestamp: 1050 }),
      editReply: vi.fn(),
    };

    await execute(mockInteraction as any);

    expect(mockInteraction.reply).toHaveBeenCalled();
    expect(mockInteraction.editReply).toHaveBeenCalledWith(expect.stringContaining("50ms"));
  });
});
```

### Example: Integration Test

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";

describe("Database Integration", () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("should create and fetch command log", async () => {
    const log = await prisma.commandLog.create({
      data: {
        command: "ping",
        userId: "123",
        guildId: "456",
      },
    });

    expect(log.command).toBe("ping");
  });
});
```

## Test Categories

### 1. Unit Tests
- **Location**: `src/[module]/__tests__/`
- **Purpose**: Test individual functions/modules in isolation
- **Examples**: Utils, parsers, validators

### 2. Integration Tests
- **Location**: `src/integration/__tests__/`
- **Purpose**: Test interactions between modules
- **Examples**: Database operations, Redis operations, queue processing

### 3. Command Tests
- **Location**: `src/commands/__tests__/`
- **Purpose**: Test Discord commands with mocked interactions
- **Examples**: Ping, remind, audit-perms

### 4. Event Tests
- **Location**: `src/events/__tests__/`
- **Purpose**: Test event handlers
- **Examples**: ready, interactionCreate

### 5. E2E Tests
- **Location**: `tests/e2e/`
- **Purpose**: Test complete workflows with test Discord bot instance
- **Examples**: Full command execution, error handling flows

## Mocking

### Discord.js Mocks

```typescript
import { vi } from "vitest";

export function createMockInteraction(overrides = {}) {
  return {
    id: "interaction-123",
    commandName: "test",
    user: {
      id: "user-123",
      username: "testuser",
    },
    guild: {
      id: "guild-123",
      name: "Test Guild",
    },
    reply: vi.fn().mockResolvedValue({}),
    editReply: vi.fn().mockResolvedValue({}),
    deferReply: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}
```

### Prisma Mocks

```typescript
import { vi } from "vitest";
import { PrismaClient } from "@prisma/client";

export const createMockPrisma = () => ({
  commandLog: {
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  $connect: vi.fn(),
  $disconnect: vi.fn(),
});
```

### Redis Mocks

```typescript
import { vi } from "vitest";

export const createMockRedis = () => ({
  ping: vi.fn().mockResolvedValue("PONG"),
  set: vi.fn().mockResolvedValue("OK"),
  get: vi.fn().mockResolvedValue(null),
  del: vi.fn().mockResolvedValue(1),
});
```

## Coverage Thresholds

Current thresholds (configured in `vitest.config.ts`):
- Lines: 80%
- Functions: 80%
- Branches: 80%
- Statements: 80%

## CI/CD Integration

Tests run automatically on:
- Pull requests
- Push to main
- Manual workflow dispatch

See `.github/workflows/ci.yml` for configuration.

## Best Practices

1. **Test Naming**: Use descriptive test names that explain what is being tested
   ```typescript
   it("should return null when duration format is invalid")
   ```

2. **Arrange-Act-Assert**: Structure tests clearly
   ```typescript
   it("should calculate latency correctly", () => {
     // Arrange
     const start = 1000;
     const end = 1050;

     // Act
     const latency = end - start;

     // Assert
     expect(latency).toBe(50);
   });
   ```

3. **Mock External Dependencies**: Don't make real API calls or database operations in unit tests

4. **Test Edge Cases**: Test boundary conditions, errors, and unexpected inputs

5. **Keep Tests Fast**: Unit tests should run in milliseconds

6. **Isolate Tests**: Each test should be independent and not rely on others

## TODO: Tests to Implement

- [ ] Core module tests (config, logger, client)
- [ ] All command tests with mocked Discord API
- [ ] Event handler tests
- [ ] Queue/worker tests
- [ ] Database integration tests
- [ ] Redis integration tests
- [ ] Error handling tests
- [ ] Permission validation tests
- [ ] Rate limiting tests (when implemented)
- [ ] Middleware tests (when implemented)

## Troubleshooting

### Tests failing with "Cannot find package"

This is a pnpm workspace + vitest issue. Solutions:
1. Run tests from root: `pnpm test`
2. Use `--shamefully-hoist` when installing
3. Switch to different test runner (Jest)

### Tests timing out

Increase timeout in vitest.config.ts:
```typescript
testTimeout: 30000, // 30 seconds
```

### Coverage not updating

Clear coverage cache:
```bash
rm -rf coverage
npm run test:coverage
```
