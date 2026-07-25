import type { CompletedTask } from "../models/CompletedTask.js";

const DEFAULT_TEMPLATE_CHAT = `You are a Git expert. Based on the following completed tasks, generate EXACTLY ONE Conventional Commit message.

IMPORTANT: Reply with ONLY these two lines, nothing else, no markdown, no explanations:
git add .
git commit -m "type(scope): short description"

Where type is one of: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert

Completed tasks:
{tasks}`;

const DEFAULT_TEMPLATE_DIRECT = `You are a Git expert. Based on the following completed tasks, generate EXACTLY ONE Conventional Commit message.

Rules:
- Output ONLY the commit message string. No markdown. No explanations. No quotes. No code block.
- Use Conventional Commit format: type(scope): description
- Valid types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert
- Keep it under 72 characters
- Use imperative mood (implement, add, fix — not implemented, added, fixed)

Completed tasks:
{tasks}`;

/**
 * Builds the AI prompt for the Chat Panel provider.
 * Instructs the AI to respond with the two-line git command format.
 */
export function buildChatPanelPrompt(
  tasks: CompletedTask[],
  customTemplate?: string
): string {
  const taskList = tasks.map((t) => `- ${t.title}`).join("\n");
  const template = customTemplate?.trim()
    ? customTemplate
    : DEFAULT_TEMPLATE_CHAT;
  return template.replace("{tasks}", taskList);
}

/**
 * Builds the AI prompt for direct providers (vscode.lm, OpenAI, Mock).
 * Instructs the AI to respond with ONLY the commit message string.
 */
export function buildDirectPrompt(
  tasks: CompletedTask[],
  conventionalStyle: boolean,
  customTemplate?: string
): string {
  const taskList = tasks.map((t) => `- ${t.title}`).join("\n");

  if (customTemplate?.trim()) {
    return customTemplate.replace("{tasks}", taskList);
  }

  const base = conventionalStyle ? DEFAULT_TEMPLATE_DIRECT : DEFAULT_TEMPLATE_DIRECT;
  return base.replace("{tasks}", taskList);
}

/**
 * Formats a commit message into the two-line git command output.
 *
 * @example
 * formatGitCommands('feat(engine): implement physics engine')
 * // Returns:
 * // git add .
 * // git commit -m "feat(engine): implement physics engine"
 */
export function formatGitCommands(commitMessage: string): string {
  const escaped = commitMessage.replace(/"/g, '\\"');
  return `git add .\ngit commit -m "${escaped}"`;
}
