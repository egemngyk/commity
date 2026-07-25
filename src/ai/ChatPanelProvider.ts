import * as vscode from "vscode";
import type { AIGenerationResult, AIProvider } from "./AIProvider.js";
import type { CompletedTask } from "../models/CompletedTask.js";
import { buildChatPanelPrompt } from "../utils/promptBuilder.js";
import { logger } from "../utils/logger.js";

/** Standard VS Code chat open command */
const CHAT_OPEN_COMMAND = "workbench.action.chat.open";
/** Antigravity IDE specific agent prompt command */
const ANTIGRAVITY_PROMPT_COMMAND = "antigravity.sendPromptToAgentPanel";
/** Antigravity IDE open agent command */
const ANTIGRAVITY_OPEN_COMMAND = "antigravity.openAgent";

/**
 * ChatPanelProvider sends the generated prompt directly to the IDE's
 * built-in chat panel (Antigravity agent or GitHub Copilot Chat).
 *
 * The AI's response appears in the chat panel — the extension does NOT
 * capture it programmatically (no internal API available).
 *
 * The prompt instructs the AI to respond with:
 *   git add .
 *   git commit -m "type(scope): description"
 */
export class ChatPanelProvider implements AIProvider {
  public readonly name = "Chat Panel (Antigravity / Copilot)";

  public async isAvailable(): Promise<boolean> {
    try {
      const commands = await vscode.commands.getCommands(true);
      const copilotAvailable = commands.includes(CHAT_OPEN_COMMAND);
      const antigravityAvailable = commands.includes(ANTIGRAVITY_PROMPT_COMMAND);
      
      const available = copilotAvailable || antigravityAvailable;
      logger.debug(
        `ChatPanelProvider availability: copilot=${copilotAvailable}, antigravity=${antigravityAvailable}`
      );
      return available;
    } catch (err) {
      logger.warn("ChatPanelProvider: failed to check available commands", err);
      return false;
    }
  }

  public async generate(
    tasks: CompletedTask[],
    _conventionalStyle: boolean,
    customTemplate?: string
  ): Promise<AIGenerationResult> {
    const prompt = buildChatPanelPrompt(tasks, customTemplate);
    const commands = await vscode.commands.getCommands(true);

    logger.debug("Prompt:\n" + prompt);

    if (commands.includes(ANTIGRAVITY_PROMPT_COMMAND)) {
      logger.info("ChatPanelProvider: sending prompt to Antigravity Agent Panel");
      
      // Ensure the agent side panel is opened/focused first
      if (commands.includes(ANTIGRAVITY_OPEN_COMMAND)) {
        await vscode.commands.executeCommand(ANTIGRAVITY_OPEN_COMMAND);
      }

      // Send prompt to agent panel directly as a string
      await vscode.commands.executeCommand(ANTIGRAVITY_PROMPT_COMMAND, prompt);
    } else {
      logger.info("ChatPanelProvider: sending prompt to VS Code Copilot Chat panel");
      await vscode.commands.executeCommand(CHAT_OPEN_COMMAND, {
        query: prompt,
        isPartialQuery: false,
      });
    }

    // Chat panel is now open with the prompt sent.
    // The AI will respond in the panel — we return "chat" mode.
    return { mode: "chat" };
  }
}

