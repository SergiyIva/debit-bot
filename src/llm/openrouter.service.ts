import {Injectable, Logger} from '@nestjs/common';
import {AppConfigService} from '../config/app-config.service.js';
import {ParsedExpense, parsedExpenseSchema, RawExpenseInput,} from './expense.schema.js';
import {buildSystemPrompt, USER_INSTRUCTION} from './prompts.js';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }
  | { type: 'input_audio'; input_audio: { data: string; format: string } };

interface ChatMessage {
  role: 'system' | 'user';
  content: string | ContentPart[];
}

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
}

@Injectable()
export class OpenrouterService {
  private readonly logger = new Logger(OpenrouterService.name);

  constructor(private readonly config: AppConfigService) {}

  async extractExpense(input: RawExpenseInput): Promise<ParsedExpense> {
    const todayIso = new Date().toISOString();
    const messages: ChatMessage[] = [
      { role: 'system', content: buildSystemPrompt(todayIso, this.config.timezone) },
      { role: 'user', content: this.buildUserContent(input) },
    ];

    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.openrouterApiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/ml-workshop/expense-bot',
        'X-Title': 'Expense Bot',
      },
      body: JSON.stringify({
        model: this.config.openrouterModel,
        messages,
        response_format: { type: 'json_object' },
        temperature: 0,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter error ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as ChatCompletionResponse;
    if (data.error) {
      throw new Error(`OpenRouter error: ${data.error.message ?? 'unknown'}`);
    }

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('OpenRouter returned an empty response');
    }

    let json: unknown;
    try {
      json = JSON.parse(content);
    } catch (cause) {
      this.logger.warn(`Non-JSON LLM response: ${content}`);
      throw new Error('LLM returned non-JSON response');
    }

    const parsed = parsedExpenseSchema.safeParse(json);
    if (!parsed.success) {
      throw new Error(`LLM response failed schema validation: ${parsed.error.message}`);
    }
    return parsed.data;
  }

  private buildUserContent(input: RawExpenseInput): ContentPart[] {
    switch (input.kind) {
      case 'text':
        return [{ type: 'text', text: input.text }];
      case 'image': {
        return [
          {type: 'text', text: input.caption ?? USER_INSTRUCTION},
          {
            type: 'image_url',
            image_url: {
              url: `data:${input.mime};base64,${input.buffer.toString('base64')}`,
            },
          },
        ];
      }
      case 'audio': {
        return [
          {type: 'text', text: input.caption ?? USER_INSTRUCTION},
          {
            type: 'input_audio',
            input_audio: {
              data: input.buffer.toString('base64'),
              format: input.format,
            },
          },
        ];
      }
    }
  }
}
