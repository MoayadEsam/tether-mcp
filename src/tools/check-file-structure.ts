/**
 * Tether MCP — check_file_structure Tool
 *
 * Validates whether a proposed file path follows the project's
 * file structure conventions before the AI creates it.
 */

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadConfig } from "../utils/file.js";
import { recordToolCall } from "../utils/telemetry.js";

export function registerCheckFileStructure(server: McpServer): void {
    server.tool(
        "check_file_structure",
        "Validates whether a proposed file path follows the project's file structure conventions. " +
        "Call this BEFORE creating new files or moving existing files to ensure they are placed in the correct directory.",
        {
            filePath: z
                .string()
                .describe(
                    "The proposed relative file path to validate (e.g. 'src/components/Button.tsx')"
                ),
            fileType: z
                .string()
                .describe(
                    "The type of file being created (e.g. 'component', 'api-route', 'test', 'utility', 'hook', 'service', 'model')"
                ),
        },
        {
            title: "Check File Structure",
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
        },
        async ({ filePath, fileType }) => {
            try {
                recordToolCall("check_file_structure");
                const config = await loadConfig();
                const rules = config.fileStructure;

                if (rules.length === 0) {
                    return {
                        content: [
                            {
                                type: "text" as const,
                                text: JSON.stringify(
                                    {
                                        status: "no_rules",
                                        filePath,
                                        fileType,
                                        message:
                                            "No file structure rules are defined in tether.config.json. " +
                                            "Consider adding fileStructure rules to enforce conventions.",
                                    },
                                    null,
                                    2
                                ),
                            },
                        ],
                    };
                }

                const violations: string[] = [];
                const approvals: string[] = [];
                const normalizedPath = filePath.replace(/\\/g, "/");

                for (const rule of rules) {
                    const patternLower = rule.pattern.toLowerCase();
                    const fileTypeLower = fileType.toLowerCase();

                    // Check if this rule applies to the file type or path
                    const ruleApplies =
                        fileTypeLower.includes(patternLower) ||
                        patternLower.includes(fileTypeLower) ||
                        normalizedPath.toLowerCase().includes(patternLower);

                    if (ruleApplies) {
                        const isInAllowedPath = rule.allowedPaths.some(
                            (allowed) =>
                                normalizedPath.startsWith(
                                    allowed.replace(/\\/g, "/")
                                )
                        );

                        if (isInAllowedPath) {
                            approvals.push(
                                `✅ "${filePath}" is correctly placed (matches rule for "${rule.pattern}")`
                            );
                        } else {
                            violations.push(
                                `❌ "${filePath}" violates file structure rule for "${rule.pattern}". ` +
                                `Expected paths: ${rule.allowedPaths.join(", ")}` +
                                (rule.reason ? `. Reason: ${rule.reason}` : "")
                            );
                        }
                    }
                }

                const status =
                    violations.length > 0
                        ? "violation"
                        : approvals.length > 0
                          ? "approved"
                          : "no_matching_rule";

                return {
                    content: [
                        {
                            type: "text" as const,
                            text: JSON.stringify(
                                {
                                    status,
                                    filePath,
                                    fileType,
                                    violations,
                                    approvals,
                                    suggestion:
                                        violations.length > 0
                                            ? "Move the file to one of the allowed paths listed above."
                                            : undefined,
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
                                    error: "Failed to check file structure",
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
