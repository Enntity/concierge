const DEFAULT_IMAGE_FALLBACK = {
    type: "image",
    quality: "high",
    aspectRatio: "1:1",
};

const DEFAULT_VIDEO_FALLBACK = {
    type: "video",
    aspectRatio: "16:9",
    duration: 5,
    generateAudio: false,
    resolution: "1080p",
    cameraFixed: false,
};

const buildDefaultSettings = (mediaModels = []) => {
    const models = {};
    for (const model of mediaModels) {
        models[model.modelId] = {
            type: model.category,
            ...(model.mediaDefaults || {}),
        };
    }
    return models;
};

const remapModelId = (modelId, redirects = {}) => redirects[modelId] || modelId;

const remapModelSettings = (models = {}, redirects = {}) => {
    const remapped = {};

    for (const [modelId, value] of Object.entries(models)) {
        remapped[remapModelId(modelId, redirects)] = value;
    }

    return remapped;
};

export const getModelSettings = (settings, modelName, mediaModels = []) => {
    if (settings?.models?.[modelName]) {
        return settings.models[modelName];
    }

    const apiModel = mediaModels.find((model) => model.modelId === modelName);
    if (apiModel?.mediaDefaults) {
        return {
            type: apiModel.category,
            ...apiModel.mediaDefaults,
        };
    }

    return DEFAULT_IMAGE_FALLBACK;
};

export const getModelDisplayName = (modelName, mediaModels = []) => {
    const apiModel = mediaModels.find((model) => model.modelId === modelName);
    return apiModel?.displayName || modelName;
};

export const getModelType = (modelName, settings = {}, mediaModels = []) => {
    if (settings?.models?.[modelName]?.type) {
        return settings.models[modelName].type;
    }

    const apiModel = mediaModels.find((model) => model.modelId === modelName);
    return apiModel?.category || "image";
};

export const groupAndSortModels = (
    models,
    settings,
    mediaModels = [],
) => {
    const image = [];
    const video = [];

    for (const modelName of models) {
        const type = getModelType(modelName, settings, mediaModels);
        if (type === "video") {
            video.push(modelName);
        } else {
            image.push(modelName);
        }
    }

    const sortByDisplayName = (a, b) =>
        getModelDisplayName(a, mediaModels).localeCompare(
            getModelDisplayName(b, mediaModels),
        );

    image.sort(sortByDisplayName);
    video.sort(sortByDisplayName);

    return { image, video };
};

export const getAvailableAspectRatios = (modelName, mediaModels = []) => {
    const apiModel = mediaModels.find((model) => model.modelId === modelName);
    return (apiModel?.availableAspectRatios || []).map((ratio) => ({
        value: ratio,
        label: ratio === "match_input_image" ? "Match Input Image" : ratio,
    }));
};

export const getAvailableDurations = (modelName, mediaModels = []) => {
    const apiModel = mediaModels.find((model) => model.modelId === modelName);
    return (apiModel?.availableDurations || []).map((duration) => ({
        value: duration,
        label: `${duration}s`,
    }));
};

export const mergeNewModels = (
    existingSettings = {},
    mediaModels = [],
    redirects = {},
) => {
    if (!mediaModels.length) return existingSettings;

    const apiDefaults = buildDefaultSettings(mediaModels);
    const apiIds = new Set(mediaModels.map((model) => model.modelId));
    const remappedModels = remapModelSettings(existingSettings.models, redirects);
    const cleanedModels = {};

    for (const [modelId, value] of Object.entries(remappedModels)) {
        if (apiIds.has(modelId)) {
            cleanedModels[modelId] = value;
        }
    }

    return {
        ...existingSettings,
        models: {
            ...apiDefaults,
            ...cleanedModels,
        },
    };
};

export const migrateSettings = (oldSettings = {}, redirects = {}) => {
    if (oldSettings.models) {
        return {
            ...oldSettings,
            models: remapModelSettings(oldSettings.models, redirects),
            image: oldSettings.image,
            video: oldSettings.video,
        };
    }

    const imageDefaultModel = remapModelId(
        oldSettings.image?.defaultModel || "gemini-flash-31-image",
        redirects,
    );
    const videoDefaultModel = remapModelId(
        oldSettings.video?.defaultModel || "replicate-seedance-1.5-pro",
        redirects,
    );

    return {
        models: {},
        image: {
            defaultQuality: oldSettings.image?.defaultQuality || "high",
            defaultModel: imageDefaultModel,
            defaultAspectRatio: oldSettings.image?.defaultAspectRatio || "1:1",
        },
        video: {
            defaultModel: videoDefaultModel,
            defaultAspectRatio: oldSettings.video?.defaultAspectRatio || "16:9",
            defaultDuration: oldSettings.video?.defaultDuration || 5,
            defaultGenerateAudio:
                oldSettings.video?.defaultGenerateAudio || false,
            defaultResolution:
                oldSettings.video?.defaultResolution || "1080p",
            defaultCameraFixed:
                oldSettings.video?.defaultCameraFixed || false,
        },
    };
};

export const getDefaultModelForType = (mediaModels = [], type = "image") => {
    const defaultModel = mediaModels.find(
        (model) => model.category === type && model.isDefault,
    );
    if (defaultModel) return defaultModel.modelId;

    const firstMatch = mediaModels.find((model) => model.category === type);
    return firstMatch?.modelId;
};
