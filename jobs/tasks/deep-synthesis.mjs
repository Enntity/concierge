import { BaseTask } from "./base-task.mjs";
import { SYS_CONTINUITY_DEEP_SYNTHESIS } from "../graphql.mjs";

/**
 * Deep Synthesis Task Handler
 *
 * Processes selected memories through the sys_continuity_deep_synthesis pathway
 * which models human sleep consolidation in two phases:
 *
 * Phase 1 (Consolidation): Per-memory analysis to absorb, merge, link, or keep
 * Phase 2 (Discovery): Batch pattern recognition and CORE_EXTENSION nominations
 */
class DeepSynthesisHandler extends BaseTask {
    get displayName() {
        return "Process memories";
    }

    get isRetryable() {
        return false; // Synthesis is not idempotent
    }

    async startRequest(job) {
        const { metadata, userId } = job.data;

        const {
            entityId,
            memoryIds,
            phase1Max = 100,
            phase2Max = 100,
            daysToLookBack = null,
            runPhase1 = true,
            runPhase2 = true,
        } = metadata;

        if (!entityId) {
            throw new Error("entityId is required for deep synthesis");
        }

        if (!userId) {
            throw new Error("userId is required for deep synthesis");
        }

        if (memoryIds && !Array.isArray(memoryIds)) {
            throw new Error("memoryIds must be an array");
        }

        if (memoryIds && memoryIds.length === 0) {
            throw new Error("memoryIds array cannot be empty");
        }

        const variables = {
            entityId,
            userId,
            async: true,
            runPhase1,
            runPhase2,
        };

        if (memoryIds && memoryIds.length > 0) {
            variables.memoryIds = memoryIds;
        }

        if (phase1Max) variables.phase1Max = phase1Max;
        if (phase2Max) variables.phase2Max = phase2Max;
        if (daysToLookBack !== null) variables.daysToLookBack = daysToLookBack;

        let data, errors;
        try {
            const response = await job.client.query({
                query: SYS_CONTINUITY_DEEP_SYNTHESIS,
                variables,
                fetchPolicy: "no-cache",
            });
            data = response.data;
            errors = response.errors;
        } catch (queryError) {
            const graphqlErrors =
                queryError.networkError?.result?.errors ||
                queryError.graphQLErrors ||
                [];
            throw new Error(
                `GraphQL query failed: ${graphqlErrors.map((e) => e.message).join(", ") || queryError.message}`,
            );
        }

        if (errors) {
            throw new Error(`GraphQL errors: ${JSON.stringify(errors)}`);
        }

        const result = data?.sys_continuity_deep_synthesis?.result;

        if (!result) {
            throw new Error("No result returned from deep synthesis service");
        }

        return result;
    }

    async handleCompletion(taskId, dataObject, infoObject, metadata, client) {
        // Parse the synthesis results
        let synthesisResult = dataObject;
        if (typeof dataObject === "string") {
            try {
                synthesisResult = JSON.parse(dataObject);
            } catch (e) {
                // Keep as string if not valid JSON
            }
        }

        // Build a summary for display in job alerts
        if (synthesisResult && typeof synthesisResult === "object") {
            const { phase1, phase2 } = synthesisResult;
            const summary = {
                memoryCount: metadata?.memoryIds?.length || "all",
            };

            if (phase1) {
                summary.consolidation = {
                    processed: phase1.processed,
                    absorbed: phase1.absorbed,
                    merged: phase1.merged,
                    linked: phase1.linked,
                    kept: phase1.kept,
                };
            }

            if (phase2) {
                summary.discovery = {
                    consolidated: phase2.consolidated,
                    patterns: phase2.patterns,
                    nominations: phase2.nominations,
                };
            }

            return summary;
        }

        return synthesisResult;
    }

    async handleError(taskId, error, metadata, client) {
        return {
            error: error.message || "Memory processing failed",
            memoryCount: metadata?.memoryIds?.length,
        };
    }
}

export default new DeepSynthesisHandler();
