import { getCurrentUser } from "../../../utils/auth";

import { NextResponse } from "next/server";
import Digest from "../../../models/digest";
import { enqueueBuildDigest } from "./utils";

export async function GET(req, { params }) {
    const user = await getCurrentUser();

    let digest = await Digest.findOne({
        owner: user._id,
    });

    if (!digest) {
        digest = await Digest.create({
            owner: user._id,
            blocks: [
                {
                    prompt: `What's going on in the world today? If you know my profession, give me updates specific to my profession and preferences. Otherwise, give me general updates.`,
                    title: "Daily digest",
                },
            ],
        });

        await enqueueBuildDigest(user._id);
    }

    return NextResponse.json(digest.toJSON());
}

export async function PATCH(req, { params }) {
    const user = await getCurrentUser();
    const { blocks, layout } = await req.json();

    const oldDigest = await Digest.findOne({
        owner: user._id,
    });

    // Build update object
    const updateFields = {};
    if (layout !== undefined) {
        updateFields.layout = layout;
    }
    if (blocks !== undefined) {
        updateFields.blocks = blocks;
    }

    let newDigest = await Digest.findOneAndUpdate(
        { owner: user._id },
        updateFields,
        { new: true },
    );

    // Only process blocks if they were provided
    if (blocks !== undefined) {
        const oldBlocks = oldDigest?.blocks || [];
        const newBlocks = newDigest.blocks;

        for (const newBlock of newBlocks) {
            const oldBlock = oldBlocks.find(
                (b) => b._id?.toString() === newBlock._id?.toString(),
            );

            // If the prompt, entityId has changed, or if there's no content,
            // we need to regenerate the block
            const promptChanged = oldBlock?.prompt !== newBlock.prompt;
            const entityChanged = oldBlock?.entityId !== newBlock.entityId;
            const noContent = !newBlock.content;

            if (!oldBlock || promptChanged || entityChanged || noContent) {
                const { taskId } = await enqueueBuildDigest(
                    user._id,
                    newBlock._id,
                );
                newBlock.taskId = taskId;
                newBlock.updatedAt = null;
                newBlock.content = null;
            }
        }

        newDigest = await Digest.findOneAndUpdate(
            { owner: user._id },
            { blocks: newBlocks },
            { new: true },
        );
    }

    return NextResponse.json(newDigest);
}
