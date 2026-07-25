import * as vscode from "vscode";
import type { AIGenerationResult, AIProvider } from "./AIProvider.js";
import type { CompletedTask } from "../models/CompletedTask.js";
import { buildChatPanelPrompt } from "../utils/promptBuilder.js";
import { logger } from "../utils/logger.js";

/** The VS Code command used to open the chat panel with a pre-filled query */
const CHAT_OPEN_COMMAND = "workbench.action.chat.open";

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
      const available = commands.includes(CHAT_OPEN_COMMAND);
      logger.debug(
        `ChatPanelProvider: ${CHAT_OPEN_COMMAND} ${available ? "found" : "not found"}`
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

    logger.info("ChatPanelProvider: sending prompt to chat panel");
    logger.debug("Prompt:\n" + prompt);

    await vscode.commands.executeCommand(CHAT_OPEN_COMMAND, {
      query: prompt,
      isPartialQuery: false,
    });

    // Chat panel is now open with the prompt sent.
    // The AI will respond in the panel — we return "chat" mode.
    return { mode: "chat" };
  }
}
