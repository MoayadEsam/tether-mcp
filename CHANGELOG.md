# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2025-06-13

### Added

- **Multi-ecosystem detection** — 90 frameworks across 8 ecosystems
  - **Python** (pyproject.toml, requirements.txt): Django, Flask, FastAPI, SQLAlchemy, pytest, Pydantic, Celery, NumPy, pandas, TensorFlow, PyTorch, Streamlit
  - **Dart/Flutter** (pubspec.yaml): Flutter, BLoC, Riverpod, GetX, Provider, Dio, Firebase, GoRouter, Freezed
  - **C#/.NET** (.csproj): ASP.NET Core, Entity Framework Core, Blazor, MAUI, xUnit, NUnit, MediatR, Dapper, Serilog, FluentValidation
  - **Go** (go.mod): Gin, Echo, Fiber, Chi, GORM, Testify, Gorilla Mux
  - **Rust** (Cargo.toml): Actix Web, Axum, Rocket, Tokio, Diesel, SeaORM, Serde, SQLx, Clap
  - **Java/Kotlin** (build.gradle, pom.xml): Spring Boot, Hibernate, Ktor, JUnit 5, Jetpack Compose
  - **Swift** (Package.swift): Vapor, Alamofire, Swift Argument Parser, GRDB
- Manifest parsers for pubspec.yaml, .csproj, pyproject.toml, requirements.txt, go.mod, Cargo.toml, build.gradle(.kts), pom.xml, Package.swift
- `detectProjectStack()` — unified detection across all ecosystems with automatic merging
- `mergeStacks()` utility for combining multiple detected stacks

### Changed

- `init` command now scans all ecosystem manifests (not just package.json)
- Default invariants are now ecosystem-agnostic
- Previous JS/TS detection (35 frameworks) remains fully intact

## [1.0.0] - 2025-03-12

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

[1.1.0]: https://github.com/MoayadEsam/tether-mcp/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/MoayadEsam/tether-mcp/releases/tag/v1.0.0
