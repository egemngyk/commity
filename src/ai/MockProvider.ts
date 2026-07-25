import type { AIGenerationResult, AIProvider } from "./AIProvider.js";
import type { CompletedTask } from "../models/CompletedTask.js";
import { logger } from "../utils/logger.js";

/** Mock commit messages that rotate on each call — useful for testing UI */
const MOCK_MESSAGES = [
  "feat(engine): implement physics engine and missile collision",
  "feat(core): add task management and entity system",
  "refactor(renderer): optimize draw call batching",
  "fix(auth): resolve token refresh race condition",
  "chore(deps): update dependencies to latest stable",
];

let mockIndex = 0;

/**
 * MockProvider returns a pre-defined commit message without calling any AI.
 * Used during development and testing when no AI provider is available.
 *
 * Rotates through a list of sample messages to help test the UI with
 * varied content.
 */
export class MockProvider implements AIProvider {
  public readonly name = "Mock Provider (Development/Testing)";

  public async isAvailable(): Promise<boolean> {
    return true; // Always available as the final fallback
  }

  public async generate(
    tasks: CompletedTask[],
    _conventionalStyle: boolean,
    _customTemplate?: string
  ): Promise<AIGenerationResult> {
    const taskNames = tasks.map((t) => t.title).join(", ");
    logger.warn(
      `MockProvider: generating fake commit for tasks: [${taskNames}]`
    );
    logger.warn(
      "MockProvider is active — configure an AI provider in settings for real results."
    );

    // Simulate a brief async delay (as a real API would have)
    await new Promise<void>((resolve) => setTimeout(resolve, 500));

    const commitMessage = MOCK_MESSAGES[mockIndex % MOCK_MESSAGES.length];
    mockIndex++;

    logger.info(`MockProvider: returning "${commitMessage}"`);
    return { mode: "direct", commitMessage };
  }
}
