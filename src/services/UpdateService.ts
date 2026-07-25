import * as vscode from "vscode";
import * as https from "https";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { logger } from "../utils/logger.js";

interface GitHubReleaseAsset {
  name: string;
  browser_download_url: string;
}

interface GitHubReleaseResponse {
  tag_name: string;
  html_url: string;
  assets: GitHubReleaseAsset[];
}

export class UpdateService {
  private readonly repo = "egemngyk/commity";

  /**
   * Checks for updates and prompts the user if a newer version is available.
   * Runs silently in the background.
   */
  public async checkForUpdates(currentVersion: string): Promise<void> {
    // Respect the user/build setting — Marketplace installs should not self-update
    const enabled = vscode.workspace
      .getConfiguration("commity")
      .get<boolean>("enableAutoUpdater", true);

    if (!enabled) {
      logger.info("UpdateService: auto-updater is disabled (enableAutoUpdater=false).");
      return;
    }

    try {
      logger.info(`UpdateService: Checking for updates. Current version: ${currentVersion}`);
      const latestRelease = await this.fetchLatestRelease();
      if (!latestRelease) {
        return;
      }

      const latestVersion = latestRelease.tag_name.replace(/^v/, "");
      if (this.isNewerVersion(currentVersion, latestVersion)) {
        logger.info(`UpdateService: Newer version v${latestVersion} is available.`);
        await this.promptUpdate(latestVersion, latestRelease);
      } else {
        logger.info("UpdateService: Commity is up to date.");
      }
    } catch (err) {
      logger.warn("UpdateService: Failed to check for updates", err);
    }
  }

  private fetchLatestRelease(): Promise<GitHubReleaseResponse | null> {
    return new Promise((resolve) => {
      const options: https.RequestOptions = {
        hostname: "api.github.com",
        path: `/repos/${this.repo}/releases/latest`,
        method: "GET",
        family: 4, // Force IPv4
        headers: {
          "User-Agent": "Commity-VSCode-Extension",
        },
      };

      const req = https.request(options, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode === 200) {
            try {
              resolve(JSON.parse(data));
            } catch {
              resolve(null);
            }
          } else {
            resolve(null);
          }
        });
      });

      req.on("error", () => resolve(null));
      req.end();
    });
  }

  private isNewerVersion(current: string, latest: string): boolean {
    const parse = (v: string) => v.split(".").map(Number);
    const [cMajor, cMinor, cPatch] = parse(current);
    const [lMajor, lMinor, lPatch] = parse(latest);

    if (lMajor > cMajor) return true;
    if (lMajor < cMajor) return false;
    if (lMinor > cMinor) return true;
    if (lMinor < cMinor) return false;
    return lPatch > cPatch;
  }

  private async promptUpdate(version: string, release: GitHubReleaseResponse): Promise<void> {
    const choice = await vscode.window.showInformationMessage(
      `Commity v${version} is available! Would you like to update?`,
      "Update Now",
      "Changelog"
    );

    if (choice === "Changelog") {
      void vscode.env.openExternal(vscode.Uri.parse(release.html_url));
      // Re-prompt after viewing changelog
      void this.promptUpdate(version, release);
    } else if (choice === "Update Now") {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Updating Commity to v${version}...`,
          cancellable: false,
        },
        async (progress) => {
          try {
            const vsixAsset = release.assets.find((a) => a.name.endsWith(".vsix"));
            if (!vsixAsset) {
              throw new Error("No .vsix package found in the latest release assets.");
            }

            progress.report({ message: "Downloading VSIX package..." });
            const tempVsixPath = path.join(os.tmpdir(), vsixAsset.name);
            await this.downloadFile(vsixAsset.browser_download_url, tempVsixPath);

            progress.report({ message: "Installing extension..." });
            await vscode.commands.executeCommand(
              "workbench.extensions.installExtension",
              vscode.Uri.file(tempVsixPath)
            );

            // Clean up temporary file
            try {
              fs.unlinkSync(tempVsixPath);
            } catch {}

            const reloadChoice = await vscode.window.showInformationMessage(
              `Commity successfully updated to v${version}! Please reload VS Code to apply.`,
              "Reload Window"
            );

            if (reloadChoice === "Reload Window") {
              await vscode.commands.executeCommand("workbench.action.reloadWindow");
            }
          } catch (err: any) {
            const msg = err instanceof Error ? err.message : String(err);
            void vscode.window.showErrorMessage(`Update failed: ${msg}`);
          }
        }
      );
    }
  }

  private downloadFile(url: string, dest: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(dest);
      const request = (targetUrl: string) => {
        https.get(
          targetUrl,
          {
            headers: { "User-Agent": "Commity-VSCode-Extension" },
            family: 4, // Force IPv4
          },
          (response) => {
            if (response.statusCode === 302 || response.statusCode === 301) {
              // Handle redirects (GitHub assets redirect to AWS S3)
              if (response.headers.location) {
                request(response.headers.location);
              } else {
                reject(new Error("Redirect location missing."));
              }
              return;
            }

            if (response.statusCode !== 200) {
              reject(new Error(`Failed to download VSIX: HTTP ${response.statusCode}`));
              return;
            }

            response.pipe(file);
            file.on("finish", () => {
              file.close();
              resolve();
            });
          }
        ).on("error", (err) => {
          fs.unlink(dest, () => {});
          reject(err);
        });
      };

      request(url);
    });
  }
}
