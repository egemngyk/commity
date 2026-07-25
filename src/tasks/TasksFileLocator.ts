import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { logger } from "../utils/logger.js";

/** Candidate filenames to search for, in priority order */
const CANDIDATE_NAMES = ["TASKS.md", "tasks.md", "Todo.md", "TODO.md"];

/**
 * Locates the tasks markdown file inside the repository.
 * Respects the user's preferred filename setting.
 * If multiple candidates are found, prompts the user to choose.
 */
export class TasksFileLocator {
  /**
   * Find the tasks file in the workspace.
   *
   * @param repoRoot - The absolute path to the git repository root
   * @param preferredName - Optional user-preferred filename from settings
   * @returns Absolute path to the selected tasks file
   * @throws If no tasks file is found and user cancels selection
   */
  public async locate(
    repoRoot: string,
    preferredName?: string
  ): Promise<string> {
    // 1. If user specified a preferred filename, try that first
    if (preferredName?.trim()) {
      const preferred = path.join(repoRoot, preferredName.trim());
      if (fs.existsSync(preferred)) {
        logger.info(`Using preferred tasks file: ${preferred}`);
        return preferred;
      }
      logger.warn(
        `Preferred tasks file "${preferredName}" not found, falling back to auto-detect.`
      );
    }

    // 2. Search for candidate files recursively (max depth 3 to avoid deep traversal)
    const found = await this.findCandidates(repoRoot, 3);

    if (found.length === 0) {
      // 3. No file found — ask user to browse
      logger.warn("No tasks file found, prompting user to select manually.");
      return this.promptUserToBrowse(repoRoot);
    }

    if (found.length === 1) {
      logger.info(`Found tasks file: ${found[0]}`);
      return found[0];
    }

    // 4. Multiple candidates — let the user pick
    logger.info(`Found ${found.length} candidate task files, prompting user.`);
    return this.promptUserToChoose(found, repoRoot);
  }

  private async findCandidates(
    dir: string,
    maxDepth: number
  ): Promise<string[]> {
    const results: string[] = [];
    await this.walkDir(dir, dir, 0, maxDepth, results);
    return results;
  }

  private async walkDir(
    rootDir: string,
    currentDir: string,
    depth: number,
    maxDepth: number,
    results: string[]
  ): Promise<void> {
    if (depth > maxDepth) {
      return;
    }

    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
    } catch (err) {
      logger.debug(`Cannot read directory ${currentDir}`, err);
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        // Skip hidden dirs, node_modules, .git
        if (
          entry.name.startsWith(".") ||
          entry.name === "node_modules" ||
          entry.name === "out"
        ) {
          continue;
        }
        await this.walkDir(rootDir, fullPath, depth + 1, maxDepth, results);
      } else if (entry.isFile()) {
        if (CANDIDATE_NAMES.includes(entry.name)) {
          results.push(fullPath);
        }
      }
    }
  }

  private async promptUserToChoose(
    candidates: string[],
    repoRoot: string
  ): Promise<string> {
    const items = candidates.map((filePath) => ({
      label: path.relative(repoRoot, filePath),
      description: filePath,
      filePath,
    }));

    const selected = await vscode.window.showQuickPick(items, {
      title: "Commity: Select Tasks File",
      placeHolder: "Multiple task files found. Which one should Commity analyze?",
    });

    if (!selected) {
      throw new Error("No tasks file selected. Operation cancelled.");
    }

    return selected.filePath;
  }

  private async promptUserToBrowse(repoRoot: string): Promise<string> {
    const selected = await vscode.window.showOpenDialog({
      defaultUri: vscode.Uri.file(repoRoot),
      canSelectMany: false,
      canSelectFolders: false,
      filters: { "Markdown Files": ["md"] },
      title: "Commity: Select your Tasks/TODO file",
    });

    if (!selected || selected.length === 0) {
      throw new Error(
        "No tasks file found. Please create a TASKS.md file or specify one in settings."
      );
    }

    return selected[0].fsPath;
  }
}
