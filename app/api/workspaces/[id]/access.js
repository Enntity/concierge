import Workspace from "../../models/workspace";
import { getCurrentUser } from "../../utils/auth";

export async function requireWorkspaceOwner(workspaceId) {
    const user = await getCurrentUser();
    if (!user) {
        return {
            error: Response.json(
                { error: "Authentication required" },
                { status: 401 },
            ),
        };
    }

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
        return {
            error: Response.json(
                { error: "Workspace not found" },
                { status: 404 },
            ),
        };
    }

    if (!workspace.owner?.equals(user._id)) {
        return {
            error: Response.json(
                { error: "You are not the owner of this workspace" },
                { status: 403 },
            ),
        };
    }

    return { workspace, user };
}
