import { BaseAdapter } from './base.js';
import { OpenAIAdapter } from './openai.js';
import { AnthropicAdapter } from './anthropic.js';

export * from './base.js';
export * from './openai.js';
export * from './anthropic.js';

export class AdapterRegistry {
  private adapters: BaseAdapter[] = [
    new OpenAIAdapter(),
    new AnthropicAdapter(),
  ];

  register(adapter: BaseAdapter): void {
    this.adapters.unshift(adapter);
  }

  findAdapter(path: string, headers: Record<string, any>, body: any): BaseAdapter | undefined {
    return this.adapters.find((a) => a.matches(path, headers, body));
  }
}

