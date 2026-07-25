import * as vscode from "vscode";
import { registerGenerateCommitCommand } from "./commands/generateCommitCommand.js";
import { registerCopyCommitCommand } from "./commands/copyCommitCommand.js";
import { registerOpenSettingsCommand } from "./commands/openSettingsCommand.js";
import { logger } from "./utils/logger.js";

/**
 * Extension entry point — called once by VS Code when the extension activates.
 *
 * All commands are registered here and their disposables are pushed into
 * context.subscriptions so VS Code automatically cleans them up on deactivation.
 */
export function activate(context: vscode.ExtensionContext): void {
  logger.info("Commity extension activated");
  logger.info(`Extension path: ${context.extensionUri.fsPath}`);

  // Register all commands
  context.subscriptions.push(
    registerGenerateCommitCommand(context.extensionUri),
    registerCopyCommitCommand(),
    registerOpenSettingsCommand(),
    // Dispose the logger channel when extension is deactivated
    { dispose: () => logger.dispose() }
  );

  logger.info("Commity: all commands registered");
}

/**
 * Called by VS Code when the extension is deactivated.
 * VS Code will call dispose() on all context.subscriptions automatically,
 * so no explicit cleanup is needed here.
 */
export function deactivate(): void {
  logger.info("Commity extension deactivated");
}
