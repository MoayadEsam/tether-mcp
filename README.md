<p align="center">
  <img src="https://em-content.zobj.net/source/apple/391/anchor_2693.png" width="80" alt="Anchor"/>
</p>
<h1 align="center">Tether MCP</h1>
<p align="center">
  <strong>The anti-drift engine for AI coding agents.</strong><br/>
  <sub>Give your AI persistent memory of your project's rules. One command. Zero cloud.</sub>
</p>
<p align="center">
  <a href="https://www.npmjs.com/package/tether-mcp"><img src="https://img.shields.io/npm/v/tether-mcp?style=flat-square&color=blue&label=npm" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/tether-mcp"><img src="https://img.shields.io/npm/dm/tether-mcp?style=flat-square&color=green" alt="npm downloads"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-orange?style=flat-square" alt="MIT License"></a>
  <a href="https://modelcontextprotocol.io"><img src="https://img.shields.io/badge/protocol-MCP-purple?style=flat-square" alt="MCP"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D18-brightgreen?style=flat-square" alt="Node.js"></a>
</p>

---

> AI agents like Cursor and Claude write code fast — but they suffer from **Agent Drift**:
> hallucinating dependencies, violating architectural boundaries, and creating spaghetti code.
> Tether is a persistent **Senior Architect** that your AI must consult before making structural changes.

## Table of Contents

- [The Problem](#the-problem)
- [Quick Start](#quick-start)
- [How It Works](#how-it-works)
- [Tools](#tools-6-total)
- [MCP Resources](#mcp-resources)
- [CLI Commands](#cli-commands)
- [Configuration](#configuration)
- [Dependency Severity Levels](#dependency-severity-levels)
- [The Decision Ledger](#the-decision-ledger)
- [Session Telemetry](#session-telemetry)
- [Supported Frameworks](#supported-framework-detection)
- [Config Reference](#config-reference)
- [FAQ](#faq)
- [Contributing](#contributing)
- [License](#license)

## The Problem

You've been there. You ask an AI agent to add a feature and it:

- 🎲 **Installs `moment.js`** when your project already uses `date-fns`
- 🏗️ **Creates an Express server** inside your Next.js app
- 🧩 **Adds Riverpod** when your Flutter team agreed on BLoC
- 📝 **Forgets the entire architecture** after a few messages

Every session starts from zero. The AI has no memory of your rules, your stack decisions, or your architectural boundaries. This is **Agent Drift**, and it turns AI-assisted coding into a technical debt factory.

## Quick Start

### 1. Initialize in Your Project

```bash
npx tether-mcp init
```

Tether scans your project manifest (`package.json`, `pubspec.yaml`, `.csproj`, `pyproject.toml`, `go.mod`, `Cargo.toml`, `build.gradle`, `pom.xml`, or `Package.swift`), **auto-detects your framework** across **8 ecosystems and 90 frameworks**, and generates a tailored `tether.config.json` with smart defaults.

### 2. Connect to Your AI Agent

<details>
<summary><strong>Claude Code / Claude Desktop</strong></summary>

Add to `~/.claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "tether": {
      "command": "npx",
      "args": ["-y", "tether-mcp"]
    }
  }
}
```

</details>

<details>
<summary><strong>Cursor</strong></summary>

Add to `.cursor/mcp.json` in your project root:

```json
{
  "mcpServers": {
    "tether": {
      "command": "npx",
      "args": ["-y", "tether-mcp"]
    }
  }
}
```

</details>

<details>
<summary><strong>Windsurf</strong></summary>

Add to your Windsurf MCP configuration:

```json
{
  "mcpServers": {
    "tether": {
      "command": "npx",
      "args": ["-y", "tether-mcp"]
    }
  }
}
```

</details>

### 3. Done. Your AI Agent Now Has Guardrails ⚓

Every time the AI starts working, it consults Tether first — reading your invariants, checking dependency policies, validating file placements, and logging structural decisions. No more drift.

## How It Works

```
┌──────────────┐     MCP Tools     ┌──────────────┐     Local Files     ┌──────────────────┐
│  AI Agent    │ ◄──────────────► │  Tether MCP  │ ◄─────────────────► │ tether.config.json│
│ (Claude,     │                  │  Server      │                     │ ARCHITECTURE.md   │
│  Cursor)     │                  │              │                     │ DECISIONS.md      │
└──────────────┘                  └──────────────┘                     └──────────────────┘
```

### Tools (6 total)

| Tool | When to Call | What It Does |
|------|-------------|--------------|
| `get_project_invariants` | Before any structural work | Feeds the AI your tech stack, architecture rules, and dependency policies |
| `verify_dependency_addition` | Before `npm install <pkg>` | Checks if the package is blocked, warned, allowed, or needs review |
| `log_architectural_decision` | After creating a component or changing data flow | Appends a timestamped entry to `DECISIONS.md` |
| `check_file_structure` | Before creating or moving files | Validates the proposed file path against project conventions |
| `verify_code_pattern` | Before implementing a feature | Checks if the coding approach follows approved patterns and invariants |
| `health_check` | Diagnostics | Returns server status, registered tools, and session telemetry |

### MCP Resources

Tether also exposes project context as **MCP Resources** that clients can auto-subscribe to:

| Resource | URI | Description |
|----------|-----|-------------|
| Config | `tether://config` | The full `tether.config.json` — tech stack, invariants, dependency policies |
| Architecture | `tether://architecture` | The project's `ARCHITECTURE.md` document |
| Decisions | `tether://decisions` | The `DECISIONS.md` ledger of all logged decisions |

## Configuration

Edit `tether.config.json` to match your project:

```json
{
  "projectName": "my-app",
  "techStack": {
    "frontend": ["Next.js", "React"],
    "backend": ["Node.js"],
    "orm": ["Prisma"]
  },
  "invariants": [
    "All API routes must validate input with Zod.",
    "Database access must go through Prisma — no raw SQL.",
    "Use Server Components by default — client components only when needed."
  ],
  "dependencies": {
    "blocked": [
      {
        "name": "moment",
        "reason": "Use date-fns instead.",
        "alternatives": ["date-fns"],
        "severity": "block"
      },
      {
        "name": "lodash",
        "reason": "Tree-shaking issues. Use native JS or lodash-es.",
        "alternatives": ["lodash-es", "remeda"],
        "severity": "warn"
      }
    ]
  },
  "fileStructure": [
    {
      "pattern": "component",
      "allowedPaths": ["src/components/", "src/app/"],
      "reason": "All React components must live in src/components/ or src/app/"
    },
    {
      "pattern": "api-route",
      "allowedPaths": ["src/app/api/"],
      "reason": "API routes must use Next.js Route Handlers in app/api/"
    }
  ],
  "codePatterns": [
    {
      "name": "State Management",
      "rule": "Use React Context + useReducer for complex state — no Redux or Zustand",
      "scope": "frontend/state"
    },
    {
      "name": "Data Fetching",
      "rule": "Use Server Components for data fetching — no client-side fetch in components",
      "scope": "frontend"
    }
  ]
}
```

## CLI Commands

```bash
npx tether-mcp init       # Scan project & generate tether.config.json
npx tether-mcp serve      # Start the MCP server (stdio)
npx tether-mcp status     # Show project config summary & health
npx tether-mcp validate   # Validate tether.config.json against schema
npx tether-mcp --version  # Show version
npx tether-mcp --help     # Show all commands
```

## Dependency Severity Levels

Blocked dependencies now support **severity levels**:

| Severity | Behavior |
|----------|----------|
| `"block"` (default) | Hard stop — the AI is told the package is forbidden |
| `"warn"` | Soft warning — the AI is discouraged but not blocked |

```json
{
  "dependencies": {
    "blocked": [
      { "name": "moment", "reason": "Deprecated.", "alternatives": ["date-fns"], "severity": "block" },
      { "name": "axios", "reason": "Prefer native fetch.", "alternatives": ["fetch"], "severity": "warn" }
    ]
  }
}
```

## What Gets Generated

When you run `npx tether-mcp init` in a Next.js + Prisma + Tailwind project, Tether generates:

```json
{
  "projectName": "my-next-app",
  "techStack": {
    "frontend": ["Next.js", "React"],
    "styling": ["Tailwind CSS"],
    "orm": ["Prisma"],
    "language": ["TypeScript"]
  },
  "invariants": [
    "Use Next.js App Router for all new routes — do not use the Pages Router.",
    "All database access must go through Prisma — no raw SQL queries.",
    "Use Tailwind utility classes for styling — no inline styles.",
    "All new code must be written in TypeScript with strict mode enabled."
  ],
  "dependencies": {
    "blocked": [
      { "name": "express", "reason": "Next.js has built-in API routes.", "alternatives": ["Next.js Route Handlers"] },
      { "name": "moment",  "reason": "Deprecated and large bundle size.", "alternatives": ["date-fns"] }
    ]
  }
}
```

## The Decision Ledger

Every structural decision the AI makes is logged in `DECISIONS.md`:

```markdown
## Added Redis caching layer

| Field | Value |
|-------|-------|
| **Date** | 2026-03-10T01:30:00.000Z |
| **Scope** | `api/cache` |

### Summary

Added Redis via ioredis for caching frequently accessed product data.
Chose Redis over Memcached for pub/sub support and persistence options.
```

This creates an **immutable audit trail** of every architectural choice — visible to the next developer _and_ the next AI session.

## Session Telemetry

The `health_check` tool returns local-only session statistics:

```json
{
  "status": "healthy",
  "session": {
    "sessionStartedAt": "2026-03-12T10:00:00.000Z",
    "totalCalls": 7,
    "toolStats": {
      "get_project_invariants": { "callCount": 3, "lastCalledAt": "...", "errors": 0 },
      "verify_dependency_addition": { "callCount": 2, "lastCalledAt": "...", "errors": 0 }
    }
  }
}
```

No data leaves your machine. Telemetry resets when the server restarts.

## Supported Framework Detection

Tether auto-detects **90 frameworks** across **8 ecosystems**:

### JavaScript / TypeScript (`package.json`)

| Category | Detected |
|----------|----------|
| Frontend | Next.js, React, Vue.js, Svelte, Angular, Nuxt, Remix, Astro, SolidJS |
| Backend | Express, Fastify, NestJS, Hono, Koa, Elysia |
| ORM / DB | Prisma, Drizzle, TypeORM, Sequelize, Mongoose |
| Testing | Vitest, Jest, Playwright, Cypress |
| Styling | Tailwind CSS, Styled Components, Emotion |
| State | Zustand, Redux Toolkit |
| Auth | NextAuth.js |
| Build | Vite |
| Language | TypeScript |

### Python (`pyproject.toml`, `requirements.txt`)

| Category | Detected |
|----------|----------|
| Backend | Django, Flask, FastAPI |
| ORM | SQLAlchemy |
| Testing | pytest |
| Validation | Pydantic |
| Task Queue | Celery |
| Data Science | NumPy, pandas |
| ML | TensorFlow, PyTorch |
| Frontend | Streamlit |

### Dart / Flutter (`pubspec.yaml`)

| Category | Detected |
|----------|----------|
| Framework | Flutter |
| State | BLoC, Riverpod, GetX, Provider |
| HTTP | Dio |
| Backend | Firebase |
| Routing | GoRouter |
| Codegen | Freezed |

### C# / .NET (`.csproj`)

| Category | Detected |
|----------|----------|
| Backend | ASP.NET Core |
| ORM | Entity Framework Core, Dapper |
| Frontend | Blazor |
| Mobile | .NET MAUI |
| Testing | xUnit, NUnit |
| Architecture | MediatR |
| Logging | Serilog |
| Validation | FluentValidation |

### Go (`go.mod`)

| Category | Detected |
|----------|----------|
| Backend | Gin, Echo, Fiber, Chi |
| ORM | GORM |
| Testing | Testify |
| Routing | Gorilla Mux |

### Rust (`Cargo.toml`)

| Category | Detected |
|----------|----------|
| Backend | Actix Web, Axum, Rocket |
| Async | Tokio |
| ORM | Diesel, SeaORM |
| Serialization | Serde |
| Database | SQLx |
| CLI | Clap |

### Java / Kotlin (`build.gradle`, `pom.xml`)

| Category | Detected |
|----------|----------|
| Backend | Spring Boot, Ktor |
| ORM | Hibernate |
| Testing | JUnit 5 |
| Frontend | Jetpack Compose |

### Swift (`Package.swift`)

| Category | Detected |
|----------|----------|
| Backend | Vapor |
| HTTP | Alamofire |
| CLI | Swift Argument Parser |
| Database | GRDB |

Each detection adds **targeted invariants** and **smart blocked-package rules** specific to your stack.

## Config Reference

| Field | Type | Description |
|-------|------|-------------|
| `projectName` | `string` | Display name for the project |
| `techStack` | `Record<string, string[]>` | Your enforced technology stack by category |
| `invariants` | `string[]` | Immutable architectural rules the AI must follow |
| `dependencies.allowed` | `string[]` | Pre-approved packages |
| `dependencies.blocked` | `array` | Forbidden packages with reason, alternatives, and optional severity |
| `dependencies.reviewRequired` | `string[]` | Packages needing justification |
| `fileStructure` | `array` | File placement rules with pattern, allowedPaths, and reason |
| `codePatterns` | `array` | Code pattern rules with name, rule, and scope |
| `architectureFile` | `string` | Path to architecture doc (default: `ARCHITECTURE.md`) |
| `decisionsFile` | `string` | Path to decision ledger (default: `DECISIONS.md`) |

## FAQ

<details>
<summary><strong>"Do I need to write the config file myself?"</strong></summary>

**No.** Run `npx tether-mcp init` and it auto-generates `tether.config.json` by scanning your project. You can customize it afterward, but the defaults are smart enough out of the box.

</details>

<details>
<summary><strong>"Do I need to tell the AI to use Tether?"</strong></summary>

**No.** MCP tools are auto-discovered. The AI sees Tether's tools in its toolbox and calls them when making structural changes — just like it uses `file_read` or `terminal`.

</details>

<details>
<summary><strong>"Won't this burn more tokens?"</strong></summary>

~500-1,500 tokens per session for guardrails vs. **5,000-20,000 tokens** wasted fixing drift mistakes. Tether pays for itself in the first blocked bad dependency.

</details>

<details>
<summary><strong>"Why not just use Claude Opus — it's smart enough?"</strong></summary>

Smart ≠ omniscient. Claude doesn't know your team decided on `date-fns` three months ago. It doesn't remember Session #1's decisions in Session #10. And when you close the tab, context is gone. Tether gives the AI **persistent, file-based memory** of your rules — across every session, every agent.

</details>

<details>
<summary><strong>"What if I work on multiple projects?"</strong></summary>

Each project gets its own `tether.config.json` in its own directory. Project A's rules never leak into Project B.

</details>

<details>
<summary><strong>"Is this just a fancy CLAUDE.md?"</strong></summary>

No. CLAUDE.md is passive — the AI may or may not read it. Tether is **active** — it validates dependencies, blocks bad packages with alternatives, checks file structure, verifies code patterns, and maintains an audit trail. It works across Claude, Cursor, Windsurf, and any MCP-compatible agent.

</details>

## Contributing

Contributions are welcome! Here are some ways to help:

- **Add a framework signature** — detect a new framework in `src/utils/detect-stack.ts`
- **Improve invariants** — better defaults for existing frameworks
- **Bug reports** — open an [issue](https://github.com/MoayadEsam/tether-mcp/issues)
- **Feature requests** — ideas for new tools or resources

```bash
git clone https://github.com/MoayadEsam/tether-mcp.git
cd tether-mcp
npm install
npm run build
```

## License

[MIT](LICENSE) — built with ♥ for developers who are tired of cleaning up after their AI agents.
