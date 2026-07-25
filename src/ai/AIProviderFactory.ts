import type { AIProvider } from "./AIProvider.js";
import { ChatPanelProvider } from "./ChatPanelProvider.js";
import { VsCodeLMProvider } from "./VsCodeLMProvider.js";
import { OpenAICompatibleProvider } from "./OpenAICompatibleProvider.js";
import { OpenRouterProvider } from "./OpenRouterProvider.js";
import { MockProvider } from "./MockProvider.js";
import type { AIProviderConfig } from "../models/AIProviderConfig.js";
import { logger } from "../utils/logger.js";

/**
 * Factory that selects and returns the most appropriate AI provider
 * based on the user's settings and what is actually available at runtime.
 *
 * Priority when `preferredProvider` is `"auto"`:
 *   1. ChatPanelProvider          (Antigravity / Copilot Chat)
 *   2. VsCodeLMProvider           (vscode.lm API)
 *   3. OpenRouterProvider         (openrouter.ai — needs API key)
 *   4. OpenAICompatibleProvider   (if API key or local endpoint set)
 *   5. MockProvider               (always available — last resort)
 */
export class AIProviderFactory {
  constructor(private readonly config: AIProviderConfig) {}

  /**
   * Resolve the AI provider to use.
   * Always returns a working provider (falls back to MockProvider).
   */
  public async resolve(): Promise<AIProvider> {
    const preferred = this.config.preferredProvider;

    if (preferred === "auto") {
      return this.resolveAuto();
    }

    return this.resolveExplicit(preferred);
  }

  private async resolveAuto(): Promise<AIProvider> {
    logger.info("AIProviderFactory: auto-selecting provider...");

    const candidates: AIProvider[] = [
      new ChatPanelProvider(),
      new VsCodeLMProvider(),
      new OpenRouterProvider(this.config),
      new OpenAICompatibleProvider(this.config),
    ];

    for (const candidate of candidates) {
      const available = await candidate.isAvailable();
      if (available) {
        logger.info(`AIProviderFactory: selected "${candidate.name}"`);
        return candidate;
      }
      logger.debug(`AIProviderFactory: "${candidate.name}" not available, trying next`);
    }

    logger.warn(
      "AIProviderFactory: no real provider available, falling back to MockProvider"
    );
    return new MockProvider();
  }

  private async resolveExplicit(
    preferred: AIProviderConfig["preferredProvider"]
  ): Promise<AIProvider> {
    logger.info(`AIProviderFactory: user selected provider "${preferred}"`);

    let provider: AIProvider;

    switch (preferred) {
      case "chat":
        provider = new ChatPanelProvider();
        break;
      case "vscode-lm":
        provider = new VsCodeLMProvider();
        break;
      case "openrouter":
        provider = new OpenRouterProvider(this.config);
        break;
      case "openai":
        provider = new OpenAICompatibleProvider(this.config);
        break;
      case "mock":
        provider = new MockProvider();
        break;
      default:
        logger.warn(`Unknown provider "${preferred}", using auto-select`);
        return this.resolveAuto();
    }

    const available = await provider.isAvailable();
    if (!available) {
      logger.warn(
        `Provider "${provider.name}" is not available. Falling back to auto-select.`
      );
      return this.resolveAuto();
    }

    return provider;
  }
}
