# Commity

> 🤖 VS Code extension that auto-generates Conventional Commit messages via AI by analyzing either your `TASKS.md` checked-off tasks, or falling back to raw file diffs if no tasks file exists. Works with Antigravity IDE, GitHub Copilot, OpenRouter, and OpenAI-compatible APIs.

🇬🇧 **English documentation** | 🇹🇷 **Türkçe dökümantasyon için [README.tr.md](./README.tr.md) dosyasına göz atabilirsiniz.**

![Commity Icon](icons/commity.png)

## Features

- ✅ **Smart Task Detection** — Analyzes `git diff HEAD` on your `TASKS.md` and finds every `[ ]` → `[x]` transition.
- 🔍 **Zero-Config Fallback (Git Diff Mode)** — If no tasks/todo file exists in the workspace, Commity automatically collects raw code changes (staged + unstaged diffs) with filenames, prompting the AI to describe the changes instead.
- 🌐 **OpenRouter Support** — Integrates seamlessly with OpenRouter (using model `openrouter/auto` by default) to let you use any model (GPT-4o, Claude 3.5, Gemini, Llama) with a single API key.
- 🤖 **AI-powered commit messages** — Sends a prompt to your IDE's chat panel (Antigravity / Copilot) or uses `vscode.lm` / OpenAI / OpenRouter APIs as fallback.
- 📋 **Run or copy** — Confirms before running. Shows `git add . && git commit -m "..."` with a one-click "Run in Terminal" button and a badge showing which AI provider was used.
- ✏️ **Editable** — Edit the commit message inline in the webview before committing.
- 🔄 **Regenerate** — Not happy? Click Regenerate and get a new message.
- 🎨 **VS Code themed** — Webview respects your editor theme (dark/light).

## How It Works

```
Ctrl+Shift+P → "Commity: Generate Commit Message"
       │
       ▼
1. Detects your Git repo root
2. Looks for TASKS.md (or tasks.md / Todo.md / TODO.md)
       │
       ├─ Found Tasks File?
       │     └─ Extracts only [ ] → [x] transitions from diff vs HEAD
       │
       └─ No Tasks File?
             └─ Enters Git Diff Mode: Extracts raw code changes from git diff HEAD
       │
       ▼
3. Builds an AI prompt with the changes/tasks
       │
       ├─ Antigravity / Copilot chat available?
       │     └─ Sends prompt to chat panel → AI responds with git commands
       │
       └─ No chat panel?
             ├─ vscode.lm API → generates message directly
             ├─ OpenRouter API → generates message directly
             ├─ OpenAI-compatible HTTP API → generates message directly
             └─ Mock (dev) → uses sample message
       │
       ▼
4. Shows confirmation panel with AI provider badge:
    ┌──────────────────────────────────────────┐
    │  feat(engine): implement physics engine   │ ← editable
    │                                           │
    │  [💬 Antigravity AI Agent]                │ ← provider badge
    │                                           │
    │  git add .                                │
    │  git commit -m "feat(engine): implement..." │
    │                                           │
    │  [▶ Run in Terminal] [📋 Copy] [🔄 Regen] │
    └──────────────────────────────────────────┘
```

## Installation

### From VS Code Marketplace
> Coming soon — follow the [releases](https://github.com/yourusername/commity/releases)

### From VSIX (manual)
```bash
git clone https://github.com/yourusername/commity.git
cd commity
npm install
npm run compile
npx vsce package
# Then in VS Code: Extensions → ··· → Install from VSIX
```

### Development (F5)
```bash
git clone https://github.com/yourusername/commity.git
cd commity
npm install
# Open in VS Code / Antigravity
# Press F5 → Extension Development Host opens
```

## Requirements

- VS Code `^1.85.0` or Antigravity IDE
- A Git repository (either with a tasks file or active file modifications)
- **For AI:** one of:
  - Antigravity IDE (built-in AI via chat panel)
  - GitHub Copilot Chat extension
  - OpenRouter API key (or any compatible endpoint)
  - OpenAI API key (or any compatible endpoint)
  - Ollama / LM Studio (local models, no key needed)

## Settings

| Setting | Default | Description |
|---|---|---|
| `commity.preferredProvider` | `"auto"` | `auto` / `chat` / `vscode-lm` / `openai` / `openrouter` / `mock` |
| `commity.openrouterApiKey` | `""` | OpenRouter API key |
| `commity.openrouterModel` | `"openrouter/auto"` | OpenRouter model ID |
| `commity.openaiApiKey` | `""` | OpenAI or compatible API key |
| `commity.openaiBaseUrl` | `"https://api.openai.com/v1"` | API endpoint (supports Ollama, LM Studio, etc.) |
| `commity.model` | `"gpt-4o"` | Model name for OpenAI provider |
| `commity.temperature` | `0.3` | Creativity (0–2) |
| `commity.conventionalCommitStyle` | `true` | Enforce `feat/fix/refactor/...` format |
| `commity.promptTemplate` | `""` | Custom prompt. Use `{tasks}` or `{diff}` placeholder |
| `commity.preferredTasksFilename` | `""` | Override auto-detection |
| `commity.autoCopy` | `false` | Auto-copy commands to clipboard |
| `commity.maxRetries` | `3` | Max AI retries on invalid response |

## TASKS.md Format

If you choose to use a tasks file, Commity reads standard GitHub-style task lists:

```markdown
## Sprint 3

- [x] Create Physics Engine        ← ✅ detected (was unchecked before)
- [x] Implement Missile Collision   ← ✅ detected
- [ ] Add Multiplayer Support       ← ⏭ skipped (still unchecked)
- [x] Already done last commit      ← ⏭ skipped (was already [x] in HEAD)
```

Only tasks that **changed** from `[ ]` to `[x]` in this commit are included.

## Antigravity IDE Note

Antigravity IDE does not expose a public extension API for its built-in AI.
Commity uses the standard `workbench.action.chat.open` VS Code command to send
the prompt to whichever chat panel is available (Antigravity's agent or Copilot Chat).
If no chat panel is found, Commity falls back to `vscode.lm` → OpenAI → OpenRouter → Mock.

## Publishing

```bash
# Install vsce if needed
npm install -g @vscode/vsce

# Package
npm run package   # → commity-1.0.0.vsix

# Publish to Marketplace (requires PAT)
npm run publish
```

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

MIT © 2026 Muhammed Egemen Geyik
