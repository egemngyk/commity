import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
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

  // Log available chat/agent/antigravity commands to commands_debug.txt for debugging
  void vscode.commands.getCommands(true).then((commands) => {
    const relevant = commands.filter(
      (c) =>
        c.toLowerCase().includes("chat") ||
        c.toLowerCase().includes("agent") ||
        c.toLowerCase().includes("antigravity") ||
        c.toLowerCase().includes("copilot")
    );
    try {
      const debugFilePath = path.join(context.extensionUri.fsPath, "commands_debug.txt");
      fs.writeFileSync(debugFilePath, JSON.stringify(relevant, null, 2), "utf8");
      logger.info(`Successfully wrote registered chat commands to ${debugFilePath}`);
    } catch (err) {
      logger.error("Failed to write commands debug file", err);
    }
  });

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
