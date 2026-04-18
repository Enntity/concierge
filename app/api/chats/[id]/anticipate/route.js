import { NextResponse } from "next/server";
import Chat from "../../../models/chat.mjs";
import { getCurrentUser, handleError } from "../../../utils/auth";
import { getClient, QUERIES } from "../../../../../src/graphql";
import { buildAgentContext } from "../../../utils/llm-file-utils";

export async function POST(req, { params }) {
    const { id } = params;
    if (!id) {
        return NextResponse.json(
            { error: "Chat ID is required" },
            { status: 400 },
        );
    }

    try {
        const currentUser = await getCurrentUser(false);
        const body = await req.json();
        const chat = await Chat.findOne({ _id: id, userId: currentUser._id });

        if (!chat) {
            return NextResponse.json(
                { error: "Chat not found" },
                { status: 404 },
            );
        }

        const {
            conversation = [],
            agentContext: requestAgentContext,
            aiName,
            title,
            entityId,
            userInfo,
            text,
            trigger,
        } = body || {};

        const finalEntityId = entityId || chat.selectedEntityId || "";
        const agentContext =
            requestAgentContext ||
            buildAgentContext({
                contextId: currentUser?.contextId || null,
                contextKey: currentUser?.contextKey || null,
            });

        const graphqlClient = getClient();
        const queryResult = await graphqlClient.query({
            query: QUERIES.SYS_ENTITY_RUNTIME,
            variables: {
                chatHistory: Array.isArray(conversation) ? conversation : [],
                agentContext,
                aiName,
                title: title || chat.title,
                text: typeof text === "string" ? text : "",
                chatId: id,
                stream: false,
                entityId: finalEntityId,
                userInfo,
                trigger: typeof trigger === "string" ? trigger : "",
                requestedOutput: "latency_prepare",
            },
            fetchPolicy: "network-only",
        });

        const rawResult = queryResult?.data?.sys_entity_runtime?.result || null;
        let anticipation = rawResult;
        if (typeof rawResult === "string" && rawResult.trim()) {
            try {
                anticipation = JSON.parse(rawResult);
            } catch {
                anticipation = rawResult;
            }
        }

        return NextResponse.json({
            ok: true,
            anticipation,
        });
    } catch (error) {
        console.error("[anticipate] Error warming chat latency path:", error);
        return handleError(error);
    }
}
