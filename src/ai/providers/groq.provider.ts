import { GROQ_CHAT_URL } from '@src/ai/constants/ai.constants';
import { ChatProvider } from '@src/ai/providers/chat-provider';
import { postChatCompletion } from '@src/ai/providers/ai-http.client';

/** Groq com a ferramenta nativa `browser_search`: a IA pesquisa na web. */
export class GroqProvider implements ChatProvider {
  readonly name = 'groq';
  readonly webSearch = true;

  constructor(
    private readonly apiKey: string,
    readonly model: string,
    private readonly timeoutMs: number,
    private readonly maxWaitSeconds: number,
  ) {}

  complete(system: string, user: string): Promise<string> {
    return postChatCompletion(
      GROQ_CHAT_URL,
      this.apiKey,
      {
        model: this.model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        tools: [{ type: 'browser_search' }],
        temperature: 0.4,
        max_completion_tokens: 3000,
      },
      this.timeoutMs,
      this.maxWaitSeconds,
    );
  }
}
