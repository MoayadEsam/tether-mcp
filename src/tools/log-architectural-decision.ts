/**
 * Tether MCP — log_architectural_decision Tool
 *
 * Appends a structured entry to DECISIONS.md whenever the LLM
 * creates a new core component or changes data flow.
 */

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadConfig, appendToFile, readMarkdownFile } from "../utils/file.js";
import { recordToolCall } from "../utils/telemetry.js";

export function registerLogArchitecturalDecision(server: McpServer): void {
    server.tool(
        "log_architectural_decision",
        "Records an architectural decision to the project's DECISIONS.md ledger. " +
        "Call this AFTER creating a new core component, changing data flow, adding a service, or altering the module structure.",
        {
            title: z
                .string()
                .describe(
                    "Short descriptive title for the decision (e.g. 'Added Redis caching layer')"
                ),
            summary: z
                .string()
                .describe(
                    "What was decided, why, and what alternatives were considered"
                ),
            scope: z
                .string()
                .describe(
                    "Which part of the codebase this affects (e.g. 'api/auth', 'database', 'frontend/state')"
                ),
        },
        {
            title: "Log Architectural Decision",
            readOnlyHint: false,
            destructiveHint: false,
            idempotentHint: false,
            openWorldHint: false,
        },
        async ({ title, summary, scope }) => {
            try {
                recordToolCall("log_architectural_decision");
                const config = await loadConfig();
                const decisionsFile = config.decisionsFile;
                const timestamp = new Date().toISOString();

                // Check if file exists to determine if we need a header
                const existing = await readMarkdownFile(decisionsFile);
                let entry = "";

                if (!existing) {
                    entry += `# Architectural Decision Ledger\n\n`;
                    entry += `> Auto-maintained by [Tether MCP](https://github.com/your-org/tether-mcp). `;
                    entry += `Each entry is logged when an AI agent makes a structural change.\n\n`;
                    entry += `---\n\n`;
                }

                entry += `## ${title}\n\n`;
                entry += `| Field | Value |\n`;
                entry += `|-------|-------|\n`;
                entry += `| **Date** | ${timestamp} |\n`;
                entry += `| **Scope** | \`${scope}\` |\n\n`;
                entry += `### Summary\n\n`;
                entry += `${summary}\n\n`;
                entry += `---\n\n`;

                const writtenPath = await appendToFile(decisionsFile, entry);

                return {
                    content: [
                        {
                            type: "text" as const,
                            text: JSON.stringify(
                                {
                                    status: "recorded",
                                    title,
                                    scope,
                                    timestamp,
                                    file: writtenPath,
                                    message: `Decision "${title}" has been logged to ${decisionsFile}.`,
                                },
                                null,
                                2
                            ),
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
                                    error: "Failed to log architectural decision",
                                    details: message,
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
