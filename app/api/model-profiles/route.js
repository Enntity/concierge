import { NextResponse } from "next/server";
import { connectToDatabase } from "../../../src/db.mjs";
import { getCurrentUser } from "../utils/auth";
import ModelProfile from "../models/model-profile.mjs";
import { MODEL_POLICY_KEYS } from "../../../src/utils/entityModelProfiles.js";

function normalizeModelPolicy(modelPolicy = {}) {
    const normalized = {};
    for (const key of MODEL_POLICY_KEYS) {
        if (typeof modelPolicy?.[key] === "string" && modelPolicy[key].trim()) {
            normalized[key] = modelPolicy[key].trim();
        }
    }
    return normalized;
}

function validatePayload(body = {}) {
    const slug = String(body.slug || "")
        .trim()
        .toLowerCase();
    const name = String(body.name || "").trim();
    const description = String(body.description || "").trim();

    if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
        return { error: "slug must use lowercase letters, numbers, and hyphens" };
    }

    if (!name) {
        return { error: "name is required" };
    }

    if (
        !body.modelPolicy ||
        typeof body.modelPolicy !== "object" ||
        Array.isArray(body.modelPolicy)
    ) {
        return { error: "modelPolicy must be an object" };
    }

    const modelPolicy = normalizeModelPolicy(body.modelPolicy);
    if (!modelPolicy.primaryModel) {
        return { error: "modelPolicy.primaryModel is required" };
    }

    return {
        value: {
            slug,
            name,
            description,
            isDefault: body.isDefault === true,
            modelPolicy,
        },
    };
}

async function requireCurrentUser() {
    await connectToDatabase();
    return getCurrentUser();
}

export async function GET() {
    try {
        const currentUser = await requireCurrentUser();
        if (!currentUser) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 },
            );
        }

        const profiles = await ModelProfile.find({}, "-__v")
            .sort({ isDefault: -1, name: 1 })
            .lean();

        return NextResponse.json(
            profiles.map((profile) => ({
                ...profile,
                id: profile._id.toString(),
            })),
        );
    } catch (error) {
        console.error("Error fetching model profiles:", error);
        return NextResponse.json(
            { error: "Failed to fetch model profiles" },
            { status: 500 },
        );
    }
}

export async function POST(req) {
    try {
        const currentUser = await requireCurrentUser();
        if (!currentUser || currentUser.role !== "admin") {
            return NextResponse.json(
                { error: "Admin access required" },
                { status: 403 },
            );
        }

        const body = await req.json();
        const validated = validatePayload(body);
        if (validated.error) {
            return NextResponse.json(
                { error: validated.error },
                { status: 400 },
            );
        }

        const existingCount = await ModelProfile.countDocuments();
        const payload = {
            ...validated.value,
            isDefault:
                validated.value.isDefault === true || existingCount === 0,
        };

        if (payload.isDefault) {
            await ModelProfile.updateMany({}, { $set: { isDefault: false } });
        }

        const created = await ModelProfile.create(payload);

        return NextResponse.json({
            ...created.toJSON(),
            id: created._id.toString(),
        });
    } catch (error) {
        console.error("Error creating model profile:", error);
        if (error?.code === 11000) {
            return NextResponse.json(
                { error: "A profile with that slug already exists" },
                { status: 409 },
            );
        }
        return NextResponse.json(
            { error: "Failed to create model profile" },
            { status: 500 },
        );
    }
}

export const dynamic = "force-dynamic";
