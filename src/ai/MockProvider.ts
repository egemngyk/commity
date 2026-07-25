import type { AIGenerationResult, AIProvider } from "./AIProvider.js";
import type { CompletedTask } from "../models/CompletedTask.js";
import { logger } from "../utils/logger.js";

/**
 * MockProvider generates a simulated commit message based on the actual completed tasks.
 * Used during development and testing when no real AI provider is available.
 */
export class MockProvider implements AIProvider {
  public readonly name = "Mock Provider (Development/Testing)";

  public async isAvailable(): Promise<boolean> {
    return true; // Always available as the final fallback
  }

  public async generate(
    tasks: CompletedTask[],
    conventionalStyle: boolean,
    _customTemplate?: string
  ): Promise<AIGenerationResult> {
    const taskNames = tasks.map((t) => t.title).join(", ");
    logger.warn(
      `MockProvider: generating simulated commit for tasks: [${taskNames}]`
    );
    logger.warn(
      "MockProvider is active — configure an AI provider in settings for real results."
    );

    // Simulate a brief async delay
    await new Promise<void>((resolve) => setTimeout(resolve, 500));

    let commitMessage = "";

    if (tasks.length > 0) {
      const firstTask = tasks[0].title;
      const titleLower = firstTask.toLowerCase();

      // Guess scope based on keywords
      let scope = "core";
      if (titleLower.includes("auth") || titleLower.includes("login") || titleLower.includes("user")) {
        scope = "auth";
      } else if (titleLower.includes("db") || titleLower.includes("database") || titleLower.includes("sql")) {
        scope = "db";
      } else if (titleLower.includes("ui") || titleLower.includes("css") || titleLower.includes("style") || titleLower.includes("theme")) {
        scope = "ui";
      } else if (titleLower.includes("test") || titleLower.includes("spec")) {
        scope = "test";
      }

      // Convert first letter to lowercase for imperative description
      let desc = firstTask;
      if (/^[A-Z][a-z]/.test(desc)) {
        desc = desc.charAt(0).toLowerCase() + desc.slice(1);
      }

      // If there are multiple tasks, append summary
      if (tasks.length > 1) {
        // e.g. "implement user authentication and connect database"
        const secondTask = tasks[1].title;
        let secondDesc = secondTask;
        if (/^[A-Z][a-z]/.test(secondDesc)) {
          secondDesc = secondDesc.charAt(0).toLowerCase() + secondDesc.slice(1);
        }
        
        if (tasks.length === 2) {
          desc += ` and ${secondDesc}`;
        } else {
          desc += `, ${secondDesc} and ${tasks.length - 2} other task(s)`;
        }
      }

      if (conventionalStyle) {
        commitMessage = `feat(${scope}): ${desc}`;
      } else {
        commitMessage = desc;
      }
    } else {
      commitMessage = "chore: update completed tasks";
    }

    logger.info(`MockProvider: returning simulated message "${commitMessage}"`);
    return { mode: "direct", commitMessage };
  }
}

