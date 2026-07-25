import * as https from "https";
import * as dns from "dns";
import type { AIGenerationResult, AIProvider } from "./AIProvider.js";
import type { CompletedTask } from "../models/CompletedTask.js";
import type { FileDiff } from "../git/GitService.js";
import type { AIProviderConfig } from "../models/AIProviderConfig.js";
import { buildDirectPrompt, buildDiffDirectPrompt } from "../utils/promptBuilder.js";
import { logger } from "../utils/logger.js";

// Force IPv4 to avoid IPv6 connectivity issues in some environments
dns.setDefaultResultOrder("ipv4first");

interface OpenAIChoice {
  message: { content: string };
}

interface OpenAIResponse {
  choices: OpenAIChoice[];
  error?: { message: string };
}
const OPENROUTER_DEFAULT_MODEL = "openrouter/auto";

/**
 * OpenRouterProvider calls the OpenRouter API (openrouter.ai),
 * which provides access to hundreds of models (GPT-4o, Claude 3.5,
 * Gemini, Llama, Mistral, etc.) through a single OpenAI-compatible endpoint.
 *
 * Default model is "openrouter/auto" which lets OpenRouter pick the best
 * available free/cheap model automatically.
 */
export class OpenRouterProvider implements AIProvider {
  public readonly name = "OpenRouter";

  constructor(private readonly config: AIProviderConfig) {}

  public async isAvailable(): Promise<boolean> {
    const hasKey = this.config.openrouterApiKey.trim().length > 0;
    logger.debug(`OpenRouterProvider: available=${hasKey}`);
    return hasKey;
  }

  public async generate(
    tasks: CompletedTask[],
    conventionalStyle: boolean,
    customTemplate?: string
  ): Promise<AIGenerationResult> {
    const prompt = buildDirectPrompt(tasks, conventionalStyle, customTemplate);
    return this.callApi(prompt);
  }

  public async generateFromDiff(
    fileDiffs: FileDiff[],
    _conventionalStyle: boolean,
    customTemplate?: string
  ): Promise<AIGenerationResult> {
    const prompt = buildDiffDirectPrompt(fileDiffs, customTemplate);
    return this.callApi(prompt);
  }

  private async callApi(prompt: string): Promise<AIGenerationResult> {
    const model = this.config.openrouterModel || OPENROUTER_DEFAULT_MODEL;

    logger.info(`OpenRouterProvider: calling model "${model}" via OpenRouter...`);

    const body = {
      model,
      messages: [
        {
          role: "system" as const,
          content:
            "You are a Git expert. Generate exactly one Conventional Commit message. Output ONLY the commit message string, nothing else.",
        },
        { role: "user" as const, content: prompt },
      ],
      temperature: this.config.temperature,
      max_tokens: 150,
    };

    const responseText = await this.httpPost(body);
    const parsed = JSON.parse(responseText) as OpenAIResponse;

    if (parsed.error) {
      throw new Error(`OpenRouter API error: ${parsed.error.message}`);
    }

    if (!parsed.choices || parsed.choices.length === 0) {
      throw new Error("OpenRouter API returned no choices in response.");
    }

    const commitMessage = parsed.choices[0].message.content.trim();
    logger.info(`OpenRouterProvider: received "${commitMessage}"`);

    return { mode: "direct", commitMessage };
  }

  private httpPost(body: object): Promise<string> {
    return new Promise((resolve, reject) => {
      const bodyStr = JSON.stringify(body);

      const options: https.RequestOptions = {
        hostname: "openrouter.ai",
        port: 443,
        path: "/api/v1/chat/completions",
        method: "POST",
        family: 4, // Force IPv4 — IPv6 hangs on some networks
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(bodyStr),
          "Authorization": `Bearer ${this.config.openrouterApiKey}`,
          "HTTP-Referer": "https://github.com/commity-vscode",
          "X-Title": "Commity VS Code Extension",
        },
      };

      const req = https.request(options, (res) => {
        let data = "";
        res.on("data", (chunk: Buffer) => {
          data += chunk.toString();
        });
        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(
              new Error(
                `OpenRouter API error ${res.statusCode}: ${data.slice(0, 300)}`
              )
            );
          } else {
            resolve(data);
          }
        });
      });

      req.on("error", (err: Error) => {
        reject(new Error(`Network error calling OpenRouter: ${err.message}`));
      });

      req.setTimeout(30_000, () => {
        req.destroy(new Error("Request to OpenRouter timed out after 30 seconds."));
      });

      req.write(bodyStr);
      req.end();
    });
  }
}
