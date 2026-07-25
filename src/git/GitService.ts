import { exec } from "child_process";
import { promisify } from "util";
import * as vscode from "vscode";
import { logger } from "../utils/logger.js";

const execAsync = promisify(exec);

/** Result of a git diff operation */
export interface GitDiffResult {
  /** Raw unified diff output */
  diff: string;
  /** The absolute path of the repository root */
  repoRoot: string;
  /** The relative path of the tasks file inside the repo */
  relativeTasksPath: string;
}

/**
 * Service responsible for all Git interactions.
 * Uses the child_process module to call the system git binary.
 */
export class GitService {
  /**
   * Detects the Git repository root for the current workspace.
   * Throws if no workspace is open or no git repo is found.
   */
  public async getRepoRoot(): Promise<string> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      throw new Error(
        "No workspace folder is open. Please open a folder that contains a Git repository."
      );
    }

    const cwd = workspaceFolders[0].uri.fsPath;

    try {
      const { stdout } = await execAsync("git rev-parse --show-toplevel", {
        cwd,
      });
      return stdout.trim();
    } catch (err) {
      logger.error("Failed to detect git repository", err);
      throw new Error(
        "No Git repository found in the current workspace. Please initialize a Git repository first."
      );
    }
  }

  /**
   * Checks if the current HEAD is in detached state.
   */
  public async isDetachedHead(repoRoot: string): Promise<boolean> {
    try {
      await execAsync("git symbolic-ref HEAD", { cwd: repoRoot });
      return false;
    } catch {
      return true;
    }
  }

  /**
   * Checks if the git repository has at least one commit.
   */
  public async hasCommits(repoRoot: string): Promise<boolean> {
    try {
      await execAsync("git rev-parse --verify HEAD", { cwd: repoRoot });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Checks if a file exists in the HEAD commit.
   */
  public async fileExistsInHead(
    repoRoot: string,
    absoluteFilePath: string
  ): Promise<boolean> {
    const relativeTasksPath = absoluteFilePath
      .replace(repoRoot, "")
      .replace(/^[/\\]/, "");
    try {
      await execAsync(`git cat-file -e HEAD:"${relativeTasksPath}"`, {
        cwd: repoRoot,
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Gets the git diff for a specific file compared to HEAD.
   * Equivalent to: git diff HEAD -- <filePath>
   */
  public async getDiffAgainstHead(
    repoRoot: string,
    absoluteFilePath: string
  ): Promise<GitDiffResult> {
    // Convert absolute path to relative path from repo root
    const relativeTasksPath = absoluteFilePath
      .replace(repoRoot, "")
      .replace(/^[/\\]/, "");

    logger.debug(`Running: git diff HEAD -- "${relativeTasksPath}"`, {
      repoRoot,
    });

    try {
      const { stdout } = await execAsync(
        `git diff HEAD -- "${relativeTasksPath}"`,
        { cwd: repoRoot }
      );

      return {
        diff: stdout,
        repoRoot,
        relativeTasksPath,
      };
    } catch (err) {
      logger.error(`git diff failed for ${relativeTasksPath}`, err);
      throw new Error(
        `Failed to run git diff on "${relativeTasksPath}". Make sure the file is tracked by Git.`
      );
    }
  }

  /**
   * Checks if the tasks file has any staged or unstaged changes vs HEAD.
   */
  public async hasChanges(
    repoRoot: string,
    absoluteFilePath: string
  ): Promise<boolean> {
    const result = await this.getDiffAgainstHead(repoRoot, absoluteFilePath);
    return result.diff.trim().length > 0;
  }
}
