import * as vscode from "vscode";
import * as fs from "fs";
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
  providerName: string;
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
 * 3. Get git diff (HEAD vs working tree) or parse raw content if first commit
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

    const hasCommits = await this.gitService.hasCommits(repoRoot);

    if (hasCommits) {
      // Check for detached HEAD
      const isDetached = await this.gitService.isDetachedHead(repoRoot);
      if (isDetached) {
        throw new Error(
          "Repository is in detached HEAD state. Please checkout a branch before committing."
        );
      }
    }

    // ── Step 2: Locate TASKS.md (if available) ──────────────────────
    const tasksFilePath = await this.taskLocator.locate(
      repoRoot,
      config.preferredTasksFilename
    );
    logger.info(`Tasks file path: ${tasksFilePath}`);

    let completedTasks: CompletedTask[] = [];
    let fileDiffs: any[] = [];

    // 1. Try extracting completed tasks if a tasks file exists
    if (tasksFilePath !== null) {
      const fileExistsInHead = hasCommits && await this.gitService.fileExistsInHead(repoRoot, tasksFilePath);
      if (!hasCommits || !fileExistsInHead) {
        try {
          const content = await fs.promises.readFile(tasksFilePath, "utf8");
          completedTasks = this.taskAnalyzer.analyzeRawContent(content);
        } catch (err) {
          logger.warn(`Failed to read tasks file: ${tasksFilePath}`, err);
        }
      } else {
        try {
          const diffResult = await this.gitService.getDiffAgainstHead(repoRoot, tasksFilePath);
          if (diffResult.diff.trim()) {
            completedTasks = this.taskAnalyzer.analyze(diffResult.diff);
          }
        } catch (err) {
          logger.warn(`Failed to analyze git diff for ${tasksFilePath}`, err);
        }
      }
    }

    // 2. Always collect general code file diffs as well
    try {
      fileDiffs = await this.gitService.getFullDiff(repoRoot);
    } catch (err) {
      logger.debug("Failed to get full git diff", err);
    }

    logger.info(`Smart Detection: ${completedTasks.length} completed task(s), ${fileDiffs.length} changed file(s).`);

    // 3. Validation: Ensure we have AT LEAST ONE source of changes (tasks or code diff)
    if (completedTasks.length === 0 && fileDiffs.length === 0) {
      throw new Error(
        "No changes detected in Git repository or task list.\n\n" +
          "Please check off completed tasks in your TASKS.md or modify code files before generating a commit message."
      );
    }

    // ── Step 3: Select AI provider ─────────────────────────────────
    const factory = new AIProviderFactory(config);
    const provider: AIProvider = await factory.resolve();

    const ideName = vscode.env.appName;
    const isAntigravity = ideName.toLowerCase().includes("antigravity");
    const agentName = isAntigravity ? "Antigravity AI Agent" : "GitHub Copilot Chat";

    if (config.preferredProvider === "chat") {
      if (provider.name.includes("Chat")) {
        void vscode.window.showInformationMessage(`Commity: Chat panel detected! Active agent: ${agentName}`);
      } else {
        void vscode.window.showWarningMessage(
          `Commity: Preferred Chat panel could not be detected. Falling back to: ${provider.name}. ` +
            `Make sure ${agentName} is installed and logged in.`
        );
      }
    } else if (provider.name.includes("Mock")) {
      void vscode.window.showWarningMessage(
        "Commity: No active AI providers (Chat panel, vscode.lm, or OpenAI API) were detected. " +
          "Running in Test/Mock mode. Please check Commity settings."
      );
    }

    // ── Step 4: Generate commit message via Smart Hybrid Prompt ───
    const result = await this.generateSmartWithRetry(
      provider,
      completedTasks,
      fileDiffs,
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
      providerName: provider.name,
    };
  }



  private async generateSmartWithRetry(
    provider: AIProvider,
    tasks: CompletedTask[],
    fileDiffs: any[],
    config: AIProviderConfig
  ): Promise<{ mode: "direct"; commitMessage: string } | { mode: "chat" }> {
    const fn = provider.generateSmart
      ? provider.generateSmart.bind(provider)
      : tasks.length > 0
      ? provider.generate.bind(provider)
      : provider.generateFromDiff?.bind(provider);

    if (!fn) {
      throw new Error(`Provider "${provider.name}" does not support generating commit messages.`);
    }

    const result = await (provider.generateSmart
      ? provider.generateSmart(tasks, fileDiffs, config.conventionalCommitStyle, config.promptTemplate)
      : tasks.length > 0
      ? provider.generate(tasks, config.conventionalCommitStyle, config.promptTemplate)
      : provider.generateFromDiff!(fileDiffs, config.conventionalCommitStyle, config.promptTemplate));

    if (result.mode === "chat") {
      return result;
    }

    const maxRetries = config.maxRetries;
    let lastMessage = result.commitMessage;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const cleaned = this.validator.clean(lastMessage);

      if (!config.conventionalCommitStyle || this.validator.isValid(cleaned)) {
        logger.info(
          `CommitGenerationService (smart mode): valid message on attempt ${attempt}: "${cleaned}"`
        );
        return { mode: "direct", commitMessage: cleaned };
      }

      logger.warn(
        `Attempt ${attempt}/${maxRetries} (smart mode): invalid commit message "${lastMessage}", retrying...`
      );

      if (attempt < maxRetries) {
        const retryResult = await (provider.generateSmart
          ? provider.generateSmart(tasks, fileDiffs, config.conventionalCommitStyle, config.promptTemplate)
          : tasks.length > 0
          ? provider.generate(tasks, config.conventionalCommitStyle, config.promptTemplate)
          : provider.generateFromDiff!(fileDiffs, config.conventionalCommitStyle, config.promptTemplate));

        if (retryResult.mode === "chat") {
          return retryResult;
        }
        lastMessage = retryResult.commitMessage;
      }
    }

    logger.warn(
      `Max retries (${maxRetries}) reached (smart mode). Using best available: "${lastMessage}"`
    );

    void vscode.window.showWarningMessage(
      `Commity: Could not generate a perfectly formatted Conventional Commit after ${maxRetries} attempts. ` +
        "The best result is shown — you can edit it manually."
    );

    return { mode: "direct", commitMessage: this.validator.clean(lastMessage) };
  }
}

