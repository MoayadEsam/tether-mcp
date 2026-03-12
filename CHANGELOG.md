# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-03-12

### Added

- **6 MCP Tools**
  - `get_project_invariants` — feeds AI your tech stack, architecture rules, and dependency policies
  - `verify_dependency_addition` — blocks/warns on bad packages with reasons and alternatives
  - `log_architectural_decision` — appends timestamped entries to DECISIONS.md
  - `check_file_structure` — validates proposed file paths against project conventions
  - `verify_code_pattern` — checks if coding approach follows approved patterns
  - `health_check` — returns server status, registered tools, and session telemetry
- **3 MCP Resources** — `tether://config`, `tether://architecture`, `tether://decisions`
- **CLI Commands** — `init`, `serve`, `status`, `validate`, `--version`, `--help`
- **Auto-detection** of 30+ frameworks (Next.js, React, Vue, Angular, Svelte, Nuxt, Remix, Astro, SolidJS, Express, Fastify, NestJS, Hono, Koa, Elysia, Prisma, Drizzle, TypeORM, Sequelize, Mongoose, Vitest, Jest, Playwright, Cypress, Tailwind CSS, Styled Components, Emotion, Zustand, Redux Toolkit, NextAuth.js, Vite)
- **Dependency severity levels** — `"block"` (hard stop) vs `"warn"` (soft discourage)
- **File structure enforcement** — rules with pattern, allowedPaths, and reason
- **Code pattern enforcement** — rules with name, rule, and scope
- **Tool annotations** per MCP spec on all 6 tools
- **Config hot-reload** via file watcher — edit rules without restarting
- **Session telemetry** — local-only usage stats per tool, no network calls
- **Smart `init` command** — scans package.json and generates targeted config with framework-specific invariants and blocked packages

[1.0.0]: https://github.com/MoayadEsam/tether-mcp/releases/tag/v1.0.0
