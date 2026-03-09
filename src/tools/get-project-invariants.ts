/**
 * Tether MCP — get_project_invariants Tool
 *
 * Reads the project's tether.config.json and optional ARCHITECTURE.md
 * to return the immutable rules the LLM must respect.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadConfig, readMarkdownFile } from "../utils/file.js";
import { recordToolCall } from "../utils/telemetry.js";

export function registerGetProjectInvariants(server: McpServer): void {
    server.tool(
        "get_project_invariants",
        "Reads the project's architectural invariants, tech stack rules, and dependency policies. " +
        "Call this BEFORE making any structural changes, adding dependencies, or creating new components.",
        {},
        {
            title: "Get Project Invariants",
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
        },
        async () => {
            try {
                recordToolCall("get_project_invariants");
                const config = await loadConfig();

                // Attempt to read the extended architecture doc
                const architectureDoc = await readMarkdownFile(
                    config.architectureFile
                );

                const response: Record<string, unknown> = {
                    projectName: config.projectName,
                    techStack: config.techStack,
                    invariants: config.invariants,
                    dependencyPolicy: {
                        blocked: config.dependencies.blocked,
                        reviewRequired: config.dependencies.reviewRequired,
                        allowed: config.dependencies.allowed,
                    },
                };

                if (architectureDoc) {
                    response.architectureDocument = architectureDoc;
                } else {
                    response.architectureDocument = null;
                    response.note = `No ${config.architectureFile} found. Consider creating one for richer context.`;
                }

                return {
                    content: [
                        {
                            type: "text" as const,
                            text: JSON.stringify(response, null, 2),
                        },
                    ],
                };
            } catch (error) {
                const message =
                    error instanceof Error ? error.message : "Unknown error";
                return {
                    content: [
                        {
                            type: "text" as const,
                            text: JSON.stringify(
                                {
                                    error: "Failed to load project invariants",
                                    details: message,
                                    hint: "Ensure tether.config.json exists in the project root.",
                                },
                                null,
                                2
                            ),
                        },
                    ],
                    isError: true,
                };
            }
        }
    );
}
