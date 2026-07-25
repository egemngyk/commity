/**
 * Represents a single completed task extracted from a TASKS.md diff.
 */
export interface CompletedTask {
  /** The task title, e.g. "Create Physics Engine" */
  title: string;
  /** The original markdown line, e.g. "- [x] Create Physics Engine" */
  rawLine: string;
}
