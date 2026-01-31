import { NextResponse } from "next/server";
import { getCurrentUser } from "../../utils/auth";
import { connectToDatabase } from "../../../../src/db.mjs";
import PulseLog from "../../models/pulseLog.mjs";

/**
 * GET /api/admin/pulse
 * Get pulse logs with optional filtering
 * Query params: entityId, status, limit, offset
 */
export async function GET(req) {
    try {
        const user = await getCurrentUser();
        if (!user || user.role !== "admin") {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 },
            );
        }

        await connectToDatabase();

        const { searchParams } = new URL(req.url);
        const entityId = searchParams.get("entityId");
        const status = searchParams.get("status");
        const limit = Math.min(
            parseInt(searchParams.get("limit") || "50", 10),
            200,
        );
        const offset = parseInt(searchParams.get("offset") || "0", 10);

        const filter = {};
        if (entityId) filter.entityId = entityId;
        if (status) filter.status = status;

        const [logs, total] = await Promise.all([
            PulseLog.find(filter)
                .sort({ createdAt: -1 })
                .skip(offset)
                .limit(limit)
                .lean(),
            PulseLog.countDocuments(filter),
        ]);

        // Get distinct entity names for the filter dropdown
        const entities = await PulseLog.aggregate([
            {
                $group: {
                    _id: "$entityId",
                    name: { $first: "$entityName" },
                    count: { $sum: 1 },
                },
            },
            { $sort: { count: -1 } },
        ]);

        return NextResponse.json({
            logs: logs.map((log) => ({
                id: log._id.toString(),
                entityId: log.entityId,
                entityName: log.entityName,
                wakeType: log.wakeType,
                status: log.status,
                skipReason: log.skipReason,
                chainDepth: log.chainDepth,
                endSignal: log.endSignal,
                taskContext: log.taskContext,
                reflection: log.reflection,
                error: log.error,
                durationMs: log.durationMs,
                createdAt: log.createdAt,
            })),
            total,
            entities: entities.map((e) => ({
                id: e._id,
                name: e.name,
                count: e.count,
            })),
        });
    } catch (error) {
        console.error("Error fetching pulse logs:", error);
        return NextResponse.json(
            { error: "Failed to fetch pulse logs" },
            { status: 500 },
        );
    }
}
