export const CUSTOM_MODEL_PROFILE_ID = "custom";
export const DEFAULT_MODEL_PROFILE_ID = "balanced";

export const MODEL_POLICY_KEYS = [
    "primaryModel",
    "orientationModel",
    "planningModel",
    "researchModel",
    "childModel",
    "synthesisModel",
    "verificationModel",
    "compressionModel",
    "routingModel",
];

export const MODEL_POLICY_REASONING_KEYS = [
    "primaryReasoningEffort",
    "orientationReasoningEffort",
    "planningReasoningEffort",
    "researchReasoningEffort",
    "childReasoningEffort",
    "synthesisReasoningEffort",
    "verificationReasoningEffort",
    "compressionReasoningEffort",
    "routingReasoningEffort",
];

function normalizeReasoningEffort(value) {
    const normalized = String(value || "")
        .trim()
        .toLowerCase();
    return ["none", "low", "medium", "high"].includes(normalized)
        ? normalized
        : null;
}

const DEFAULT_MODEL_PROFILE_TEMPLATES = [
    {
        slug: "balanced",
        name: "Balanced",
        description:
            "High-quality replies with cheaper routing, research, and background work.",
        candidates: {
            primaryModel: ["oai-gpt54", "oai-gpt52", "oai-gpt41"],
            orientationModel: ["oai-gpt54", "oai-gpt52", "oai-gpt41"],
            planningModel: ["oai-gpt54", "oai-gpt52", "oai-gpt41"],
            researchModel: ["oai-gpt54-mini", "oai-gpt41-nano"],
            childModel: ["oai-gpt54-mini", "oai-gpt41-nano"],
            synthesisModel: ["oai-gpt54", "oai-gpt52", "oai-gpt41"],
            verificationModel: ["oai-gpt54", "oai-gpt52", "oai-gpt41"],
            compressionModel: ["oai-gpt54-mini", "oai-gpt41-nano"],
            routingModel: ["oai-gpt54-mini", "oai-gpt41-nano"],
        },
    },
    {
        slug: "fast",
        name: "Fast",
        description:
            "Keeps every stage on the lighter runtime models for lower latency and cost.",
        candidates: {
            primaryModel: ["oai-gpt54-mini", "oai-gpt41-nano"],
            orientationModel: ["oai-gpt54-mini", "oai-gpt41-nano"],
            planningModel: ["oai-gpt54-mini", "oai-gpt41-nano"],
            researchModel: ["oai-gpt54-mini", "oai-gpt41-nano"],
            childModel: ["oai-gpt54-mini", "oai-gpt41-nano"],
            synthesisModel: ["oai-gpt54-mini", "oai-gpt41-nano"],
            verificationModel: ["oai-gpt54-mini", "oai-gpt41-nano"],
            compressionModel: ["oai-gpt54-mini", "oai-gpt41-nano"],
            routingModel: ["oai-gpt54-mini", "oai-gpt41-nano"],
        },
    },
    {
        slug: "quality",
        name: "Quality",
        description:
            "Pushes planning, research, synthesis, and verification onto the strongest available model.",
        candidates: {
            primaryModel: ["oai-gpt54", "oai-gpt52", "oai-gpt41"],
            orientationModel: ["oai-gpt54", "oai-gpt52", "oai-gpt41"],
            planningModel: ["oai-gpt54", "oai-gpt52", "oai-gpt41"],
            researchModel: ["oai-gpt54", "oai-gpt52", "oai-gpt41"],
            childModel: ["oai-gpt54-mini", "oai-gpt41-nano"],
            synthesisModel: ["oai-gpt54", "oai-gpt52", "oai-gpt41"],
            verificationModel: ["oai-gpt54", "oai-gpt52", "oai-gpt41"],
            compressionModel: ["oai-gpt54-mini", "oai-gpt41-nano"],
            routingModel: ["oai-gpt54-mini", "oai-gpt41-nano"],
        },
    },
    {
        slug: "gemini",
        name: "Gemini",
        description:
            "Uses Gemini 3 Flash for core replies and Gemini 3.1 Flash Lite for routing and background work.",
        candidates: {
            primaryModel: ["gemini-flash-3-vision"],
            orientationModel: ["gemini-flash-3-vision"],
            planningModel: ["gemini-flash-3-vision"],
            researchModel: ["gemini-flash-31-lite-vision"],
            childModel: ["gemini-flash-31-lite-vision"],
            synthesisModel: ["gemini-flash-3-vision"],
            verificationModel: ["gemini-flash-3-vision"],
            compressionModel: ["gemini-flash-31-lite-vision"],
            routingModel: ["gemini-flash-31-lite-vision"],
        },
        reasoning: {
            synthesisReasoningEffort: "high",
        },
    },
    {
        slug: "claude",
        name: "Claude",
        description:
            "Uses Claude Sonnet 4.6 for core replies and Claude Haiku for routing and background work.",
        candidates: {
            primaryModel: ["claude-46-sonnet"],
            orientationModel: ["claude-46-sonnet"],
            planningModel: ["claude-46-sonnet"],
            researchModel: ["claude-46-haiku", "claude-45-haiku"],
            childModel: ["claude-46-haiku", "claude-45-haiku"],
            synthesisModel: ["claude-46-sonnet"],
            verificationModel: ["claude-46-sonnet"],
            compressionModel: ["claude-46-haiku", "claude-45-haiku"],
            routingModel: ["claude-46-haiku", "claude-45-haiku"],
        },
    },
    {
        slug: "nsfw",
        name: "NSFW",
        description:
            "Reserved autoswap profile used when the conversation mode enters NSFW.",
        candidates: {
            primaryModel: [
                "xai-grok-4-20-0309-non-reasoning",
                "xai-grok-4-20-0309-reasoning",
                "xai-grok-4-responses",
            ],
            orientationModel: [
                "xai-grok-4-20-0309-non-reasoning",
                "xai-grok-4-20-0309-reasoning",
                "xai-grok-4-responses",
            ],
            planningModel: [
                "xai-grok-4-20-0309-non-reasoning",
                "xai-grok-4-20-0309-reasoning",
                "xai-grok-4-responses",
            ],
            researchModel: [
                "xai-grok-4-20-0309-non-reasoning",
                "xai-grok-4-20-0309-reasoning",
                "xai-grok-4-responses",
            ],
            childModel: [
                "xai-grok-4-20-0309-non-reasoning",
                "xai-grok-4-20-0309-reasoning",
                "xai-grok-4-responses",
            ],
            synthesisModel: [
                "xai-grok-4-20-0309-non-reasoning",
                "xai-grok-4-20-0309-reasoning",
                "xai-grok-4-responses",
            ],
            verificationModel: [
                "xai-grok-4-20-0309-non-reasoning",
                "xai-grok-4-20-0309-reasoning",
                "xai-grok-4-responses",
            ],
            compressionModel: [
                "xai-grok-4-20-0309-non-reasoning",
                "xai-grok-4-20-0309-reasoning",
                "xai-grok-4-responses",
            ],
            routingModel: [
                "xai-grok-4-20-0309-non-reasoning",
                "xai-grok-4-20-0309-reasoning",
                "xai-grok-4-responses",
            ],
        },
    },
];

function resolveModelId(
    modelId,
    models,
    redirects,
    { allowFallback = true } = {},
) {
    if (!models?.length) return modelId;

    if (modelId && models.some((model) => model.modelId === modelId)) {
        return modelId;
    }

    const redirected = redirects?.[modelId];
    if (redirected && models.some((model) => model.modelId === redirected)) {
        return redirected;
    }

    if (!allowFallback) {
        return null;
    }

    const defaultModel = models.find((model) => model.isDefault);
    return defaultModel?.modelId || models[0]?.modelId || modelId;
}

export function normalizeModelPolicy(modelPolicy = {}) {
    const normalized = {};
    for (const key of MODEL_POLICY_KEYS) {
        if (typeof modelPolicy?.[key] === "string" && modelPolicy[key]) {
            normalized[key] = modelPolicy[key];
        }
    }
    for (const key of MODEL_POLICY_REASONING_KEYS) {
        const normalizedEffort = normalizeReasoningEffort(modelPolicy?.[key]);
        if (normalizedEffort) {
            normalized[key] = normalizedEffort;
        }
    }
    return normalized;
}

function resolveTemplatePolicy(template = {}, { models, redirects } = {}) {
    const resolved = {};
    const candidates = template?.candidates || {};
    const reasoning = template?.reasoning || {};

    for (const key of MODEL_POLICY_KEYS) {
        const slotCandidates = Array.isArray(candidates[key])
            ? candidates[key]
            : [];
        for (const candidate of slotCandidates) {
            const resolvedCandidate = resolveModelId(
                candidate,
                models,
                redirects,
                { allowFallback: false },
            );
            if (resolvedCandidate) {
                resolved[key] = resolvedCandidate;
                break;
            }
        }
        if (!resolved[key] && slotCandidates.length > 0) {
            resolved[key] = resolveModelId(
                slotCandidates[0],
                models,
                redirects,
            );
        }
    }

    for (const key of MODEL_POLICY_REASONING_KEYS) {
        const normalizedEffort = normalizeReasoningEffort(reasoning[key]);
        if (normalizedEffort) {
            resolved[key] = normalizedEffort;
        }
    }

    return resolved;
}

function normalizeProfile(profile = {}) {
    const slug = String(profile.slug || profile.id || "").trim();
    return {
        id: profile._id?.toString?.() || profile.id || slug,
        slug,
        name: String(profile.name || "").trim(),
        description: String(profile.description || "").trim(),
        isDefault: profile.isDefault === true,
        modelPolicy: normalizeModelPolicy(profile.modelPolicy || {}),
    };
}

export function getFallbackModelProfiles(options = {}) {
    return DEFAULT_MODEL_PROFILE_TEMPLATES.map((template) => ({
        id: template.slug,
        slug: template.slug,
        name: template.name,
        description: template.description,
        isDefault: template.slug === DEFAULT_MODEL_PROFILE_ID,
        modelPolicy: resolveTemplatePolicy(template, options),
    }));
}

export function getResolvedModelProfiles(profiles, options = {}) {
    const source =
        Array.isArray(profiles) && profiles.length > 0
            ? profiles.map((profile) => normalizeProfile(profile))
            : getFallbackModelProfiles(options);

    return [...source].sort((a, b) => {
        if (a.isDefault === b.isDefault) {
            return a.name.localeCompare(b.name, "en", { sensitivity: "base" });
        }
        return a.isDefault ? -1 : 1;
    });
}

export function getDefaultModelProfileId(profiles, options = {}) {
    const resolvedProfiles = getResolvedModelProfiles(profiles, options);
    return (
        resolvedProfiles.find((profile) => profile.isDefault)?.slug ||
        DEFAULT_MODEL_PROFILE_ID
    );
}

export function buildEntityModelPolicyFromProfile(profile) {
    if (!profile) return null;

    const normalized = normalizeProfile(profile);
    if (!normalized.slug) return null;

    return {
        profileId: normalized.slug,
        ...normalized.modelPolicy,
    };
}

export function getEntityModelProfileId(modelPolicy, profiles, options = {}) {
    const resolvedProfiles = getResolvedModelProfiles(profiles, options);
    const defaultProfileId = getDefaultModelProfileId(profiles, options);

    if (!modelPolicy || typeof modelPolicy !== "object") {
        return defaultProfileId;
    }

    if (
        typeof modelPolicy.profileId === "string" &&
        resolvedProfiles.some(
            (profile) => profile.slug === modelPolicy.profileId,
        )
    ) {
        return modelPolicy.profileId;
    }

    const normalizedPolicy = normalizeModelPolicy(modelPolicy);
    for (const profile of resolvedProfiles) {
        if (
            JSON.stringify(profile.modelPolicy) ===
            JSON.stringify(normalizedPolicy)
        ) {
            return profile.slug;
        }
    }

    return CUSTOM_MODEL_PROFILE_ID;
}
