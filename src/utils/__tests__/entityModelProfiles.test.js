import {
    buildEntityModelPolicyFromProfile,
    getFallbackModelProfiles,
    getResolvedModelProfiles,
} from "../entityModelProfiles";

const AVAILABLE_MODELS = [
    { modelId: "gemini-flash-3-vision" },
    { modelId: "gemini-flash-31-lite-vision" },
    { modelId: "claude-46-sonnet" },
    { modelId: "claude-45-haiku" },
];

describe("entityModelProfiles", () => {
    test("includes the builtin Gemini profile with Gemini flash model routing", () => {
        const profiles = getFallbackModelProfiles({ models: AVAILABLE_MODELS });
        const geminiProfile = profiles.find(
            (profile) => profile.slug === "gemini",
        );

        expect(geminiProfile).toBeTruthy();
        expect(geminiProfile.name).toBe("Gemini");
        expect(geminiProfile.modelPolicy).toEqual({
            primaryModel: "gemini-flash-3-vision",
            orientationModel: "gemini-flash-3-vision",
            planningModel: "gemini-flash-3-vision",
            researchModel: "gemini-flash-31-lite-vision",
            childModel: "gemini-flash-31-lite-vision",
            synthesisModel: "gemini-flash-3-vision",
            synthesisReasoningEffort: "high",
            verificationModel: "gemini-flash-3-vision",
            compressionModel: "gemini-flash-31-lite-vision",
            routingModel: "gemini-flash-31-lite-vision",
        });
    });

    test("buildEntityModelPolicyFromProfile preserves the Gemini builtin profile id", () => {
        const geminiProfile = getResolvedModelProfiles([], {
            models: AVAILABLE_MODELS,
        }).find((profile) => profile.slug === "gemini");

        expect(buildEntityModelPolicyFromProfile(geminiProfile)).toEqual({
            profileId: "gemini",
            primaryModel: "gemini-flash-3-vision",
            orientationModel: "gemini-flash-3-vision",
            planningModel: "gemini-flash-3-vision",
            researchModel: "gemini-flash-31-lite-vision",
            childModel: "gemini-flash-31-lite-vision",
            synthesisModel: "gemini-flash-3-vision",
            synthesisReasoningEffort: "high",
            verificationModel: "gemini-flash-3-vision",
            compressionModel: "gemini-flash-31-lite-vision",
            routingModel: "gemini-flash-31-lite-vision",
        });
    });

    test("includes the builtin Claude profile with Sonnet 4.6 + Haiku routing", () => {
        const profiles = getFallbackModelProfiles({ models: AVAILABLE_MODELS });
        const claudeProfile = profiles.find(
            (profile) => profile.slug === "claude",
        );

        expect(claudeProfile).toBeTruthy();
        expect(claudeProfile.name).toBe("Claude");
        expect(claudeProfile.modelPolicy).toEqual({
            primaryModel: "claude-46-sonnet",
            orientationModel: "claude-46-sonnet",
            planningModel: "claude-46-sonnet",
            researchModel: "claude-45-haiku",
            childModel: "claude-45-haiku",
            synthesisModel: "claude-46-sonnet",
            verificationModel: "claude-46-sonnet",
            compressionModel: "claude-45-haiku",
            routingModel: "claude-45-haiku",
        });
    });

    test("buildEntityModelPolicyFromProfile preserves the Claude builtin profile id", () => {
        const claudeProfile = getResolvedModelProfiles([], {
            models: AVAILABLE_MODELS,
        }).find((profile) => profile.slug === "claude");

        expect(buildEntityModelPolicyFromProfile(claudeProfile)).toEqual({
            profileId: "claude",
            primaryModel: "claude-46-sonnet",
            orientationModel: "claude-46-sonnet",
            planningModel: "claude-46-sonnet",
            researchModel: "claude-45-haiku",
            childModel: "claude-45-haiku",
            synthesisModel: "claude-46-sonnet",
            verificationModel: "claude-46-sonnet",
            compressionModel: "claude-45-haiku",
            routingModel: "claude-45-haiku",
        });
    });
});
