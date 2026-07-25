import * as vscode from "vscode";
import type { AIGenerationResult, AIProvider } from "./AIProvider.js";
import type { CompletedTask } from "../models/CompletedTask.js";
import { buildDirectPrompt } from "../utils/promptBuilder.js";
import { logger } from "../utils/logger.js";

/**
 * VsCodeLMProvider uses the official VS Code Language Model API
 * (`vscode.lm`) to generate commit messages.
 *
 * This API is available when GitHub Copilot (or any compatible
 * language model extension) is installed and active.
 *
 * Because Antigravity IDE is a VS Code fork, this API may also
 * function there if Copilot or another LM extension is present.
 *
 * @see https://code.visualstudio.com/api/references/vscode-api#lm
 */
export class VsCodeLMProvider implements AIProvider {
  public readonly name = "VS Code Language Model API (vscode.lm)";

  public async isAvailable(): Promise<boolean> {
    try {
      if (!("lm" in vscode)) {
        logger.debug("VsCodeLMProvider: vscode.lm namespace not present");
        return false;
      }
      const models = await vscode.lm.selectChatModels({});
      const available = models.length > 0;
      logger.debug(
        `VsCodeLMProvider: found ${models.length} model(s) — ${available ? "available" : "unavailable"}`
      );
      return available;
    } catch (err) {
      logger.debug("VsCodeLMProvider: not available", err);
      return false;
    }
  }

  public async generate(
    tasks: CompletedTask[],
    conventionalStyle: boolean,
    customTemplate?: string
  ): Promise<AIGenerationResult> {
    const models = await vscode.lm.selectChatModels({});
    if (models.length === 0) {
      throw new Error(
        "No VS Code language models are available. Please install GitHub Copilot or another LM extension."
      );
    }

    const model = models[0];
    logger.info(`VsCodeLMProvider: using model "${model.name}" (${model.id})`);

    const prompt = buildDirectPrompt(tasks, conventionalStyle, customTemplate);
    logger.debug("VsCodeLMProvider prompt:\n" + prompt);

    const messages = [vscode.LanguageModelChatMessage.User(prompt)];

    const response = await model.sendRequest(
      messages,
      {},
      new vscode.CancellationTokenSource().token
    );

    let commitMessage = "";
    for await (const chunk of response.text) {
      commitMessage += chunk;
    }

    commitMessage = commitMessage.trim();
    logger.info(`VsCodeLMProvider: received commit message: "${commitMessage}"`);

    return { mode: "direct", commitMessage };
  }
}
