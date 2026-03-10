/**
 * Tether MCP — verify_code_pattern Tool
 *
 * Validates that the AI's proposed code follows the project's
 * approved patterns (e.g. "use useReducer, not useState for complex state").
 */

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadConfig } from "../utils/file.js";
import { recordToolCall } from "../utils/telemetry.js";

export function registerVerifyCodePattern(server: McpServer): void {
    server.tool(
        "verify_code_pattern",
        "Checks whether a proposed code approach follows the project's approved patterns. " +
        "Call this BEFORE implementing a feature to verify you are using the correct patterns, " +
        "libraries, and architectural approaches for the given scope.",
        {
            approach: z
                .string()
                .describe(
                    "Description of the coding approach being proposed " +
                    "(e.g. 'Using useState to manage form state in a multi-step wizard')"
                ),
            scope: z
                .string()
                .describe(
                    "Which part of the codebase this applies to " +
                    "(e.g. 'frontend/state', 'api/auth', 'database')"
                ),
        },
        {
            title: "Verify Code Pattern",
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
        },
        async ({ approach, scope }) => {
            try {
                recordToolCall("verify_code_pattern");
                const config = await loadConfig();
                const patterns = config.codePatterns;
                const invariants = config.invariants;

                const violations: string[] = [];
                const relevantPatterns: string[] = [];
                const relevantInvariants: string[] = [];
                const approachLower = approach.toLowerCase();
                const scopeLower = scope.toLowerCase();

                // Check code patterns defined in config
                for (const pattern of patterns) {
                    const patternScope = (pattern.scope || "").toLowerCase();

                    // Check if this pattern is relevant to the scope
                    const scopeMatches =
                        !patternScope ||
                        scopeLower.includes(patternScope) ||
                        patternScope.includes(scopeLower) ||
                        patternScope === "*";

                    if (scopeMatches) {
                        relevantPatterns.push(
                            `📋 ${pattern.name}: ${pattern.rule}`
                        );
                    }
                }

                // Check invariants for relevant rules
                for (const invariant of invariants) {
                    const invariantLower = invariant.toLowerCase();

                    // Use keyword overlap to find relevant invariants
                    const scopeWords = scopeLower.split(/[\s/,_-]+/);
                    const approachWords = approachLower.split(/[\s/,_-]+/);
                    const allWords = [...scopeWords, ...approachWords];

                    const isRelevant = allWords.some(
                        (word) =>
                            word.length > 2 && invariantLower.includes(word)
                    );

                    if (isRelevant) {
                        relevantInvariants.push(`⚓ ${invariant}`);
                    }
                }

                const hasGuidance =
                    relevantPatterns.length > 0 ||
                    relevantInvariants.length > 0;

                return {
                    content: [
                        {
                            type: "text" as const,
                            text: JSON.stringify(
                                {
                                    status: violations.length > 0
                                        ? "violation"
                                        : hasGuidance
                                          ? "guidance_available"
                                          : "no_matching_patterns",
                                    approach,
                                    scope,
                                    relevantPatterns:
                                        relevantPatterns.length > 0
                                            ? relevantPatterns
                                            : undefined,
                                    relevantInvariants:
                                        relevantInvariants.length > 0
                                            ? relevantInvariants
                                            : undefined,
                                    violations:
                                        violations.length > 0
                                            ? violations
                                            : undefined,
                                    message: hasGuidance
                                        ? "Review the patterns and invariants above. Ensure your approach aligns with these project rules."
                                        : "No specific patterns found for this scope. Check the project invariants with get_project_invariants for general rules.",
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
                                    error: "Failed to verify code pattern",
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
