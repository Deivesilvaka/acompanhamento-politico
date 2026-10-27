export interface ChatProvider {
  readonly name: string;
  readonly model: string;
  readonly webSearch: boolean;
  complete(system: string, user: string): Promise<string>;
}
