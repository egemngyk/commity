# Changelog

All notable changes to **Commity** will be documented in this file.

This project adheres to [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
and [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-07-26

### Added
- **Smart Hybrid Detection**: Commity now simultaneously checks both completed tasks in `TASKS.md` AND active code diffs in Git repository files.
- Combined AI prompt generation: If both task list items and code changes exist, both are sent to the AI for complete context. If only code diffs exist (even when `TASKS.md` hasn't changed), code diffs are seamlessly processed.

## [1.0.4] - 2026-07-26

### Changed
- Logo changed


## [1.0.3] - 2026-07-26

### Fixed
- Fixed extension ID filter query in settings command to avoid "No settings found" error

## [1.0.2] - 2026-07-26

### Changed
- Changed publisher ID to `egemngyk` in package configuration
- Prepared GitHub Actions pipeline to publish to OpenVSX and GitHub Releases simultaneously
- Fixed `.vscodeignore` to allow packing compiled JS assets in build targets

## [1.0.1] - 2026-07-26

### Added
- OpenRouter integration supporting openrouter/auto model selection
- Fallback Git Diff Mode when no TASKS.md file is found in workspace
- Automatic in-app update checker and downloader/installer from GitHub releases
- AI Provider Badge displayed in the commit preview webview header

## [1.0.0] - 2026-07-26

### Added
- Commity: Generate Commit Message command
- Commity: Copy Commit Message command
- Commity: Open Settings command
- Automatic detection of Git repository root
- Auto-detection of TASKS.md, tasks.md, Todo.md, TODO.md with multi-file picker
- git diff HEAD analysis — only detects [ ] → [x] transitions
- AI provider abstraction (AIProvider interface)
- ChatPanelProvider — sends prompt to Antigravity / GitHub Copilot chat panel
- VsCodeLMProvider — uses vscode.lm Language Model API
- OpenAICompatibleProvider — HTTP client for OpenAI, Ollama, LM Studio, Groq, etc.
- MockProvider — rotating fake commit messages for development/testing
- AIProviderFactory — auto-selects best available provider
- Confirmation webview panel with editable commit message
- "Run in Terminal" button — opens integrated terminal and runs git add . && git commit -m "..."
- "Copy Commands" button — copies git commands to clipboard
- "Regenerate" button — re-runs the full workflow
- Conventional Commit validation with up to N retries
- Centralized logger writing to "Commity" output channel
- Full TypeScript strict mode
- ESLint configuration
