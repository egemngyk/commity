/** Available AI provider identifiers */
export type AIProviderType = "auto" | "chat" | "vscode-lm" | "openai" | "openrouter" | "mock";

/** Configuration for AI providers */
export interface AIProviderConfig {
  preferredProvider: AIProviderType;
  openaiApiKey: string;
  openaiBaseUrl: string;
  model: string;
  temperature: number;
  maxRetries: number;
  conventionalCommitStyle: boolean;
  promptTemplate: string;
  preferredTasksFilename: string;
  autoCopy: boolean;
  openrouterApiKey: string;
  openrouterModel: string;
}

