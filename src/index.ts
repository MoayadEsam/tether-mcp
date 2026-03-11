#!/usr/bin/env node

/**
 * Tether MCP — Entry Point
 *
 * Initializes the MCP server, registers all tools,
 * and connects to the stdio transport layer.
 */

import { createServer } from "./server.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

async function main(): Promise<void> {
    const server = createServer();
    const transport = new StdioServerTransport();

    await server.connect(transport);

    // Graceful shutdown
    process.on("SIGINT", async () => {
        await server.close();
        process.exit(0);
    });

    process.on("SIGTERM", async () => {
        await server.close();
        process.exit(0);
    });
}

main().catch((error) => {
    console.error("Fatal error starting Tether MCP:", error);
    process.exit(1);
});
