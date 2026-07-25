import type { CompletedTask } from "../models/CompletedTask.js";
import { logger } from "../utils/logger.js";

/** Regex matching a completed task line in a unified diff */
const COMPLETED_TASK_REGEX = /^\+\s*-\s*\[x\]\s+(.+)$/i;
/** Regex matching a previously unchecked task (removed line) */
const UNCHECKED_TASK_REGEX = /^-\s*-\s*\[\s*\]\s+(.+)$/i;

/**
 * Parses a unified git diff output and extracts only the tasks
 * that transitioned from unchecked [ ] to checked [x].
 *
 * It avoids false positives by ensuring that for every completed task
 * found in the diff (+lines), a corresponding unchecked version (-line)
 * existed in the same hunk.
 */
export class GitDiffParser {
  /**
   * Parse a raw unified diff and return the list of completed tasks.
   *
   * @param rawDiff - The raw output from `git diff HEAD -- TASKS.md`
   * @returns Array of completed tasks (only [ ] → [x] transitions)
   */
  public parse(rawDiff: string): CompletedTask[] {
    if (!rawDiff.trim()) {
      return [];
    }

    const lines = rawDiff.split("\n");
    const completedTasks: CompletedTask[] = [];

    // Track unchecked task titles removed in each hunk
    const removedUncheckedTitles = new Set<string>();

    for (const line of lines) {
      // Reset tracking at each new hunk header
      if (line.startsWith("@@")) {
        removedUncheckedTitles.clear();
        continue;
      }

      // Track removed unchecked tasks (lines starting with -)
      const removedMatch = UNCHECKED_TASK_REGEX.exec(line);
      if (removedMatch) {
        const title = removedMatch[1].trim();
        removedUncheckedTitles.add(title.toLowerCase());
        logger.debug(`Removed unchecked task: "${title}"`);
        continue;
      }

      // Check added completed tasks (lines starting with +)
      const completedMatch = COMPLETED_TASK_REGEX.exec(line);
      if (completedMatch) {
        const title = completedMatch[1].trim();
        // Only count it as completed if it was previously unchecked
        if (removedUncheckedTitles.has(title.toLowerCase())) {
          completedTasks.push({
            title,
            rawLine: line,
          });
          logger.info(`Detected completed task: "${title}"`);
        } else {
          logger.debug(
            `Skipped [x] line (no matching unchecked removed): "${title}"`
          );
        }
      }
    }

    return completedTasks;
  }
}
