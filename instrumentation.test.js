import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import LLM from "./app/api/models/llm";
import { seed } from "./instrumentation";
import config from "./config/index";

let mongoServer;
let originalConsole;

beforeAll(async () => {
    // Mock console methods
    originalConsole = {
        log: console.log,
        warn: console.warn,
        error: console.error,
    };
    console.log = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();

    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
});

afterAll(async () => {
    // Restore console methods
    console.log = originalConsole.log;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;

    await mongoose.disconnect();
    await mongoServer.stop();
});

beforeEach(async () => {
    await LLM.deleteMany({});
});

describe("LLM Initialization", () => {
    test("should migrate LLMs without identifiers", async () => {
        // Create an LLM without identifier
        const llmWithoutIdentifier = await LLM.create({
            name: "Test LLM",
            cortexModelName: "oai-gpt4o",
            cortexPathwayName: "run_workspace_prompt",
            isDefault: false,
            identifier: null,
        });

        await seed();

        const updatedLLM = await LLM.findById(llmWithoutIdentifier._id);
        expect(updatedLLM.identifier).toBe("gpt4o");
    });

    test("should upsert LLMs from config", async () => {
        await seed();

        const llms = await LLM.find({});
        expect(llms.length).toBe(config.data.llms.length);

        // Verify default LLM exists
        const defaultLLM = await LLM.findOne({ isDefault: true });
        expect(defaultLLM).toBeTruthy();
        expect(defaultLLM.identifier).toBe("gpt4o");
    });

    test("should delete LLMs missing from config", async () => {
        // Create an LLM that doesn't exist in config
        const obsoleteLLM = await LLM.create({
            name: "Obsolete LLM",
            cortexModelName: "obsolete-model",
            cortexPathwayName: "run_workspace_prompt",
            identifier: "obsolete",
            isDefault: false,
        });

        await seed();

        // Verify obsolete LLM was deleted
        const deletedLLM = await LLM.findById(obsoleteLLM._id);
        expect(deletedLLM).toBeNull();
    });

    test("should correctly match config LLM with database LLM using cortexModelName", async () => {
        // Ensure we have multiple LLMs in config to test against
        expect(config.data.llms.length).toBeGreaterThan(1);

        // Find a non-first LLM from config to test against
        const targetConfigLLM = config.data.llms[1]; // Use second LLM in config

        // Create an LLM without identifier but with matching cortexModelName
        const llmWithoutIdentifier = await LLM.create({
            name: "Test LLM",
            cortexModelName: targetConfigLLM.cortexModelName,
            cortexPathwayName: targetConfigLLM.cortexPathwayName,
            isDefault: false,
            identifier: null,
        });

        await seed();

        // Verify the LLM was updated with correct identifier from config
        const updatedLLM = await LLM.findById(llmWithoutIdentifier._id);
        expect(updatedLLM.identifier).toBe(targetConfigLLM.identifier);
    });
});
