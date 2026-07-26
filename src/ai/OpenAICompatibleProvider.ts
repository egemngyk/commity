import * as https from "https";
import * as http from "http";
import { URL } from "url";
import type { AIGenerationResult, AIProvider } from "./AIProvider.js";
import type { CompletedTask } from "../models/CompletedTask.js";
import type { FileDiff } from "../git/GitService.js";
import type { AIProviderConfig } from "../models/AIProviderConfig.js";
import { buildDirectPrompt, buildDiffDirectPrompt, buildSmartDirectPrompt } from "../utils/promptBuilder.js";
import { logger } from "../utils/logger.js";

interface OpenAIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenAIRequest {
  model: string;
  messages: OpenAIMessage[];
  temperature: number;
  max_tokens: number;
}

interface OpenAIChoice {
  message: { content: string };
}

interface OpenAIResponse {
  choices: OpenAIChoice[];
}

/**
 * OpenAICompatibleProvider calls any OpenAI-compatible HTTP endpoint
 * (OpenAI, Ollama, LM Studio, Groq, Mistral, etc.) to generate
 * commit messages.
 *
 * Uses Node's built-in `https` / `http` modules — no external deps.
 */
export class OpenAICompatibleProvider implements AIProvider {
  public readonly name = "OpenAI-Compatible HTTP API";

  constructor(private readonly config: AIProviderConfig) {}

  public async isAvailable(): Promise<boolean> {
    const hasKey =
      this.config.openaiApiKey.trim().length > 0 ||
      this.isLocalEndpoint(this.config.openaiBaseUrl);
    logger.debug(
      `OpenAICompatibleProvider: available=${hasKey} (baseUrl=${this.config.openaiBaseUrl})`
    );
    return hasKey;
  }

  public async generate(
    tasks: CompletedTask[],
    conventionalStyle: boolean,
    customTemplate?: string
  ): Promise<AIGenerationResult> {
    const prompt = buildDirectPrompt(tasks, conventionalStyle, customTemplate);
    logger.info(
      `OpenAICompatibleProvider: calling ${this.config.openaiBaseUrl} with model ${this.config.model}`
    );
    return this.callApi(prompt);
  }

  public async generateFromDiff(
    fileDiffs: FileDiff[],
    _conventionalStyle: boolean,
    customTemplate?: string
  ): Promise<AIGenerationResult> {
    const prompt = buildDiffDirectPrompt(fileDiffs, customTemplate);
    logger.info(
      `OpenAICompatibleProvider (diff mode): calling ${this.config.openaiBaseUrl} with model ${this.config.model}`
    );
    return this.callApi(prompt);
  }

  public async generateSmart(
    tasks: CompletedTask[],
    fileDiffs: FileDiff[],
    conventionalStyle: boolean,
    customTemplate?: string
  ): Promise<AIGenerationResult> {
    const prompt = buildSmartDirectPrompt(tasks, fileDiffs, conventionalStyle, customTemplate);
    logger.info(
      `OpenAICompatibleProvider (smart mode): calling ${this.config.openaiBaseUrl} with model ${this.config.model}`
    );
    return this.callApi(prompt);
  }

  private async callApi(prompt: string): Promise<AIGenerationResult> {
    const body: OpenAIRequest = {
      model: this.config.model,
      messages: [
        {
          role: "system",
          content:
            "You are a Git expert. Generate exactly one Conventional Commit message. Output ONLY the commit message string, nothing else.",
        },
        { role: "user", content: prompt },
      ],
      temperature: this.config.temperature,
      max_tokens: 150,
    };

    const responseText = await this.httpPost(
      `${this.config.openaiBaseUrl}/chat/completions`,
      body,
      this.config.openaiApiKey
    );

    const parsed = JSON.parse(responseText) as OpenAIResponse;

    if (!parsed.choices || parsed.choices.length === 0) {
      throw new Error("OpenAI API returned no choices in response.");
    }

    const commitMessage = parsed.choices[0].message.content.trim();
    logger.info(`OpenAICompatibleProvider: received "${commitMessage}"`);

    return { mode: "direct", commitMessage };
  }

  private isLocalEndpoint(url: string): boolean {
    return (
      url.includes("localhost") ||
      url.includes("127.0.0.1") ||
      url.includes("0.0.0.0")
    );
  }

  private httpPost(
    urlStr: string,
    body: OpenAIRequest,
    apiKey: string
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const parsed = new URL(urlStr);
      const bodyStr = JSON.stringify(body);

      const options: https.RequestOptions = {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
        path: parsed.pathname + (parsed.search || ""),
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(bodyStr),
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
      };

      const lib = parsed.protocol === "https:" ? https : http;
      const req = lib.request(options, (res) => {
        let data = "";
        res.on("data", (chunk: Buffer) => {
          data += chunk.toString();
        });
        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(
              new Error(
                `OpenAI API error ${res.statusCode}: ${data.slice(0, 300)}`
              )
            );
          } else {
            resolve(data);
          }
        });
      });

      req.on("error", (err: Error) => {
        reject(
          new Error(`Network error calling OpenAI-compatible API: ${err.message}`)
        );
      });

      req.setTimeout(30_000, () => {
        req.destroy(new Error("Request to AI API timed out after 30 seconds."));
      });

      req.write(bodyStr);
      req.end();
    });
  }
}
