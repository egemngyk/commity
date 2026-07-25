import type { CompletedTask } from "../models/CompletedTask.js";
import { logger } from "../utils/logger.js";

/**
 * Result of an AI provider generation call.
 *
 * - If `mode` is `"chat"`: the prompt was sent to the chat panel.
 *   The AI response will appear there; `commitMessage` is undefined.
 *
 * - If `mode` is `"direct"`: the extension received the commit message
 *   itself; `commitMessage` contains the string.
 */
export type AIGenerationResult =
  | { mode: "chat" }
  | { mode: "direct"; commitMessage: string };

/**
 * Core interface that every AI provider must implement.
 * Dependency injection makes swapping providers trivial.
 */
export interface AIProvider {
  /** Human-readable provider name for logging/UI */
  readonly name: string;

  /**
   * Check whether this provider is currently available.
   * Should be fast and non-blocking.
   */
  isAvailable(): Promise<boolean>;

  /**
   * Generate a commit message for the given completed tasks.
   *
   * - Chat-panel providers send the prompt to the IDE chat and return
   *   `{ mode: "chat" }`.
   * - Direct providers return `{ mode: "direct", commitMessage }`.
   *
   * @param tasks            - Completed tasks extracted from TASKS.md diff
   * @param conventionalStyle - Whether to enforce Conventional Commit format
   * @param customTemplate   - Optional user-defined prompt template
   */
  generate(
    tasks: CompletedTask[],
    conventionalStyle: boolean,
    customTemplate?: string
  ): Promise<AIGenerationResult>;
}

/**
 * Helper to log provider selection and availability.
 */
export function logProviderSelection(provider: AIProvider): void {
  logger.info(`Using AI provider: ${provider.name}`);
}
