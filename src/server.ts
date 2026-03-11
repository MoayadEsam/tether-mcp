/**
 * Tether MCP — Server Factory
 *
 * Creates and configures the McpServer with all tool registrations.
 * Separated from the entry point for testability.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
    registerHealthTool,
    registerGetProjectInvariants,
    registerVerifyDependencyAddition,
    registerLogArchitecturalDecision,
    registerCheckFileStructure,
    registerVerifyCodePattern,
} from "./tools/index.js";
import { registerResources } from "./resources.js";
import { startConfigWatch, stopConfigWatch } from "./utils/config-watcher.js";

import { createRequire } from "node:module";
const _require = createRequire(import.meta.url);
const { version: SERVER_VERSION } = _require("../package.json") as { version: string };

const SERVER_NAME = "tether-mcp";

/**
 * Creates a fully configured Tether MCP server
 * with all tools and resources registered and ready to connect.
 * Optionally starts config file watching for hot-reload.
 */
export function createServer(options?: { watchConfig?: boolean }): McpServer {
    const server = new McpServer({
        name: SERVER_NAME,
        version: SERVER_VERSION,
    });

    // ── Register Tools ──────────────────────────────────────────
    registerHealthTool(server);
    registerGetProjectInvariants(server);
    registerVerifyDependencyAddition(server);
    registerLogArchitecturalDecision(server);
    registerCheckFileStructure(server);
    registerVerifyCodePattern(server);

    // ── Register Resources ──────────────────────────────────────
    registerResources(server);

    // ── Start Config Watch (if enabled) ─────────────────────────
    if (options?.watchConfig !== false) {
        startConfigWatch().catch(() => {
            // Config watch is best-effort — don't crash the server
        });
    }

    return server;
}
