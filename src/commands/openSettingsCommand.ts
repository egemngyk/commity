import * as vscode from "vscode";
import { logger } from "../utils/logger.js";

/**
 * Registers and returns the "Commity: Open Settings" command.
 * Opens the VS Code Settings UI filtered to the Commity section.
 */
export function registerOpenSettingsCommand(): vscode.Disposable {
  return vscode.commands.registerCommand("commity.openSettings", async () => {
    logger.info("openSettingsCommand: opening Commity settings");
    await vscode.commands.executeCommand(
      "workbench.action.openSettings",
      "@ext:egemngyk.commity"
    );
  });
}
