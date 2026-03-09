/**
 * Tether MCP — Health Check Tool
 *
 * A lightweight diagnostic tool that confirms the server
 * is operational and returns runtime metadata.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getSessionTelemetry, recordToolCall } from "../utils/telemetry.js";

const TOOLS_REGISTERED = [
    "health_check",
    "get_project_invariants",
    "verify_dependency_addition",
    "log_architectural_decision",
    "check_file_structure",
    "verify_code_pattern",
];

export function registerHealthTool(server: McpServer): void {
    server.tool(
        "health_check",
        "Returns the current status of the Tether MCP server, confirming it is operational.",
        {},
        {
            title: "Health Check",
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
        },
        async () => {
            recordToolCall("health_check");
            const telemetry = getSessionTelemetry();

            return {
                content: [
                    {
                        type: "text" as const,
                        text: JSON.stringify(
                            {
                                status: "healthy",
                                server: "tether-mcp",
                                version: "1.0.0",
                                timestamp: new Date().toISOString(),
                                tools_registered: TOOLS_REGISTERED,
                                session: telemetry,
                            },
                            null,
                            2
                        ),
                    },
                ],
            };
        }
    );
}
