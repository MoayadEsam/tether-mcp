/**
 * Tether MCP — verify_dependency_addition Tool
 *
 * Validates whether a new npm package should be added to the project.
 * Checks against blocked lists, existing dependencies for overlap,
 * and flags packages that require review.
 */

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadConfig, readPackageJson } from "../utils/file.js";
import { recordToolCall } from "../utils/telemetry.js";

export function registerVerifyDependencyAddition(server: McpServer): void {
    server.tool(
        "verify_dependency_addition",
        "Validates whether a new npm package is allowed before adding it. " +
        "Call this BEFORE running 'npm install <package>'. " +
        "Checks the package against blocked lists, existing dependencies, and review policies.",
        {
            packageName: z
                .string()
                .describe("The npm package name to validate (e.g. 'lodash')"),
            reason: z
                .string()
                .describe("Why this package is needed — what problem does it solve?"),
        },
        {
            title: "Verify Dependency Addition",
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
        },
        async ({ packageName, reason }) => {
            try {
                recordToolCall("verify_dependency_addition");
                const config = await loadConfig();
                const packageJson = await readPackageJson();

                const verdict: {
                    package: string;
                    status: "approved" | "blocked" | "warned" | "review_required";
                    severity?: "block" | "warn";
                    reason: string;
                    details: string[];
                } = {
                    package: packageName,
                    status: "approved",
                    reason,
                    details: [],
                };

                // ── Check 1: Is the package explicitly blocked? ──────
                const blockedEntry = config.dependencies.blocked.find(
                    (b) => b.name.toLowerCase() === packageName.toLowerCase()
                );

                if (blockedEntry) {
                    const severity = blockedEntry.severity || "block";
                    verdict.severity = severity;

                    if (severity === "warn") {
                        verdict.status = "warned";
                        verdict.details.push(
                            `⚠️  WARNING: ${blockedEntry.reason}`
                        );
                        verdict.details.push(
                            `ℹ️  This package is discouraged but not hard-blocked. Proceed only with strong justification.`
                        );
                    } else {
                        verdict.status = "blocked";
                        verdict.details.push(
                            `❌ BLOCKED: ${blockedEntry.reason}`
                        );
                    }

                    if (blockedEntry.alternatives.length > 0) {
                        verdict.details.push(
                            `💡 Alternatives: ${blockedEntry.alternatives.join(", ")}`
                        );
                    }
                    return formatResponse(verdict);
                }

                // ── Check 2: Does it already exist in dependencies? ──
                if (packageJson) {
                    const allDeps = {
                        ...(packageJson.dependencies as Record<string, string> || {}),
                        ...(packageJson.devDependencies as Record<string, string> || {}),
                    };

                    if (allDeps[packageName]) {
                        verdict.details.push(
                            `⚠️  Package "${packageName}" is already installed (${allDeps[packageName]}).`
                        );
                    }
                }

                // ── Check 3: Is it on the review-required list? ──────
                const needsReview = config.dependencies.reviewRequired.some(
                    (r) => r.toLowerCase() === packageName.toLowerCase()
                );

                if (needsReview) {
                    verdict.status = "review_required";
                    verdict.details.push(
                        `⚠️  This package requires explicit review before adding. ` +
                        `Provide a strong justification and consider alternatives.`
                    );
                    return formatResponse(verdict);
                }

                // ── Check 4: Is it explicitly allowed? ───────────────
                const isAllowed = config.dependencies.allowed.some(
                    (a) => a.toLowerCase() === packageName.toLowerCase()
                );

                if (isAllowed) {
                    verdict.details.push(
                        `✅ Package is on the pre-approved list.`
                    );
                } else {
                    verdict.details.push(
                        `ℹ️  Package is not on the pre-approved list but is not blocked. Proceed with caution.`
                    );
                }

                return formatResponse(verdict);
            } catch (error) {
                const message =
                    error instanceof Error ? error.message : "Unknown error";
                return {
                    content: [
                        {
                            type: "text" as const,
                            text: JSON.stringify(
                                {
                                    error: "Failed to verify dependency",
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

function formatResponse(verdict: {
    package: string;
    status: string;
    reason: string;
    details: string[];
}) {
    return {
        content: [
            {
                type: "text" as const,
                text: JSON.stringify(verdict, null, 2),
            },
        ],
    };
}
