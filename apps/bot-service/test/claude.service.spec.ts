import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ClaudeService } from '../src/claude-bot/claude.service';

const mockCreate = jest.fn();

jest.mock('@anthropic-ai/sdk', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      messages: {
        create: mockCreate,
      },
    })),
  };
});

describe('ClaudeService', () => {
  let service: ClaudeService;

  beforeEach(async () => {
    mockCreate.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClaudeService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              const config: Record<string, string> = {
                CLAUDE_API_KEY: 'test-key',
                CLAUDE_MODEL: 'claude-test',
              };
              return config[key];
            },
          },
        },
      ],
    }).compile();

    service = module.get(ClaudeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('chat', () => {
    it('returns text response when Claude returns text block', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Respuesta de Claude' }],
        stop_reason: 'end_turn',
      });

      const result = await service.chat([], 'hola');

      expect(result.text).toBe('Respuesta de Claude');
      expect(result.toolCalls).toHaveLength(0);
      expect(result.stopReason).toBe('end_turn');
    });

    it('returns tool calls when Claude returns tool_use block', async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'tool_use',
            id: 'tool_abc',
            name: 'create_order',
            input: {
              patientName: 'María',
              examType: 'glucosa',
              requestingDoctor: 'Dr. García',
            },
          },
        ],
        stop_reason: 'tool_use',
      });

      const result = await service.chat([], 'crear orden');

      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0]).toMatchObject({
        id: 'tool_abc',
        name: 'create_order',
        input: { patientName: 'María' },
      });
      expect(result.stopReason).toBe('tool_use');
    });

    it('includes history in the messages sent to Claude', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'ok' }],
        stop_reason: 'end_turn',
      });

      const history = [
        { role: 'user' as const, content: 'primer mensaje', timestamp: new Date() },
        { role: 'assistant' as const, content: 'primera respuesta', timestamp: new Date() },
      ];

      await service.chat(history, 'nuevo mensaje');

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages).toHaveLength(3); // 2 history + 1 new
      expect(callArgs.messages[0]).toMatchObject({ role: 'user', content: 'primer mensaje' });
      expect(callArgs.messages[2]).toMatchObject({ role: 'user', content: 'nuevo mensaje' });
    });

    it('sends system prompt and tools to Claude', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'ok' }],
        stop_reason: 'end_turn',
      });

      await service.chat([], 'test');

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.system).toBeDefined();
      expect(callArgs.tools).toBeDefined();
      expect(Array.isArray(callArgs.tools)).toBe(true);
      expect(callArgs.tools.length).toBeGreaterThan(0);
    });
  });
});
