import { NextResponse } from "next/server";
import { connectToDatabase } from "../../../../src/db.mjs";
import { getCurrentUser } from "../../utils/auth";
import ModelProfile from "../../models/model-profile.mjs";
import { MODEL_POLICY_KEYS } from "../../../../src/utils/entityModelProfiles.js";

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

async function requireAdmin() {
    await connectToDatabase();
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "admin") {
        return null;
    }
    return currentUser;
}

export async function PATCH(req, { params }) {
    try {
        const currentUser = await requireAdmin();
        if (!currentUser) {
            return NextResponse.json(
                { error: "Admin access required" },
                { status: 403 },
            );
        }

        const { profileId } = params;
        if (!profileId) {
            return NextResponse.json(
                { error: "Profile ID is required" },
                { status: 400 },
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

        const existing = await ModelProfile.findById(profileId);
        if (!existing) {
            return NextResponse.json(
                { error: "Model profile not found" },
                { status: 404 },
            );
        }

        if (validated.value.isDefault) {
            await ModelProfile.updateMany(
                { _id: { $ne: profileId } },
                { $set: { isDefault: false } },
            );
        } else if (existing.isDefault) {
            const otherDefault = await ModelProfile.findOne({
                _id: { $ne: profileId },
                isDefault: true,
            });
            if (!otherDefault) {
                validated.value.isDefault = true;
            }
        }

        const updated = await ModelProfile.findByIdAndUpdate(
            profileId,
            { $set: validated.value },
            { new: true },
        ).lean();

        return NextResponse.json({
            ...updated,
            id: updated._id.toString(),
        });
    } catch (error) {
        console.error("Error updating model profile:", error);
        if (error?.code === 11000) {
            return NextResponse.json(
                { error: "A profile with that slug already exists" },
                { status: 409 },
            );
        }
        return NextResponse.json(
            { error: "Failed to update model profile" },
            { status: 500 },
        );
    }
}

export async function DELETE(req, { params }) {
    try {
        const currentUser = await requireAdmin();
        if (!currentUser) {
            return NextResponse.json(
                { error: "Admin access required" },
                { status: 403 },
            );
        }

        const { profileId } = params;
        if (!profileId) {
            return NextResponse.json(
                { error: "Profile ID is required" },
                { status: 400 },
            );
        }

        const deleted = await ModelProfile.findByIdAndDelete(profileId).lean();
        if (!deleted) {
            return NextResponse.json(
                { error: "Model profile not found" },
                { status: 404 },
            );
        }

        if (deleted.isDefault) {
            const replacement = await ModelProfile.findOne().sort({ name: 1 });
            if (replacement) {
                replacement.isDefault = true;
                await replacement.save();
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting model profile:", error);
        return NextResponse.json(
            { error: "Failed to delete model profile" },
            { status: 500 },
        );
    }
}

export const dynamic = "force-dynamic";
