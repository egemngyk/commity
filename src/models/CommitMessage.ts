/**
 * Represents a validated Conventional Commit message.
 */
export interface CommitMessage {
  /** The full commit message string, e.g. "feat(engine): implement physics engine" */
  value: string;
}

/** Regex for Conventional Commit format validation */
export const CONVENTIONAL_COMMIT_REGEX =
  /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([a-zA-Z0-9_\-./]+\))?(!)?:\s.+$/;
