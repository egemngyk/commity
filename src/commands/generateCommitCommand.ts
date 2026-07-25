import * as vscode from "vscode";
import type { AIProviderConfig } from "../models/AIProviderConfig.js";
import { CommitGenerationService } from "../services/CommitGenerationService.js";
import { CommitConfirmPanel } from "../ui/CommitConfirmPanel.js";
import { logger } from "../utils/logger.js";

/** In-memory store for the last generated commit message (for copy command) */
let lastCommitMessage: string | undefined;

/**
 * Reads Commity settings from VS Code configuration and
 * returns a typed AIProviderConfig object.
 */
function readConfig(): AIProviderConfig {
  const cfg = vscode.workspace.getConfiguration("commity");
  return {
    preferredProvider: cfg.get<AIProviderConfig["preferredProvider"]>(
      "preferredProvider",
      "auto"
    ),
    openaiApiKey: cfg.get<string>("openaiApiKey", ""),
    openaiBaseUrl: cfg.get<string>(
      "openaiBaseUrl",
      "https://api.openai.com/v1"
    ),
    model: cfg.get<string>("model", "gpt-4o"),
    temperature: cfg.get<number>("temperature", 0.3),
    conventionalCommitStyle: cfg.get<boolean>("conventionalCommitStyle", true),
    promptTemplate: cfg.get<string>("promptTemplate", ""),
    preferredTasksFilename: cfg.get<string>("preferredTasksFilename", ""),
    autoCopy: cfg.get<boolean>("autoCopy", false),
    maxRetries: cfg.get<number>("maxRetries", 3),
    webFreeModel: cfg.get<string>("webFreeModel", "gpt-4o-mini"),
  };
}

/**
 * Sets the last generated commit message (used by copyCommitCommand).
 */
export function setLastCommitMessage(message: string): void {
  lastCommitMessage = message;
}

/**
 * Gets the last generated commit message.
 */
export function getLastCommitMessage(): string | undefined {
  return lastCommitMessage;
}

/**
 * Registers and returns the "Commity: Generate Commit Message" command.
 */
export function registerGenerateCommitCommand(
  extensionUri: vscode.Uri
): vscode.Disposable {
  return vscode.commands.registerCommand(
    "commity.generateCommitMessage",
    async () => {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Commity",
          cancellable: false,
        },
        async (progress) => {
          try {
            progress.report({ message: "Analyzing TASKS.md diff..." });

            const config = readConfig();
            const service = new CommitGenerationService();
            const result = await service.run(config);

            if (result.mode === "chat") {
              // Prompt was sent to the chat panel — nothing more to do here.
              progress.report({
                message: "Prompt sent to chat panel! ✓",
                increment: 100,
              });
              logger.info(
                "generateCommitCommand: prompt sent to chat panel, tasks=" +
                  result.tasks.length
              );
              return;
            }

            // Direct mode: show the confirmation webview
            progress.report({
              message: "Commit message generated! ✓",
              increment: 100,
            });

            setLastCommitMessage(result.commitMessage);

            if (config.autoCopy) {
              await vscode.env.clipboard.writeText(result.gitCommands);
              logger.info(
                "generateCommitCommand: autoCopy — git commands copied to clipboard"
              );
            }

            logger.info(
              `generateCommitCommand: showing panel for "${result.commitMessage}"`
            );

            const panel = CommitConfirmPanel.createOrShow(
              extensionUri,
              result.commitMessage,
              result.gitCommands,
              result.tasks
            );

            // Hook up the Regenerate button
            panel.onRegenerate(async () => {
              const newConfig = readConfig();
              const newResult = await service.run(newConfig);
              if (newResult.mode === "direct") {
                setLastCommitMessage(newResult.commitMessage);
                panel.update(newResult.commitMessage, newResult.gitCommands);
                panel.postMessage({
                  command: "updateMessage",
                  commitMessage: newResult.commitMessage,
                });
                panel.postMessage({ command: "setLoading", loading: false });
              }
            });
          } catch (err) {
            const message =
              err instanceof Error ? err.message : String(err);
            logger.error("generateCommitCommand failed", err);
            void vscode.window.showErrorMessage(`Commity: ${message}`);
          }
        }
      );
    }
  );
}
