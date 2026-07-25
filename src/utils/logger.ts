import * as vscode from "vscode";

/** Log levels */
type LogLevel = "INFO" | "WARN" | "ERROR" | "DEBUG";

/**
 * Centralized logger that writes to a VS Code OutputChannel.
 * All log entries include timestamps and log levels.
 */
export class Logger {
  private static instance: Logger;
  private readonly channel: vscode.OutputChannel;

  private constructor() {
    this.channel = vscode.window.createOutputChannel("Commity");
  }

  /** Get the singleton logger instance */
  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /** Log an informational message */
  public info(message: string, ...args: unknown[]): void {
    this.log("INFO", message, args);
  }

  /** Log a warning message */
  public warn(message: string, ...args: unknown[]): void {
    this.log("WARN", message, args);
  }

  /** Log an error message */
  public error(message: string, error?: unknown): void {
    if (error instanceof Error) {
      this.log("ERROR", `${message}: ${error.message}`);
      if (error.stack) {
        this.log("ERROR", error.stack);
      }
    } else if (error !== undefined) {
      this.log("ERROR", `${message}: ${String(error)}`);
    } else {
      this.log("ERROR", message);
    }
  }

  /** Log a debug message */
  public debug(message: string, ...args: unknown[]): void {
    this.log("DEBUG", message, args);
  }

  /** Show the output channel to the user */
  public show(): void {
    this.channel.show();
  }

  /** Dispose the output channel */
  public dispose(): void {
    this.channel.dispose();
  }

  private log(level: LogLevel, message: string, args: unknown[] = []): void {
    const timestamp = new Date().toISOString();
    const argsStr = args.length > 0 ? ` ${JSON.stringify(args)}` : "";
    this.channel.appendLine(`[${timestamp}] [${level}] ${message}${argsStr}`);
  }
}

/** Convenience singleton export */
export const logger = Logger.getInstance();
