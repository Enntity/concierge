"use client";

import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, Save, Sparkles, Star, Trash2 } from "lucide-react";
import { useAgentModels } from "../../queries/modelMetadata";
import { useModelProfiles } from "../../queries/modelProfiles";
import {
    getFallbackModelProfiles,
    MODEL_POLICY_KEYS,
} from "@/src/utils/entityModelProfiles";

const MODEL_SLOT_LABELS = {
    primaryModel: "Primary",
    orientationModel: "Orientation",
    planningModel: "Planning",
    researchModel: "Research",
    childModel: "Child",
    synthesisModel: "Synthesis",
    verificationModel: "Verification",
    compressionModel: "Compression",
    routingModel: "Routing",
};

function createDraftProfile(agentModels = []) {
    return {
        id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        slug: "",
        name: "",
        description: "",
        isDefault: false,
        persisted: false,
        modelPolicy: {
            primaryModel:
                agentModels.find((model) => model.isDefault)?.modelId || "",
        },
    };
}

function normalizeProfiles(profiles = [], persistedIds = new Set()) {
    return profiles.map((profile) => ({
        ...profile,
        persisted: persistedIds.has(profile.id),
        modelPolicy: { ...(profile.modelPolicy || {}) },
    }));
}

export default function ModelProfilesClient() {
    const { data: agentModels } = useAgentModels();
    const {
        data: storedProfiles,
        isLoading,
        refetch,
    } = useModelProfiles();
    const [profiles, setProfiles] = useState([]);
    const [savingId, setSavingId] = useState(null);
    const [deletingId, setDeletingId] = useState(null);

    useEffect(() => {
        const persistedIds = new Set(
            (storedProfiles || []).map((profile) => profile.id),
        );
        const source =
            storedProfiles?.length > 0
                ? storedProfiles
                : getFallbackModelProfiles({ models: agentModels });

        setProfiles(normalizeProfiles(source, persistedIds));
    }, [storedProfiles, agentModels]);

    const updateProfile = (profileId, patch) => {
        setProfiles((currentProfiles) =>
            currentProfiles.map((profile) =>
                profile.id === profileId
                    ? {
                          ...profile,
                          ...patch,
                          modelPolicy: patch.modelPolicy || profile.modelPolicy,
                      }
                    : profile,
            ),
        );
    };

    const updatePolicy = (profileId, key, value) => {
        setProfiles((currentProfiles) =>
            currentProfiles.map((profile) =>
                profile.id === profileId
                    ? {
                          ...profile,
                          modelPolicy: {
                              ...profile.modelPolicy,
                              [key]: value,
                          },
                      }
                    : profile,
            ),
        );
    };

    const setDefaultProfile = (profileId) => {
        setProfiles((currentProfiles) =>
            currentProfiles.map((profile) => ({
                ...profile,
                isDefault: profile.id === profileId,
            })),
        );
    };

    const validateProfile = (profile) => {
        if (!profile.slug.trim()) {
            return "Slug is required";
        }
        if (!/^[a-z0-9-]+$/.test(profile.slug.trim().toLowerCase())) {
            return "Slug must use lowercase letters, numbers, and hyphens";
        }
        if (!profile.name.trim()) {
            return "Name is required";
        }
        if (!profile.modelPolicy?.primaryModel) {
            return "Primary model is required";
        }
        return null;
    };

    const saveProfile = async (profile) => {
        const validationError = validateProfile(profile);
        if (validationError) {
            toast.error(validationError);
            return;
        }

        setSavingId(profile.id);
        try {
            const body = {
                slug: profile.slug.trim().toLowerCase(),
                name: profile.name.trim(),
                description: profile.description.trim(),
                isDefault: profile.isDefault === true,
                modelPolicy: profile.modelPolicy,
            };

            const response = await fetch(
                profile.persisted
                    ? `/api/model-profiles/${profile.id}`
                    : "/api/model-profiles",
                {
                    method: profile.persisted ? "PATCH" : "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                },
            );

            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || "Failed to save model profile");
            }

            await refetch();
            toast.success("Model profile saved");
        } catch (error) {
            console.error("Error saving model profile:", error);
            toast.error(error.message || "Failed to save model profile");
        } finally {
            setSavingId(null);
        }
    };

    const deleteProfile = async (profile) => {
        if (!profile.persisted) {
            setProfiles((currentProfiles) => {
                const remainingProfiles = currentProfiles.filter(
                    (entry) => entry.id !== profile.id,
                );
                if (
                    profile.isDefault &&
                    remainingProfiles.length > 0 &&
                    !remainingProfiles.some((entry) => entry.isDefault)
                ) {
                    remainingProfiles[0].isDefault = true;
                }
                return remainingProfiles;
            });
            return;
        }

        setDeletingId(profile.id);
        try {
            const response = await fetch(`/api/model-profiles/${profile.id}`, {
                method: "DELETE",
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(
                    result.error || "Failed to delete model profile",
                );
            }
            await refetch();
            toast.success("Model profile deleted");
        } catch (error) {
            console.error("Error deleting model profile:", error);
            toast.error(error.message || "Failed to delete model profile");
        } finally {
            setDeletingId(null);
        }
    };

    if (isLoading && profiles.length === 0) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                        Model Profiles
                    </h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Curate the stage-level model policies entities can pick
                        from.
                    </p>
                </div>
                <Button
                    onClick={() =>
                        setProfiles((currentProfiles) => [
                            ...currentProfiles,
                            createDraftProfile(agentModels),
                        ])
                    }
                    className="w-full sm:w-auto"
                >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Profile
                </Button>
            </div>

            {storedProfiles?.length === 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
                    These profiles are currently coming from the built-in
                    fallback set. Save any profile here to persist it and make
                    it editable for everyone.
                </div>
            )}

            <div className="grid gap-4">
                {profiles.map((profile) => (
                    <Card key={profile.id}>
                        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                    <CardTitle className="text-base">
                                        {profile.name || "Untitled profile"}
                                    </CardTitle>
                                    {profile.isDefault && (
                                        <Badge
                                            variant="secondary"
                                            className="gap-1"
                                        >
                                            <Star className="h-3 w-3" />
                                            Default
                                        </Badge>
                                    )}
                                    {!profile.persisted && (
                                        <Badge variant="outline">
                                            Unsaved
                                        </Badge>
                                    )}
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    type="button"
                                    variant={
                                        profile.isDefault
                                            ? "secondary"
                                            : "outline"
                                    }
                                    onClick={() => setDefaultProfile(profile.id)}
                                >
                                    <Sparkles className="mr-2 h-4 w-4" />
                                    Set Default
                                </Button>
                                <Button
                                    type="button"
                                    onClick={() => saveProfile(profile)}
                                    disabled={savingId === profile.id}
                                >
                                    {savingId === profile.id ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <Save className="mr-2 h-4 w-4" />
                                    )}
                                    Save
                                </Button>
                                <Button
                                    type="button"
                                    variant="destructive"
                                    onClick={() => deleteProfile(profile)}
                                    disabled={deletingId === profile.id}
                                >
                                    {deletingId === profile.id ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <Trash2 className="mr-2 h-4 w-4" />
                                    )}
                                    Delete
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <label className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                        Slug
                                    </label>
                                    <Input
                                        value={profile.slug}
                                        onChange={(event) =>
                                            updateProfile(profile.id, {
                                                slug: event.target.value,
                                            })
                                        }
                                        placeholder="balanced"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                        Name
                                    </label>
                                    <Input
                                        value={profile.name}
                                        onChange={(event) =>
                                            updateProfile(profile.id, {
                                                name: event.target.value,
                                            })
                                        }
                                        placeholder="Balanced"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                    Description
                                </label>
                                <Textarea
                                    value={profile.description}
                                    onChange={(event) =>
                                        updateProfile(profile.id, {
                                            description: event.target.value,
                                        })
                                    }
                                    placeholder="Explain when this profile should be used."
                                    rows={2}
                                />
                            </div>

                            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                                {MODEL_POLICY_KEYS.map((key) => (
                                    <div key={key} className="space-y-2">
                                        <label className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                            {MODEL_SLOT_LABELS[key]}
                                        </label>
                                        <Select
                                            value={profile.modelPolicy?.[key] || ""}
                                            onValueChange={(value) =>
                                                updatePolicy(
                                                    profile.id,
                                                    key,
                                                    value === "__inherit"
                                                        ? ""
                                                        : value,
                                                )
                                            }
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select model" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {key !== "primaryModel" && (
                                                    <SelectItem value="__inherit">
                                                        Use primary/default
                                                    </SelectItem>
                                                )}
                                                {agentModels?.map((model) => (
                                                    <SelectItem
                                                        key={model.modelId}
                                                        value={model.modelId}
                                                    >
                                                        {model.displayName}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
