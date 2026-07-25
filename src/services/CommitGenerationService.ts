import * as vscode from "vscode";
import type { AIProviderConfig } from "../models/AIProviderConfig.js";
import type { CompletedTask } from "../models/CompletedTask.js";
import type { AIProvider } from "../ai/AIProvider.js";
import { AIProviderFactory } from "../ai/AIProviderFactory.js";
import { GitService } from "../git/GitService.js";
import { TasksFileLocator } from "../tasks/TasksFileLocator.js";
import { TaskDiffAnalyzer } from "../tasks/TaskDiffAnalyzer.js";
import { ValidationService } from "./ValidationService.js";
import { formatGitCommands } from "../utils/promptBuilder.js";
import { logger } from "../utils/logger.js";

/** Result returned when generation succeeds in direct mode */
export interface DirectGenerationResult {
  mode: "direct";
  commitMessage: string;
  gitCommands: string;
  tasks: CompletedTask[];
}

/** Result returned when generation succeeds in chat mode */
export interface ChatGenerationResult {
  mode: "chat";
  tasks: CompletedTask[];
}

export type GenerationResult = DirectGenerationResult | ChatGenerationResult;

/**
 * Orchestrates the full commit message generation workflow:
 * 1. Detect git repository
 * 2. Locate TASKS.md
 * 3. Get git diff (HEAD vs working tree)
 * 4. Parse completed tasks
 * 5. Select AI provider
 * 6. Generate + validate commit message
 * 7. Return result for UI layer
 */
export class CommitGenerationService {
  private readonly gitService = new GitService();
  private readonly taskLocator = new TasksFileLocator();
  private readonly taskAnalyzer = new TaskDiffAnalyzer();
  private readonly validator = new ValidationService();

  public async run(config: AIProviderConfig): Promise<GenerationResult> {
    // ── Step 1: Detect Git repository ──────────────────────────────
    logger.info("CommitGenerationService: starting workflow");

    const repoRoot = await this.gitService.getRepoRoot();
    logger.info(`Repository root: ${repoRoot}`);

    // Check for detached HEAD
    const isDetached = await this.gitService.isDetachedHead(repoRoot);
    if (isDetached) {
      throw new Error(
        "Repository is in detached HEAD state. Please checkout a branch before committing."
      );
    }

    // ── Step 2: Locate TASKS.md ────────────────────────────────────
    const tasksFilePath = await this.taskLocator.locate(
      repoRoot,
      config.preferredTasksFilename
    );
    logger.info(`Tasks file: ${tasksFilePath}`);

    // ── Step 3: Get git diff ───────────────────────────────────────
    const diffResult = await this.gitService.getDiffAgainstHead(
      repoRoot,
      tasksFilePath
    );

    if (!diffResult.diff.trim()) {
      throw new Error(
        `No changes detected in "${diffResult.relativeTasksPath}" compared to HEAD.\n\n` +
          "Make sure you have checked off some tasks (changed [ ] to [x]) and that the file has been modified."
      );
    }

    logger.debug(`Diff length: ${diffResult.diff.length} chars`);

    // ── Step 4: Parse completed tasks ─────────────────────────────
    const completedTasks = this.taskAnalyzer.analyze(diffResult.diff);
    logger.info(`Completed tasks found: ${completedTasks.length}`);
    logger.info(this.taskAnalyzer.formatSummary(completedTasks));

    if (completedTasks.length === 0) {
      throw new Error(
        "No completed tasks detected in the diff.\n\n" +
          "Commity only detects tasks that changed from [ ] (unchecked) to [x] (checked). " +
          "New tasks, deleted tasks, and modified descriptions are ignored."
      );
    }

    // ── Step 5: Select AI provider ─────────────────────────────────
    const factory = new AIProviderFactory(config);
    const provider: AIProvider = await factory.resolve();

    // ── Step 6: Generate commit message ────────────────────────────
    const result = await this.generateWithRetry(
      provider,
      completedTasks,
      config
    );

    if (result.mode === "chat") {
      return { mode: "chat", tasks: completedTasks };
    }

    return {
      mode: "direct",
      commitMessage: result.commitMessage,
      gitCommands: formatGitCommands(result.commitMessage),
      tasks: completedTasks,
    };
  }

  private async generateWithRetry(
    provider: AIProvider,
    tasks: CompletedTask[],
    config: AIProviderConfig
  ): Promise<{ mode: "direct"; commitMessage: string } | { mode: "chat" }> {
    // Chat mode doesn't need retry — the chat panel handles it
    const result = await provider.generate(
      tasks,
      config.conventionalCommitStyle,
      config.promptTemplate
    );

    if (result.mode === "chat") {
      return result;
    }

    // For direct providers, validate and retry if needed
    const maxRetries = config.maxRetries;
    let lastMessage = result.commitMessage;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const cleaned = this.validator.clean(lastMessage);

      if (!config.conventionalCommitStyle || this.validator.isValid(cleaned)) {
        logger.info(
          `CommitGenerationService: valid message on attempt ${attempt}: "${cleaned}"`
        );
        return { mode: "direct", commitMessage: cleaned };
      }

      logger.warn(
        `Attempt ${attempt}/${maxRetries}: invalid commit message "${lastMessage}", retrying...`
      );

      if (attempt < maxRetries) {
        const retryResult = await provider.generate(
          tasks,
          config.conventionalCommitStyle,
          config.promptTemplate
        );
        if (retryResult.mode === "chat") {
          return retryResult;
        }
        lastMessage = retryResult.commitMessage;
      }
    }

    // After max retries, return the last cleaned version even if not ideal
    logger.warn(
      `Max retries (${maxRetries}) reached. Using best available: "${lastMessage}"`
    );

    void vscode.window.showWarningMessage(
      `Commity: Could not generate a perfectly formatted Conventional Commit after ${maxRetries} attempts. ` +
        "The best result is shown — you can edit it manually."
    );

    return { mode: "direct", commitMessage: this.validator.clean(lastMessage) };
  }
}
