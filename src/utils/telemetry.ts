/**
 * Tether MCP — Session Telemetry
 *
 * Tracks local-only usage statistics per server session.
 * No network calls — all data stays in memory and is lost on restart.
 */

export interface ToolStats {
    callCount: number;
    lastCalledAt: string | null;
    errors: number;
}

export interface SessionTelemetry {
    sessionStartedAt: string;
    totalCalls: number;
    toolStats: Record<string, ToolStats>;
}

const sessionStartedAt = new Date().toISOString();
const toolStats: Record<string, ToolStats> = {};

/**
 * Records a tool invocation.
 */
export function recordToolCall(toolName: string, isError: boolean = false): void {
    if (!toolStats[toolName]) {
        toolStats[toolName] = {
            callCount: 0,
            lastCalledAt: null,
            errors: 0,
        };
    }

    toolStats[toolName].callCount++;
    toolStats[toolName].lastCalledAt = new Date().toISOString();

    if (isError) {
        toolStats[toolName].errors++;
    }
}

/**
 * Returns a snapshot of the current session telemetry.
 */
export function getSessionTelemetry(): SessionTelemetry {
    const totalCalls = Object.values(toolStats).reduce(
        (sum, s) => sum + s.callCount,
        0
    );

    return {
        sessionStartedAt,
        totalCalls,
        toolStats: { ...toolStats },
    };
}

/**
 * Resets all telemetry (useful for testing).
 */
export function resetTelemetry(): void {
    for (const key of Object.keys(toolStats)) {
        delete toolStats[key];
    }
}
