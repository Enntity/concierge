/**
 * Tests for pulse-build.js — Life Loop Invocation Logic
 *
 * Tests cover:
 * - buildWakePrompt: unified wake prompt generation (scheduled, continue, recovery)
 * - isInActiveHours: active hours window checks
 * - setPulseTaskContext / getPersistedTaskContext: Redis task context persistence
 * - cleanupStuckPulseLogs: stuck log recovery
 * - acquirePulseLock / releasePulseLock: per-entity lock mechanics
 * - checkDailyBudget: daily budget tracking
 */

// --- Mock setup ---
// jest.mock factories run during the hoisted import phase, before var
// initialisations execute.  For ioredis the factory returns a constructor
// that lazily captures mockRedis — so by the time getRedisClient() is
// called in a test, mockRedis is initialised.  For PulseLog we must
// build the mock inline inside the factory (the default export is
// evaluated eagerly).

var mockRedis = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    expire: jest.fn(),
    hgetall: jest.fn(),
    hincrby: jest.fn(),
    hget: jest.fn(),
    scan: jest.fn().mockResolvedValue(["0", []]),
};

jest.mock("ioredis", () => jest.fn(() => mockRedis));

jest.mock("../../app/api/models/pulseLog.mjs", () => ({
    __esModule: true,
    default: {
        create: jest.fn(),
        find: jest.fn(),
        findOne: jest.fn(),
        findByIdAndUpdate: jest.fn(),
    },
}));

jest.mock("../graphql.mjs", () => ({
    __esModule: true,
    QUERIES: { SYS_ENTITY_AGENT: "mock-query" },
    getClient: jest.fn(),
}));

jest.mock("mongodb", () => ({
    MongoClient: jest.fn(() => ({
        connect: jest.fn(),
        db: jest.fn(),
    })),
}));

jest.mock("mongoose", () => ({
    __esModule: true,
    default: { connection: { db: null } },
}));

// --- Imports ---

import {
    buildWakePrompt,
    isInActiveHours,
    getPersistedTaskContext,
    setPulseTaskContext,
    cleanupStuckPulseLogs,
    acquirePulseLock,
    releasePulseLock,
    refreshPulseLock,
    checkDailyBudget,
} from "../pulse-build.js";

import PulseLog from "../../app/api/models/pulseLog.mjs";

// --- Tests ---

beforeEach(() => {
    jest.clearAllMocks();
});

// ===== buildWakePrompt =====

describe("buildWakePrompt", () => {
    const baseEntity = {
        name: "TestEntity",
        workspace: { url: "https://workspace.test/abc" },
    };

    const baseOptions = {
        wakeType: "scheduled",
        chainDepth: 0,
        maxChainDepth: 10,
        taskContext: null,
        lastWakeTime: null,
        compass: null,
        recoveryNotice: false,
    };

    test("scheduled wake includes PULSE WAKE header without cycle", () => {
        const prompt = buildWakePrompt(baseEntity, baseOptions);
        expect(prompt).toMatch(/\[PULSE WAKE —/);
        expect(prompt).not.toMatch(/cycle/);
    });

    test("continue wake includes cycle info in header", () => {
        const prompt = buildWakePrompt(baseEntity, {
            ...baseOptions,
            wakeType: "continue",
            chainDepth: 2,
            maxChainDepth: 10,
        });
        expect(prompt).toMatch(/\[PULSE WAKE —.*— cycle 3 of up to 10\]/);
        expect(prompt).toMatch(/continuing from your previous cycle/);
    });

    test("includes workspace URL when present", () => {
        const prompt = buildWakePrompt(baseEntity, baseOptions);
        expect(prompt).toContain("https://workspace.test/abc");
    });

    test("omits workspace URL when not present", () => {
        const prompt = buildWakePrompt({ name: "NoWorkspace" }, baseOptions);
        expect(prompt).not.toContain("workspace is available");
    });

    test("includes compass when provided", () => {
        const prompt = buildWakePrompt(baseEntity, {
            ...baseOptions,
            compass: "Focus on the creative writing project.",
        });
        expect(prompt).toContain("[Your Internal Compass]");
        expect(prompt).toContain("Focus on the creative writing project.");
    });

    test("includes task context when provided", () => {
        const prompt = buildWakePrompt(baseEntity, {
            ...baseOptions,
            taskContext: "Working on chapter 3 of the story.",
        });
        expect(prompt).toContain("You left yourself a note:");
        expect(prompt).toContain("Working on chapter 3 of the story.");
    });

    test("includes recovery notice when set", () => {
        const prompt = buildWakePrompt(baseEntity, {
            ...baseOptions,
            recoveryNotice: true,
        });
        expect(prompt).toContain("previous cycle ended unexpectedly");
    });

    test("omits recovery notice when not set", () => {
        const prompt = buildWakePrompt(baseEntity, baseOptions);
        expect(prompt).not.toContain("unexpectedly");
    });

    test("formats time since last wake in minutes", () => {
        const thirtyMinAgo = new Date(
            Date.now() - 30 * 60 * 1000,
        ).toISOString();
        const prompt = buildWakePrompt(baseEntity, {
            ...baseOptions,
            lastWakeTime: thirtyMinAgo,
        });
        expect(prompt).toMatch(/You last woke 30 minutes ago/);
    });

    test("formats time since last wake in hours", () => {
        const twoHoursAgo = new Date(
            Date.now() - 2 * 60 * 60 * 1000,
        ).toISOString();
        const prompt = buildWakePrompt(baseEntity, {
            ...baseOptions,
            lastWakeTime: twoHoursAgo,
        });
        expect(prompt).toMatch(/You last woke 2 hours ago/);
    });

    test("formats time since last wake in hours and minutes", () => {
        const ninetyMinAgo = new Date(
            Date.now() - 90 * 60 * 1000,
        ).toISOString();
        const prompt = buildWakePrompt(baseEntity, {
            ...baseOptions,
            lastWakeTime: ninetyMinAgo,
        });
        expect(prompt).toMatch(/You last woke 1 hour and 30 minutes ago/);
    });

    test("shows unknown when no last wake time", () => {
        const prompt = buildWakePrompt(baseEntity, baseOptions);
        expect(prompt).toContain("You last woke unknown ago");
    });

    test("continue wake gets full context (compass, workspace, taskContext)", () => {
        const prompt = buildWakePrompt(baseEntity, {
            ...baseOptions,
            wakeType: "continue",
            chainDepth: 1,
            compass: "Stay focused on the API refactor.",
            taskContext: "Halfway through endpoint migration.",
        });
        expect(prompt).toContain("https://workspace.test/abc");
        expect(prompt).toContain("[Your Internal Compass]");
        expect(prompt).toContain("Stay focused on the API refactor.");
        expect(prompt).toContain("Halfway through endpoint migration.");
    });

    test("always ends with EndPulse instruction", () => {
        const scheduled = buildWakePrompt(baseEntity, baseOptions);
        const continued = buildWakePrompt(baseEntity, {
            ...baseOptions,
            wakeType: "continue",
            chainDepth: 1,
        });
        expect(scheduled).toContain("Use EndPulse when you're done");
        expect(continued).toContain("Use EndPulse when you're done");
    });

    test("1 minute shows singular form", () => {
        const oneMinAgo = new Date(Date.now() - 60 * 1000).toISOString();
        const prompt = buildWakePrompt(baseEntity, {
            ...baseOptions,
            lastWakeTime: oneMinAgo,
        });
        expect(prompt).toMatch(/You last woke 1 minute ago/);
    });
});

// ===== isInActiveHours =====

describe("isInActiveHours", () => {
    test("returns true when no activeHours configured", () => {
        expect(isInActiveHours({})).toBe(true);
    });

    test("returns true when activeHours has no start/end", () => {
        expect(isInActiveHours({ activeHours: {} })).toBe(true);
        expect(isInActiveHours({ activeHours: { start: "09:00" } })).toBe(true);
        expect(isInActiveHours({ activeHours: { end: "17:00" } })).toBe(true);
    });

    test("returns true for all-day window", () => {
        const result = isInActiveHours({
            activeHours: { start: "00:00", end: "23:59", tz: "UTC" },
        });
        expect(result).toBe(true);
    });
});

// ===== setPulseTaskContext / getPersistedTaskContext =====

describe("setPulseTaskContext & getPersistedTaskContext", () => {
    test("persists text with 24h TTL", async () => {
        await setPulseTaskContext("entity-1", "Working on chapter 3");
        expect(mockRedis.set).toHaveBeenCalledWith(
            "continuity:pulse:entity-1:taskContext",
            "Working on chapter 3",
            "EX",
            86400,
        );
    });

    test("deletes key when text is null", async () => {
        await setPulseTaskContext("entity-1", null);
        expect(mockRedis.del).toHaveBeenCalledWith(
            "continuity:pulse:entity-1:taskContext",
        );
        expect(mockRedis.set).not.toHaveBeenCalled();
    });

    test("deletes key when text is empty string", async () => {
        await setPulseTaskContext("entity-1", "");
        expect(mockRedis.del).toHaveBeenCalledWith(
            "continuity:pulse:entity-1:taskContext",
        );
    });

    test("reads persisted context from Redis", async () => {
        mockRedis.get.mockResolvedValue("Resume API work");
        const result = await getPersistedTaskContext("entity-1");
        expect(result).toBe("Resume API work");
        expect(mockRedis.get).toHaveBeenCalledWith(
            "continuity:pulse:entity-1:taskContext",
        );
    });

    test("returns null when no persisted context", async () => {
        mockRedis.get.mockResolvedValue(null);
        const result = await getPersistedTaskContext("entity-1");
        expect(result).toBeNull();
    });
});

// ===== cleanupStuckPulseLogs =====

describe("cleanupStuckPulseLogs", () => {
    test("marks stuck logs as failed with crash_recovery signal", async () => {
        const stuckLog = {
            _id: "log-1",
            entityId: "entity-1",
            status: "in_progress",
            taskContext: null,
            createdAt: new Date(Date.now() - 20 * 60 * 1000),
        };
        PulseLog.find.mockResolvedValue([stuckLog]);

        await cleanupStuckPulseLogs("entity-1");

        expect(PulseLog.findByIdAndUpdate).toHaveBeenCalledWith(
            "log-1",
            expect.objectContaining({
                status: "failed",
                endSignal: "crash_recovery",
                error: expect.stringContaining("stuck in_progress"),
            }),
        );
    });

    test("recovers taskContext from stuck log", async () => {
        const stuckLog = {
            _id: "log-2",
            taskContext: "Was working on the API refactor",
            createdAt: new Date(Date.now() - 30 * 60 * 1000),
        };
        PulseLog.find.mockResolvedValue([stuckLog]);

        const recovered = await cleanupStuckPulseLogs("entity-1");
        expect(recovered).toBe("Was working on the API refactor");
    });

    test("recovers only the first taskContext from multiple stuck logs", async () => {
        PulseLog.find.mockResolvedValue([
            {
                _id: "a",
                taskContext: "First",
                createdAt: new Date(Date.now() - 25 * 60 * 1000),
            },
            {
                _id: "b",
                taskContext: "Second",
                createdAt: new Date(Date.now() - 20 * 60 * 1000),
            },
        ]);

        const recovered = await cleanupStuckPulseLogs("entity-1");
        expect(recovered).toBe("First");
        expect(PulseLog.findByIdAndUpdate).toHaveBeenCalledTimes(2);
    });

    test("returns null when no stuck logs exist", async () => {
        PulseLog.find.mockResolvedValue([]);

        const recovered = await cleanupStuckPulseLogs("entity-1");
        expect(recovered).toBeNull();
        expect(PulseLog.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    test("returns null when stuck logs have no taskContext", async () => {
        PulseLog.find.mockResolvedValue([
            {
                _id: "x",
                taskContext: null,
                createdAt: new Date(Date.now() - 20 * 60 * 1000),
            },
        ]);

        const recovered = await cleanupStuckPulseLogs("entity-1");
        expect(recovered).toBeNull();
    });

    test("queries for in_progress logs older than 15 minutes", async () => {
        PulseLog.find.mockResolvedValue([]);
        await cleanupStuckPulseLogs("entity-1");

        expect(PulseLog.find).toHaveBeenCalledWith({
            entityId: "entity-1",
            status: "in_progress",
            createdAt: { $lt: expect.any(Date) },
        });

        const cutoff = PulseLog.find.mock.calls[0][0].createdAt.$lt;
        const elapsed = Date.now() - cutoff.getTime();
        expect(elapsed).toBeGreaterThanOrEqual(14 * 60 * 1000);
        expect(elapsed).toBeLessThanOrEqual(16 * 60 * 1000);
    });
});

// ===== pulse lock mechanics =====

describe("pulse lock mechanics", () => {
    test("acquirePulseLock uses NX with 15min TTL", async () => {
        mockRedis.set.mockResolvedValue("OK");
        const acquired = await acquirePulseLock("entity-1");

        expect(acquired).toBe(true);
        expect(mockRedis.set).toHaveBeenCalledWith(
            "continuity:pulse:entity-1:active",
            expect.any(String),
            "NX",
            "EX",
            900,
        );
    });

    test("acquirePulseLock returns false when lock exists", async () => {
        mockRedis.set.mockResolvedValue(null);
        expect(await acquirePulseLock("entity-1")).toBe(false);
    });

    test("releasePulseLock deletes the lock key", async () => {
        await releasePulseLock("entity-1");
        expect(mockRedis.del).toHaveBeenCalledWith(
            "continuity:pulse:entity-1:active",
        );
    });

    test("refreshPulseLock extends TTL to 15min", async () => {
        await refreshPulseLock("entity-1");
        expect(mockRedis.expire).toHaveBeenCalledWith(
            "continuity:pulse:entity-1:active",
            900,
        );
    });
});

// ===== checkDailyBudget =====

describe("checkDailyBudget", () => {
    test("not exhausted when under limits", async () => {
        mockRedis.hgetall.mockResolvedValue({ wakes: "5", tokens: "10000" });
        const result = await checkDailyBudget("entity-1", {});
        expect(result.exhausted).toBe(false);
        expect(result.wakes).toBe(5);
        expect(result.tokens).toBe(10000);
    });

    test("exhausted when wakes at limit", async () => {
        mockRedis.hgetall.mockResolvedValue({ wakes: "96", tokens: "0" });
        expect((await checkDailyBudget("entity-1", {})).exhausted).toBe(true);
    });

    test("exhausted when tokens at limit", async () => {
        mockRedis.hgetall.mockResolvedValue({ wakes: "0", tokens: "500000" });
        expect((await checkDailyBudget("entity-1", {})).exhausted).toBe(true);
    });

    test("uses custom limits from pulse config", async () => {
        mockRedis.hgetall.mockResolvedValue({ wakes: "10", tokens: "100000" });
        const result = await checkDailyBudget("entity-1", {
            dailyBudgetWakes: 5,
            dailyBudgetTokens: 50000,
        });
        expect(result.exhausted).toBe(true);
    });

    test("handles empty Redis response (zero counters)", async () => {
        mockRedis.hgetall.mockResolvedValue({});
        const result = await checkDailyBudget("entity-1", {});
        expect(result).toEqual({ exhausted: false, wakes: 0, tokens: 0 });
    });
});
