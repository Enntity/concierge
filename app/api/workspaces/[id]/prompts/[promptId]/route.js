import Prompt from "../../../../models/prompt";
import { requireWorkspaceOwner } from "../../access";
import { republishWorkspace } from "../../publish/utils";

export async function DELETE(req, { params }) {
    const { id, promptId } = params;

    const ownerCheck = await requireWorkspaceOwner(id);
    if (ownerCheck.error) {
        return ownerCheck.error;
    }
    const { workspace } = ownerCheck;

    await Prompt.findByIdAndDelete(promptId);

    try {
        // remove from workspace
        workspace.prompts = workspace.prompts.filter(
            (p) => p?.toString() !== promptId,
        );
        await workspace.save();
        await republishWorkspace(workspace);

        return Response.json({ success: true });
    } catch (e) {
        console.error("e", e);
        return Response.json(
            { error: e.message },
            {
                status: 500,
            },
        );
    }
}

export async function PUT(req, { params }) {
    const { id, promptId } = params;
    const attrs = await req.json();

    try {
        const ownerCheck = await requireWorkspaceOwner(id);
        if (ownerCheck.error) {
            return ownerCheck.error;
        }
        const { workspace } = ownerCheck;

        const updatedPrompt = await Prompt.findByIdAndUpdate(promptId, attrs, {
            new: true,
        }).populate("files");

        if (workspace.published) {
            await republishWorkspace(workspace);
        }

        return Response.json(updatedPrompt);
    } catch (e) {
        console.error(e);
        return Response.json({ error: e.message }, { status: 500 });
    }
}
