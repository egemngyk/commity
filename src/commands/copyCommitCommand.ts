import * as vscode from "vscode";
import { getLastCommitMessage } from "./generateCommitCommand.js";
import { formatGitCommands } from "../utils/promptBuilder.js";
import { logger } from "../utils/logger.js";

/**
 * Registers and returns the "Commity: Copy Commit Message" command.
 * Copies the last generated git commands to the clipboard.
 */
export function registerCopyCommitCommand(): vscode.Disposable {
  return vscode.commands.registerCommand(
    "commity.copyCommitMessage",
    async () => {
      const lastMessage = getLastCommitMessage();

      if (!lastMessage) {
        void vscode.window.showWarningMessage(
          "Commity: No commit message generated yet. Run 'Commity: Generate Commit Message' first."
        );
        return;
      }

      const commands = formatGitCommands(lastMessage);
      await vscode.env.clipboard.writeText(commands);

      logger.info(`copyCommitCommand: copied to clipboard — "${lastMessage}"`);
      void vscode.window.showInformationMessage(
        `Commity: Git commands copied to clipboard!`
      );
    }
  );
}
