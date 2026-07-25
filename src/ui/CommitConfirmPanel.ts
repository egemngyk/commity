import * as vscode from "vscode";
import type { CompletedTask } from "../models/CompletedTask.js";
import { logger } from "../utils/logger.js";

/** Messages sent from the webview to the extension */
type WebviewIncomingMessage =
  | { command: "executeCommit" }
  | { command: "copyToClipboard" }
  | { command: "regenerate" }
  | { command: "close" }
  | { command: "editMessage"; newMessage: string };

/** Callback type for when the user requests regeneration */
export type RegenerateCallback = () => Promise<void>;

/**
 * Manages the Commity webview panel that shows the generated commit
 * commands and allows the user to execute, copy, regenerate, or close.
 */
export class CommitConfirmPanel {
  private static currentPanel: CommitConfirmPanel | undefined;

  private readonly panel: vscode.WebviewPanel;
  private commitMessage: string;
  private gitCommands: string;
  private providerName: string;
  private readonly tasks: CompletedTask[];
  private onRegenerateCallback: RegenerateCallback | undefined;
  private readonly disposables: vscode.Disposable[] = [];

  private constructor(
    panel: vscode.WebviewPanel,
    commitMessage: string,
    gitCommands: string,
    tasks: CompletedTask[],
    providerName: string,
    _extensionUri: vscode.Uri
  ) {
    this.panel = panel;
    this.commitMessage = commitMessage;
    this.gitCommands = gitCommands;
    this.providerName = providerName;
    this.tasks = tasks;

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.panel.webview.onDidReceiveMessage(
      (msg: WebviewIncomingMessage) => this.handleMessage(msg),
      null,
      this.disposables
    );

    this.render();
  }

  /**
   * Create or show the commit confirmation panel.
   */
  public static createOrShow(
    extensionUri: vscode.Uri,
    commitMessage: string,
    gitCommands: string,
    tasks: CompletedTask[],
    providerName: string
  ): CommitConfirmPanel {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (CommitConfirmPanel.currentPanel) {
      CommitConfirmPanel.currentPanel.update(commitMessage, gitCommands, providerName);
      CommitConfirmPanel.currentPanel.panel.reveal(column);
      return CommitConfirmPanel.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(
      "commityConfirm",
      "Commity — Commit Preview",
      column ?? vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, "out"),
          vscode.Uri.joinPath(extensionUri, "icons"),
        ],
      }
    );

    CommitConfirmPanel.currentPanel = new CommitConfirmPanel(
      panel,
      commitMessage,
      gitCommands,
      tasks,
      providerName,
      extensionUri
    );

    return CommitConfirmPanel.currentPanel;
  }

  /** Register the callback to call when user clicks "Regenerate" */
  public onRegenerate(callback: RegenerateCallback): void {
    this.onRegenerateCallback = callback;
  }

  /** Update the panel with a new commit message */
  public update(commitMessage: string, gitCommands: string, providerName?: string): void {
    this.commitMessage = commitMessage;
    this.gitCommands = gitCommands;
    if (providerName) {
      this.providerName = providerName;
    }
    this.render();
  }

  /** Send a message to the webview */
  public postMessage(message: Record<string, unknown>): void {
    void this.panel.webview.postMessage(message);
  }

  private async handleMessage(message: WebviewIncomingMessage): Promise<void> {
    switch (message.command) {
      case "executeCommit":
        await this.executeCommit();
        break;
      case "copyToClipboard":
        await this.copyToClipboard();
        break;
      case "regenerate":
        await this.regenerate();
        break;
      case "close":
        this.panel.dispose();
        break;
      case "editMessage":
        this.commitMessage = message.newMessage;
        this.gitCommands = `git add .\ngit commit -m "${message.newMessage.replace(/"/g, '\\"')}"`;
        break;
    }
  }

  private async executeCommit(): Promise<void> {
    const escaped = this.commitMessage.replace(/"/g, '\\"');
    const terminal = vscode.window.createTerminal({
      name: "Commity",
      message: "Commity is running your git commands...",
    });
    terminal.show(false); // false = don't steal focus from webview
    terminal.sendText("git add .");
    terminal.sendText(`git commit -m "${escaped}"`);
    logger.info(`CommitConfirmPanel: executed commit: "${this.commitMessage}"`);

    void vscode.window.showInformationMessage(
      `✅ Commity: Running git commit in terminal — "${this.commitMessage}"`
    );

    this.panel.dispose();
  }

  private async copyToClipboard(): Promise<void> {
    await vscode.env.clipboard.writeText(this.gitCommands);
    logger.info("CommitConfirmPanel: copied git commands to clipboard");
    void vscode.window.showInformationMessage(
      "✅ Commity: Git commands copied to clipboard!"
    );
  }

  private async regenerate(): Promise<void> {
    if (!this.onRegenerateCallback) {
      void vscode.window.showWarningMessage(
        "Commity: Regenerate callback not set."
      );
      return;
    }

    void this.panel.webview.postMessage({ command: "setLoading", loading: true });
    try {
      await this.onRegenerateCallback();
    } catch (err) {
      void this.panel.webview.postMessage({ command: "setLoading", loading: false });
      const msg = err instanceof Error ? err.message : String(err);
      void vscode.window.showErrorMessage(`Commity: Regenerate failed — ${msg}`);
    }
  }

  private render(): void {
    this.panel.webview.html = this.buildHtml();
  }

  private buildHtml(): string {
    const taskListHtml = this.tasks
      .map(
        (t) =>
          `<li class="task-item"><span class="task-check">✓</span>${this.escapeHtml(t.title)}</li>`
      )
      .join("");

    const commitMessageEscaped = this.escapeHtml(this.commitMessage);
    const providerEscaped = this.escapeHtml(this.providerName);

    // Pick a provider icon
    const providerIcon = this.providerName.toLowerCase().includes("openrouter")
      ? "🌐"
      : this.providerName.toLowerCase().includes("openai")
      ? "⚡"
      : this.providerName.toLowerCase().includes("chat")
      ? "💬"
      : this.providerName.toLowerCase().includes("vscode")
      ? "🔵"
      : this.providerName.toLowerCase().includes("mock")
      ? "🧪"
      : "🤖";

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';" />
  <title>Commity — Commit Preview</title>
  <style>
    :root {
      --bg: var(--vscode-editor-background);
      --fg: var(--vscode-editor-foreground);
      --accent: var(--vscode-button-background, #0e639c);
      --accent-hover: var(--vscode-button-hoverBackground, #1177bb);
      --accent-fg: var(--vscode-button-foreground, #fff);
      --border: var(--vscode-panel-border, rgba(128,128,128,0.35));
      --input-bg: var(--vscode-input-background);
      --input-fg: var(--vscode-input-foreground);
      --input-border: var(--vscode-input-border);
      --badge-bg: var(--vscode-badge-background, #4d4d4d);
      --badge-fg: var(--vscode-badge-foreground, #fff);
      --success: #4caf50;
      --warning: #ff9800;
      --font: var(--vscode-font-family, 'Segoe UI', system-ui, sans-serif);
      --mono: var(--vscode-editor-font-family, 'Cascadia Code', 'Fira Code', monospace);
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: var(--font);
      background: var(--bg);
      color: var(--fg);
      padding: 28px 32px;
      max-width: 780px;
      margin: 0 auto;
      min-height: 100vh;
    }

    /* ── Header ── */
    .header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 28px;
    }
    .header-icon {
      font-size: 28px;
      line-height: 1;
    }
    .header h1 {
      font-size: 1.4rem;
      font-weight: 600;
      letter-spacing: -0.3px;
    }
    .header .subtitle {
      font-size: 0.8rem;
      opacity: 0.55;
      margin-top: 2px;
    }

    /* ── Section labels ── */
    .label {
      font-size: 0.72rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      opacity: 0.55;
      margin-bottom: 8px;
    }

    /* ── Commit message editable ── */
    .commit-message-block {
      background: var(--vscode-textBlockQuote-background, rgba(128,128,128,0.08));
      border-left: 3px solid var(--accent);
      border-radius: 4px;
      padding: 14px 16px;
      margin-bottom: 20px;
    }
    .commit-message-input {
      width: 100%;
      background: transparent;
      border: none;
      outline: none;
      color: var(--fg);
      font-family: var(--mono);
      font-size: 1.05rem;
      font-weight: 500;
      line-height: 1.5;
      resize: none;
      min-height: 2.5rem;
    }
    .commit-message-input:focus {
      outline: 1px solid var(--accent);
      border-radius: 2px;
    }
    .edit-hint {
      font-size: 0.7rem;
      opacity: 0.4;
      margin-top: 6px;
    }

    /* ── Git commands block ── */
    .git-commands-block {
      background: var(--vscode-terminal-background, var(--input-bg));
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 16px 18px;
      margin-bottom: 24px;
      position: relative;
    }
    .git-commands-block pre {
      font-family: var(--mono);
      font-size: 0.9rem;
      line-height: 1.7;
      white-space: pre-wrap;
      word-break: break-all;
    }
    .git-commands-block .cmd-git { color: var(--vscode-terminal-ansiGreen, #4caf50); }
    .git-commands-block .cmd-flag { color: var(--vscode-terminal-ansiYellow, #ff9800); }
    .git-commands-block .cmd-string { color: var(--vscode-terminal-ansiCyan, #00bcd4); }

    /* ── Tasks list ── */
    .tasks-block {
      margin-bottom: 28px;
    }
    .task-list {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .task-item {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      font-size: 0.88rem;
      opacity: 0.8;
    }
    .task-check {
      color: var(--success);
      font-size: 0.9rem;
      margin-top: 1px;
      flex-shrink: 0;
    }

    /* ── Divider ── */
    .divider {
      border: none;
      border-top: 1px solid var(--border);
      margin: 24px 0;
      opacity: 0.4;
    }

    /* ── Action buttons ── */
    .actions {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }
    button {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 9px 18px;
      border: none;
      border-radius: 5px;
      font-family: var(--font);
      font-size: 0.88rem;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.15s, opacity 0.15s, transform 0.1s;
      white-space: nowrap;
    }
    button:active { transform: scale(0.97); }

    .btn-primary {
      background: var(--accent);
      color: var(--accent-fg);
    }
    .btn-primary:hover { background: var(--accent-hover); }

    .btn-secondary {
      background: var(--vscode-button-secondaryBackground, rgba(128,128,128,0.2));
      color: var(--vscode-button-secondaryForeground, var(--fg));
    }
    .btn-secondary:hover {
      background: var(--vscode-button-secondaryHoverBackground, rgba(128,128,128,0.35));
    }

    .btn-danger {
      background: transparent;
      color: var(--vscode-errorForeground, #f44336);
      border: 1px solid var(--vscode-errorForeground, #f44336);
    }
    .btn-danger:hover { background: rgba(244, 67, 54, 0.1); }

    /* ── Loading overlay ── */
    .loading-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.5);
      align-items: center;
      justify-content: center;
      flex-direction: column;
      gap: 16px;
      z-index: 100;
    }
    .loading-overlay.visible { display: flex; }
    .spinner {
      width: 40px; height: 40px;
      border: 3px solid rgba(255,255,255,0.2);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .loading-text { color: #fff; font-size: 0.9rem; opacity: 0.8; }

    /* ── Warning badge ── */
    .mock-warning {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(255, 152, 0, 0.15);
      border: 1px solid rgba(255, 152, 0, 0.4);
      border-radius: 4px;
      padding: 6px 12px;
      font-size: 0.78rem;
      color: var(--warning);
      margin-bottom: 20px;
    }

    /* ── Provider badge ── */
    .provider-badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      background: var(--vscode-badge-background, rgba(128,128,128,0.15));
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 3px 10px;
      font-size: 0.72rem;
      font-weight: 500;
      opacity: 0.75;
      margin-top: 5px;
    }
  </style>
</head>
<body>

  <div class="loading-overlay" id="loadingOverlay">
    <div class="spinner"></div>
    <div class="loading-text">Regenerating commit message...</div>
  </div>

  <div class="header">
    <span class="header-icon">🚀</span>
    <div>
      <h1>Commity</h1>
      <div class="subtitle">Review your commit before running</div>
      <div class="provider-badge">${providerIcon} ${providerEscaped}</div>
    </div>
  </div>

  <div class="label">Generated Commit Message</div>
  <div class="commit-message-block">
    <textarea
      id="commitMessageInput"
      class="commit-message-input"
      rows="2"
      spellcheck="false"
    >${commitMessageEscaped}</textarea>
    <div class="edit-hint">✏️ You can edit the message above before running</div>
  </div>

  <div class="label">Commands to Run</div>
  <div class="git-commands-block">
    <pre id="gitCommandsDisplay"><span class="cmd-git">git</span> add .<br><span class="cmd-git">git</span> commit <span class="cmd-flag">-m</span> <span class="cmd-string" id="commitMsgDisplay">"${commitMessageEscaped}"</span></pre>
  </div>

  <div class="tasks-block">
    <div class="label">Completed Tasks Detected</div>
    <ul class="task-list">
      ${taskListHtml}
    </ul>
  </div>

  <hr class="divider" />

  <div class="actions">
    <button class="btn-primary" onclick="executeCommit()">
      ▶ Run in Terminal
    </button>
    <button class="btn-secondary" onclick="copyCommands()">
      📋 Copy Commands
    </button>
    <button class="btn-secondary" onclick="regenerate()">
      🔄 Regenerate
    </button>
    <button class="btn-danger" onclick="closePanel()">
      ✕ Close
    </button>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    const commitInput = document.getElementById('commitMessageInput');
    const commitDisplay = document.getElementById('commitMsgDisplay');

    // Live-update the command display as user edits the commit message
    commitInput.addEventListener('input', () => {
      const val = commitInput.value.trim();
      commitDisplay.textContent = '"' + val + '"';
      // auto-resize
      commitInput.style.height = 'auto';
      commitInput.style.height = commitInput.scrollHeight + 'px';
      vscode.postMessage({ command: 'editMessage', newMessage: val });
    });

    // Initial resize
    window.addEventListener('load', () => {
      commitInput.style.height = 'auto';
      commitInput.style.height = commitInput.scrollHeight + 'px';
    });

    function executeCommit() {
      vscode.postMessage({ command: 'executeCommit' });
    }

    function copyCommands() {
      vscode.postMessage({ command: 'copyToClipboard' });
    }

    function regenerate() {
      vscode.postMessage({ command: 'regenerate' });
    }

    function closePanel() {
      vscode.postMessage({ command: 'close' });
    }

    // Handle messages from extension
    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (msg.command === 'setLoading') {
        const overlay = document.getElementById('loadingOverlay');
        if (msg.loading) {
          overlay.classList.add('visible');
        } else {
          overlay.classList.remove('visible');
        }
      }
      if (msg.command === 'updateMessage') {
        commitInput.value = msg.commitMessage;
        commitDisplay.textContent = '"' + msg.commitMessage + '"';
        commitInput.style.height = 'auto';
        commitInput.style.height = commitInput.scrollHeight + 'px';
      }
    });
  </script>
</body>
</html>`;
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  public dispose(): void {
    CommitConfirmPanel.currentPanel = undefined;
    this.panel.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}
