import type { CompletedTask } from "../models/CompletedTask.js";
import type { FileDiff } from "../git/GitService.js";

const DEFAULT_TEMPLATE_CHAT = `You are a Git expert. Based on the following completed tasks, generate EXACTLY ONE Conventional Commit message.

IMPORTANT: Your response must consist ONLY of a bash code block containing these exact git commands, with no other text, no markdown outside the code block, and no explanations:
\`\`\`bash
git add .
git commit -m "type(scope): short description"
\`\`\`

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

const DIFF_TEMPLATE_CHAT = `You are a Git expert. Based on the following code changes (git diff), generate EXACTLY ONE Conventional Commit message.

IMPORTANT: Your response must consist ONLY of a bash code block containing these exact git commands, with no other text, no markdown outside the code block, and no explanations:
\`\`\`bash
git add .
git commit -m "type(scope): short description"
\`\`\`

Where type is one of: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert

Changed files and their diffs:
{diff}`;

const DIFF_TEMPLATE_DIRECT = `You are a Git expert. Based on the following code changes (git diff), generate EXACTLY ONE Conventional Commit message.

Rules:
- Output ONLY the commit message string. No markdown. No explanations. No quotes. No code block.
- Use Conventional Commit format: type(scope): description
- Valid types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert
- Keep it under 72 characters
- Use imperative mood (implement, add, fix — not implemented, added, fixed)

Changed files and their diffs:
{diff}`;

const HYBRID_TEMPLATE_CHAT = `You are a Git expert. Based on the completed tasks and code changes (git diff), generate EXACTLY ONE Conventional Commit message.

IMPORTANT: Your response must consist ONLY of a bash code block containing these exact git commands, with no other text, no markdown outside the code block, and no explanations:
\`\`\`bash
git add .
git commit -m "type(scope): short description"
\`\`\`

Where type is one of: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert

{context}`;

const HYBRID_TEMPLATE_DIRECT = `You are a Git expert. Based on the completed tasks and code changes (git diff), generate EXACTLY ONE Conventional Commit message.

Rules:
- Output ONLY the commit message string. No markdown. No explanations. No quotes. No code block.
- Use Conventional Commit format: type(scope): description
- Valid types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert
- Keep it under 72 characters
- Use imperative mood (implement, add, fix — not implemented, added, fixed)

{context}`;


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
 * Builds a prompt from git file diffs for the Chat Panel provider.
 * Used when no TASKS.md file is found in the project.
 */
export function buildDiffChatPrompt(
  fileDiffs: FileDiff[],
  customTemplate?: string
): string {
  const diffBlock = formatFileDiffsForPrompt(fileDiffs);
  const template = customTemplate?.trim() ? customTemplate : DIFF_TEMPLATE_CHAT;
  return template.replace("{diff}", diffBlock);
}

/**
 * Builds a prompt from git file diffs for direct providers.
 * Used when no TASKS.md file is found in the project.
 */
export function buildDiffDirectPrompt(
  fileDiffs: FileDiff[],
  customTemplate?: string
): string {
  const diffBlock = formatFileDiffsForPrompt(fileDiffs);
  const template = customTemplate?.trim() ? customTemplate : DIFF_TEMPLATE_DIRECT;
  return template.replace("{diff}", diffBlock);
}

/**
 * Builds a smart combined prompt containing both completed tasks (if any)
 * and file diffs (if any).
 */
export function buildSmartChatPrompt(
  tasks: CompletedTask[],
  fileDiffs: FileDiff[],
  customTemplate?: string
): string {
  const context = formatSmartContext(tasks, fileDiffs);
  if (customTemplate?.trim()) {
    return customTemplate.replace("{tasks}", tasks.map(t => `- ${t.title}`).join("\n")).replace("{diff}", formatFileDiffsForPrompt(fileDiffs)).replace("{context}", context);
  }
  return HYBRID_TEMPLATE_CHAT.replace("{context}", context);
}

/**
 * Builds a smart combined prompt for direct providers containing both completed tasks (if any)
 * and file diffs (if any).
 */
export function buildSmartDirectPrompt(
  tasks: CompletedTask[],
  fileDiffs: FileDiff[],
  _conventionalStyle: boolean,
  customTemplate?: string
): string {
  const context = formatSmartContext(tasks, fileDiffs);
  if (customTemplate?.trim()) {
    return customTemplate.replace("{tasks}", tasks.map(t => `- ${t.title}`).join("\n")).replace("{diff}", formatFileDiffsForPrompt(fileDiffs)).replace("{context}", context);
  }
  return HYBRID_TEMPLATE_DIRECT.replace("{context}", context);
}

function formatSmartContext(tasks: CompletedTask[], fileDiffs: FileDiff[]): string {
  const parts: string[] = [];
  if (tasks.length > 0) {
    const taskList = tasks.map((t) => `- ${t.title}`).join("\n");
    parts.push(`Completed tasks from task list:\n${taskList}`);
  }
  if (fileDiffs.length > 0) {
    const diffBlock = formatFileDiffsForPrompt(fileDiffs);
    parts.push(`Code changes (git diff):\n${diffBlock}`);
  }
  return parts.join("\n\n");
}


/**
 * Formats an array of FileDiff objects into a readable block for the AI prompt.
 * Each file gets a header with its name, followed by the truncated diff.
 */
function formatFileDiffsForPrompt(fileDiffs: FileDiff[]): string {
  const MAX_DIFF_CHARS_PER_FILE = 1500;
  const MAX_FILES = 20;

  return fileDiffs
    .slice(0, MAX_FILES)
    .map((fd) => {
      const diffContent = fd.isBinary
        ? fd.diff
        : fd.diff.length > MAX_DIFF_CHARS_PER_FILE
        ? fd.diff.slice(0, MAX_DIFF_CHARS_PER_FILE) + "\n... (truncated)"
        : fd.diff;
      return `### ${fd.fileName}\n\`\`\`diff\n${diffContent}\n\`\`\``;
    })
    .join("\n\n");
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
