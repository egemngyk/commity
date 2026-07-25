import type { CompletedTask } from "../models/CompletedTask.js";
import { GitDiffParser } from "../git/GitDiffParser.js";

/**
 * High-level analyzer that uses GitDiffParser to extract completed tasks
 * from a TASKS.md diff and provides a summary for user feedback.
 */
export class TaskDiffAnalyzer {
  private readonly parser: GitDiffParser;

  constructor() {
    this.parser = new GitDiffParser();
  }

  /**
   * Analyze a raw git diff and return the completed tasks.
   *
   * @param rawDiff - Output from `git diff HEAD -- TASKS.md`
   * @returns Array of tasks that were transitioned from [ ] to [x]
   */
  public analyze(rawDiff: string): CompletedTask[] {
    return this.parser.parse(rawDiff);
  }

  /**
   * Parse all completed tasks from raw TASKS.md file content.
   * Useful when there is no HEAD commit or the tasks file is not in HEAD yet.
   */
  public analyzeRawContent(content: string): CompletedTask[] {
    const lines = content.split(/\r?\n/);
    const completedTasks: CompletedTask[] = [];
    const fileCompletedTaskRegex = /^\s*-\s*\[x\]\s+(.+)$/i;

    for (const line of lines) {
      const match = fileCompletedTaskRegex.exec(line);
      if (match) {
        completedTasks.push({
          title: match[1].trim(),
          rawLine: line,
        });
      }
    }

    return completedTasks;
  }

  /**
   * Format a human-readable summary of the completed tasks.
   */
  public formatSummary(tasks: CompletedTask[]): string {
    if (tasks.length === 0) {
      return "No completed tasks found.";
    }
    const lines = tasks.map((t) => `  • ${t.title}`);
    return `Found ${tasks.length} completed task(s):\n${lines.join("\n")}`;
  }
}
