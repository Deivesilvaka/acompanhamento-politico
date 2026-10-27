import { NVIDIA_CHAT_URL } from '@src/ai/constants/ai.constants';
import { ChatProvider } from '@src/ai/providers/chat-provider';
import { postChatCompletion } from '@src/ai/providers/ai-http.client';

/** NVIDIA (ex.: DeepSeek). Sem busca na web: escreve só com os dados fornecidos. */
export class NvidiaProvider implements ChatProvider {
  readonly name = 'nvidia';
  readonly webSearch = false;

  constructor(
    private readonly apiKey: string,
    readonly model: string,
    private readonly timeoutMs: number,
    private readonly maxWaitSeconds: number,
  ) {}

  complete(system: string, user: string): Promise<string> {
    return postChatCompletion(
      NVIDIA_CHAT_URL,
      this.apiKey,
      {
        model: this.model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0.4,
        max_tokens: 4000,
      },
      this.timeoutMs,
      this.maxWaitSeconds,
    );
  }
}
