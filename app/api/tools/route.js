import { NextResponse } from "next/server";
import { getCurrentUser } from "../utils/auth";
import { getClient, QUERIES } from "../../../src/graphql";

/**
 * GET /api/tools
 * Get list of all available tools from cortex
 * Returns: { tools: [{ name, icon, description, enabled }], count: number }
 */
export async function GET(req) {
    try {
        const user = await getCurrentUser();
        if (!user?.contextId) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 },
            );
        }

        // Check for includeDisabled query param
        const { searchParams } = new URL(req.url);
        const includeDisabled = searchParams.get("includeDisabled") === "true";

        const client = await getClient();
        const result = await client.query({
            query: QUERIES.SYS_GET_TOOLS,
            variables: {
                includeDisabled,
            },
        });

        const responseData = result.data?.sys_get_tools?.result;
        if (!responseData) {
            return NextResponse.json(
                { error: "Failed to fetch tools from cortex" },
                { status: 500 },
            );
        }

        // Parse the JSON result from the pathway
        let parsed;
        try {
            parsed = JSON.parse(responseData);
        } catch (e) {
            console.error("Failed to parse tools response:", e);
            return NextResponse.json(
                { error: "Invalid response from cortex" },
                { status: 500 },
            );
        }

        if (parsed.error) {
            return NextResponse.json({ error: parsed.error }, { status: 500 });
        }

        return NextResponse.json({
            tools: parsed.tools || [],
            count: parsed.count || 0,
        });
    } catch (error) {
        console.error("Error fetching tools:", error);
        return NextResponse.json(
            { error: error.message || "Failed to fetch tools" },
            { status: 500 },
        );
    }
}
