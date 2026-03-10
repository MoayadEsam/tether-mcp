/**
 * Tether MCP — Resource Registration
 *
 * Exposes tether.config.json and ARCHITECTURE.md as MCP Resources
 * so clients can auto-subscribe and keep context fresh without
 * explicit tool calls.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadConfig, readMarkdownFile } from "./utils/file.js";

/**
 * Registers MCP resources for the project's config and architecture docs.
 */
export function registerResources(server: McpServer): void {
    // ── Resource: tether.config.json ──────────────────────────
    server.resource(
        "tether-config",
        "tether://config",
        {
            description:
                "The project's Tether configuration including tech stack, invariants, dependency policies, file structure rules, and code patterns.",
            mimeType: "application/json",
        },
        async () => {
            try {
                const config = await loadConfig();
                return {
                    contents: [
                        {
                            uri: "tether://config",
                            mimeType: "application/json",
                            text: JSON.stringify(config, null, 2),
                        },
                    ],
                };
            } catch (error) {
                const message =
                    error instanceof Error ? error.message : "Config not found";
                return {
                    contents: [
                        {
                            uri: "tether://config",
                            mimeType: "text/plain",
                            text: `Error loading config: ${message}`,
                        },
                    ],
                };
            }
        }
    );

    // ── Resource: ARCHITECTURE.md ─────────────────────────────
    server.resource(
        "architecture-doc",
        "tether://architecture",
        {
            description:
                "The project's ARCHITECTURE.md document with extended architecture documentation and design decisions.",
            mimeType: "text/markdown",
        },
        async () => {
            try {
                const config = await loadConfig();
                const content = await readMarkdownFile(config.architectureFile);

                if (content) {
                    return {
                        contents: [
                            {
                                uri: "tether://architecture",
                                mimeType: "text/markdown",
                                text: content,
                            },
                        ],
                    };
                }

                return {
                    contents: [
                        {
                            uri: "tether://architecture",
                            mimeType: "text/plain",
                            text: `No ${config.architectureFile} found. Create one for richer architectural context.`,
                        },
                    ],
                };
            } catch {
                return {
                    contents: [
                        {
                            uri: "tether://architecture",
                            mimeType: "text/plain",
                            text: "Error: Could not load architecture document. Ensure tether.config.json exists.",
                        },
                    ],
                };
            }
        }
    );

    // ── Resource: DECISIONS.md ────────────────────────────────
    server.resource(
        "decisions-ledger",
        "tether://decisions",
        {
            description:
                "The project's DECISIONS.md ledger containing all logged architectural decisions.",
            mimeType: "text/markdown",
        },
        async () => {
            try {
                const config = await loadConfig();
                const content = await readMarkdownFile(config.decisionsFile);

                if (content) {
                    return {
                        contents: [
                            {
                                uri: "tether://decisions",
                                mimeType: "text/markdown",
                                text: content,
                            },
                        ],
                    };
                }

                return {
                    contents: [
                        {
                            uri: "tether://decisions",
                            mimeType: "text/plain",
                            text: `No ${config.decisionsFile} found yet. Decisions will appear here once logged via log_architectural_decision.`,
                        },
                    ],
                };
            } catch {
                return {
                    contents: [
                        {
                            uri: "tether://decisions",
                            mimeType: "text/plain",
                            text: "Error: Could not load decisions ledger.",
                        },
                    ],
                };
            }
        }
    );
}
