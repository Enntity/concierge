import LLM from "../../../models/llm";
import Prompt from "../../../models/prompt";
import { requireWorkspaceOwner } from "../access";
import { republishWorkspace } from "../publish/utils";

export async function POST(req, { params }) {
    const { id } = params;

    const ownerCheck = await requireWorkspaceOwner(id);
    if (ownerCheck.error) {
        return ownerCheck.error;
    }
    const { workspace, user } = ownerCheck;

    const promptParams = await req.json();
    const defaultLLM = await LLM.findOne({ isDefault: true });

    const prompt = await Prompt.create({
        ...promptParams,
        owner: user._id,
        llm: promptParams.llm || defaultLLM._id,
    });

    workspace.prompts.unshift(prompt._id);
    await workspace.save();
    await republishWorkspace(workspace);

    // Populate the prompt with files before returning
    const populatedPrompt = await Prompt.findById(prompt._id).populate("files");

    return Response.json(populatedPrompt);
}
