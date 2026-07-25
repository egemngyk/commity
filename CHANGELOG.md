# Changelog

All notable changes to **Commity** will be documented in this file.

This project adheres to [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
and [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-07-25

### Added
- `Commity: Generate Commit Message` command
- `Commity: Copy Commit Message` command
- `Commity: Open Settings` command
- Automatic detection of Git repository root
- Auto-detection of `TASKS.md`, `tasks.md`, `Todo.md`, `TODO.md` with multi-file picker
- `git diff HEAD` analysis — only detects `[ ]` → `[x]` transitions
- AI provider abstraction (`AIProvider` interface)
- `ChatPanelProvider` — sends prompt to Antigravity / GitHub Copilot chat panel
- `VsCodeLMProvider` — uses `vscode.lm` Language Model API
- `OpenAICompatibleProvider` — HTTP client for OpenAI, Ollama, LM Studio, Groq, etc.
- `MockProvider` — rotating fake commit messages for development/testing
- `AIProviderFactory` — auto-selects best available provider
- Confirmation webview panel with editable commit message
- "Run in Terminal" button — opens integrated terminal and runs `git add . && git commit -m "..."`
- "Copy Commands" button — copies git commands to clipboard
- "Regenerate" button — re-runs the full workflow
- Conventional Commit validation with up to N retries
- Centralized logger writing to "Commity" output channel
- Full TypeScript strict mode
- ESLint configuration
