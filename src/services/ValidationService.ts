import { CONVENTIONAL_COMMIT_REGEX } from "../models/CommitMessage.js";
import { logger } from "../utils/logger.js";

/**
 * Validates AI-generated commit messages against Conventional Commit format.
 */
export class ValidationService {
  /**
   * Check if the given string is a valid Conventional Commit message.
   *
   * Valid examples:
   *   feat(engine): implement physics engine
   *   fix: resolve null pointer exception
   *   refactor(core)!: breaking change in entity manager
   */
  public isValid(message: string): boolean {
    const trimmed = message.trim();
    if (!trimmed) {
      return false;
    }

    // Strip any accidental markdown code fences or quotes
    const cleaned = this.strip(trimmed);
    const valid = CONVENTIONAL_COMMIT_REGEX.test(cleaned);

    if (!valid) {
      logger.debug(`Validation failed for: "${cleaned}"`);
    }

    return valid;
  }

  /**
   * Clean an AI response that might contain markdown/quotes.
   * Returns only the raw commit message string.
   */
  public clean(raw: string): string {
    let cleaned = raw.trim();

    // Remove markdown code fences
    cleaned = cleaned.replace(/^```[a-z]*\n?/i, "").replace(/```$/i, "");

    // Remove surrounding quotes
    cleaned = cleaned.replace(/^["'`]|["'`]$/g, "");

    // Take only the first line (AI sometimes adds explanations after)
    const firstLine = cleaned.split("\n")[0].trim();

    return firstLine;
  }

  private strip(message: string): string {
    return this.clean(message);
  }
}
