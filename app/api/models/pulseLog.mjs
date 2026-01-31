import mongoose from "mongoose";

const pulseLogSchema = new mongoose.Schema(
    {
        // Entity UUID
        entityId: {
            type: String,
            required: true,
            index: true,
        },
        // Entity name (for display/debugging)
        entityName: {
            type: String,
            default: null,
        },
        // Wake type: 'scheduled' = periodic wake, 'continue' = auto-continuation
        wakeType: {
            type: String,
            enum: ["scheduled", "continue"],
            default: "scheduled",
        },
        // Status of this pulse cycle
        status: {
            type: String,
            enum: ["pending", "in_progress", "completed", "failed", "skipped"],
            default: "pending",
        },
        // Why skipped (if status === 'skipped')
        skipReason: {
            type: String,
            default: null,
        },
        // Chain depth (0 for scheduled wakes, increments for auto-continues)
        chainDepth: {
            type: Number,
            default: 0,
        },
        // How this cycle ended
        endSignal: {
            type: String,
            enum: ["rest", "tool_limit", "error", "crash_recovery", null],
            default: null,
        },
        // Task context carried from EndPulse (for next wake)
        taskContext: {
            type: String,
            default: null,
        },
        // Reflection from EndPulse
        reflection: {
            type: String,
            default: null,
        },
        // Token usage for budget tracking
        tokenUsage: {
            type: mongoose.Schema.Types.Mixed,
            default: null,
        },
        // Tool calls made during this cycle
        toolCallCount: {
            type: Number,
            default: 0,
        },
        // Error details if failed
        error: {
            type: String,
            default: null,
        },
        // Duration of this cycle in milliseconds
        durationMs: {
            type: Number,
            default: null,
        },
    },
    {
        timestamps: true,
    },
);

// For querying pulse history and budget tracking
pulseLogSchema.index({ entityId: 1, createdAt: -1 });
pulseLogSchema.index({ entityId: 1, status: 1, createdAt: -1 });

const PulseLog =
    mongoose.models?.PulseLog || mongoose.model("PulseLog", pulseLogSchema);

PulseLog.syncIndexes?.();

export default PulseLog;
