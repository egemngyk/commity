import * as https from "https";
import type { AIGenerationResult, AIProvider } from "./AIProvider.js";
import type { CompletedTask } from "../models/CompletedTask.js";
import type { AIProviderConfig } from "../models/AIProviderConfig.js";
import { buildDirectPrompt } from "../utils/promptBuilder.js";
import { logger } from "../utils/logger.js";

/**
 * WebFreeAIProvider accesses free LLM models (ChatGPT, Claude, Llama 3)
 * via DuckDuckGo's privacy-focused AI Chat API.
 *
 * It does not require login, does not require an API key, is completely
 * headless, and runs directly over lightweight HTTP requests.
 */
export class WebFreeAIProvider implements AIProvider {
  public readonly name = "Free Web AI (no login)";

  constructor(private readonly config: AIProviderConfig) {}

  public async isAvailable(): Promise<boolean> {
    return true; // DuckDuckGo's endpoint is publicly accessible without credentials
  }

  public async generate(
    tasks: CompletedTask[],
    conventionalStyle: boolean,
    customTemplate?: string
  ): Promise<AIGenerationResult> {
    const prompt = buildDirectPrompt(tasks, conventionalStyle, customTemplate);
    const model = this.config.webFreeModel || "gpt-4o-mini";
    logger.info(`WebFreeAIProvider: querying model ${model}...`);

    // 1. Fetch vqd token
    const vqdToken = await this.fetchVqdToken();
    logger.debug(`WebFreeAIProvider: obtained vqd token: ${vqdToken.slice(0, 10)}...`);

    // 2. Chat and stream response
    const commitMessage = await this.chatWithStream(vqdToken, model, prompt);
    logger.info(`WebFreeAIProvider: received "${commitMessage}"`);

    return { mode: "direct", commitMessage };
  }

  /**
   * Performs GET to /status with 'x-temp: 1' to obtain the x-vqd-4 header token.
   */
  private fetchVqdToken(): Promise<string> {
    return new Promise((resolve, reject) => {
      const options: https.RequestOptions = {
        hostname: "duckduckgo.com",
        path: "/duckchat/v1/status",
        method: "GET",
        headers: {
          "x-temp": "1",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        },
      };

      const req = https.request(options, (res) => {
        const token = res.headers["x-vqd-4"];
        if (typeof token === "string") {
          resolve(token);
        } else {
          reject(new Error("DuckDuckGo did not return x-vqd-4 token in status response."));
        }
      });

      req.on("error", (err) => {
        reject(new Error(`Failed to get status token from DuckDuckGo: ${err.message}`));
      });

      req.end();
    });
  }

  /**
   * Posts the prompt to /chat and aggregates the SSE event stream.
   */
  private chatWithStream(vqd: string, model: string, prompt: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const bodyStr = JSON.stringify({
        model: model,
        messages: [{ role: "user", content: prompt }],
      });

      const options: https.RequestOptions = {
        hostname: "duckduckgo.com",
        path: "/duckchat/v1/chat",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "text/event-stream",
          "x-vqd-4": vqd,
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
          "Content-Length": Buffer.byteLength(bodyStr),
        },
      };

      const req = https.request(options, (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          let errorData = "";
          res.on("data", (chunk: Buffer) => {
            errorData += chunk.toString();
          });
          res.on("end", () => {
            reject(
              new Error(
                `DuckDuckGo AI chat error ${res.statusCode}: ${errorData.slice(0, 300)}`
              )
            );
          });
          return;
        }

        let fullText = "";
        let buffer = "";

        res.on("data", (chunk: Buffer) => {
          buffer += chunk.toString();
          const lines = buffer.split("\n");
          // Keep the last partial line in the buffer
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed === "data: [DONE]") {
              continue;
            }

            if (trimmed.startsWith("data: ")) {
              try {
                const dataJson = JSON.parse(trimmed.slice(6));
                if (dataJson.message) {
                  fullText += dataJson.message;
                }
              } catch {
                // Ignore malformed JSON chunks in SSE stream
              }
            }
          }
        });

        res.on("end", () => {
          const finalMessage = fullText.trim();
          if (!finalMessage) {
            reject(new Error("DuckDuckGo returned an empty response stream."));
          } else {
            resolve(finalMessage);
          }
        });
      });

      req.on("error", (err) => {
        reject(new Error(`DuckDuckGo Chat connection error: ${err.message}`));
      });

      req.setTimeout(45_000, () => {
        req.destroy(new Error("Request to DuckDuckGo AI timed out after 45 seconds."));
      });

      req.write(bodyStr);
      req.end();
    });
  }
}
