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

  /**
   * Gets the full diff of all changed files vs HEAD (staged + unstaged).
   * Returns an array of per-file diffs with filenames, suitable for prompting.
   * Equivalent to: git diff HEAD
   */
  public async getFullDiff(repoRoot: string): Promise<FileDiff[]> {
    logger.debug("Running: git diff HEAD");
    try {
      const { stdout } = await execAsync("git diff HEAD", { cwd: repoRoot });
      if (!stdout.trim()) {
        // Also check staged-only changes (nothing unstaged)
        const { stdout: staged } = await execAsync("git diff --cached HEAD", { cwd: repoRoot });
        return this.parseFileDiffs(staged);
      }
      return this.parseFileDiffs(stdout);
    } catch (err) {
      logger.error("git diff HEAD failed", err);
      throw new Error("Failed to get git diff. Make sure you have at least one commit.");
    }
  }

  /**
   * Parses raw unified diff output into per-file sections.
   */
  private parseFileDiffs(rawDiff: string): FileDiff[] {
    if (!rawDiff.trim()) {
      return [];
    }

    const fileDiffs: FileDiff[] = [];
    // Split on diff --git header lines
    const sections = rawDiff.split(/^(?=diff --git )/m);

    for (const section of sections) {
      if (!section.trim()) {
        continue;
      }

      // Extract filename from "diff --git a/... b/..."
      const headerMatch = /^diff --git a\/(.+?) b\/(.+)$/m.exec(section);
      if (!headerMatch) {
        continue;
      }

      const fileName = headerMatch[2].trim();

      // Extract only the hunk lines (@@...@@ + content), skip binary files
      const binaryMatch = /Binary files/.test(section);
      if (binaryMatch) {
        fileDiffs.push({ fileName, diff: "(binary file — skipped)", isBinary: true });
        continue;
      }

      // Collect hunk content (lines starting with @@, +, -, or context)
      const hunkLines = section
        .split("\n")
        .filter((line) => /^(@@|\+|-| )/.test(line) && !line.startsWith("--- ") && !line.startsWith("+++ "))
        .join("\n")
        .trim();

      if (hunkLines) {
        fileDiffs.push({ fileName, diff: hunkLines, isBinary: false });
      }
    }

    return fileDiffs;
  }
}

/** A single file's diff parsed from git output */
export interface FileDiff {
  fileName: string;
  diff: string;
  isBinary: boolean;
}
