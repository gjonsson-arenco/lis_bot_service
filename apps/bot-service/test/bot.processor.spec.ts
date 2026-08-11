import { Test, TestingModule } from '@nestjs/testing';
import { BotProcessor } from '../src/bot/bot.processor';
import { ClaudeService } from '../src/claude-bot/claude.service';
import { ConversationService } from '../src/conversation/conversation.service';
import { LisClientService } from '../src/lis-client/lis-client.service';
import { BotWhatsappClient } from '../src/bot/bot.whatsapp-client';
import { ConversationSession } from '../src/conversation/conversation.model';

const mockSession = (): ConversationSession => ({
  sessionId: '+1234567890',
  phoneNumber: '+1234567890',
  history: [],
  metadata: {},
  createdAt: new Date(),
  lastUpdatedAt: new Date(),
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
});

describe('BotProcessor', () => {
  let processor: BotProcessor;
  let claude: jest.Mocked<ClaudeService>;
  let conversation: jest.Mocked<ConversationService>;
  let lisClient: jest.Mocked<LisClientService>;
  let whatsapp: jest.Mocked<BotWhatsappClient>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BotProcessor,
        {
          provide: ClaudeService,
          useValue: {
            chat: jest.fn(),
            chatWithToolResult: jest.fn(),
          },
        },
        {
          provide: ConversationService,
          useValue: {
            getOrCreateSession: jest.fn(),
            saveSession: jest.fn(),
          },
        },
        {
          provide: LisClientService,
          useValue: {
            createOrder: jest.fn(),
            queryOrder: jest.fn(),
            listPatientOrders: jest.fn(),
            updateOrderStatus: jest.fn(),
          },
        },
        {
          provide: BotWhatsappClient,
          useValue: {
            sendMessage: jest.fn(),
          },
        },
      ],
    }).compile();

    processor = module.get(BotProcessor);
    claude = module.get(ClaudeService) as jest.Mocked<ClaudeService>;
    conversation = module.get(
      ConversationService,
    ) as jest.Mocked<ConversationService>;
    lisClient = module.get(LisClientService) as jest.Mocked<LisClientService>;
    whatsapp = module.get(BotWhatsappClient) as jest.Mocked<BotWhatsappClient>;
  });

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  describe('processMessage', () => {
    it('sends a plain text response when Claude returns no tool calls', async () => {
      const session = mockSession();
      conversation.getOrCreateSession.mockResolvedValue(session);
      claude.chat.mockResolvedValue({
        text: 'Hola, ¿en qué puedo ayudarte?',
        toolCalls: [],
        stopReason: 'end_turn',
      });
      conversation.saveSession.mockResolvedValue();
      whatsapp.sendMessage.mockResolvedValue();

      await processor.processMessage('+1234567890', 'hola');

      expect(claude.chat).toHaveBeenCalledWith([], 'hola', undefined);
      expect(whatsapp.sendMessage).toHaveBeenCalledWith(
        '+1234567890',
        'Hola, ¿en qué puedo ayudarte?',
      );
      expect(conversation.saveSession).toHaveBeenCalled();
    });

    it('executes tool call and sends result back to Claude', async () => {
      const session = mockSession();
      conversation.getOrCreateSession.mockResolvedValue(session);

      claude.chat.mockResolvedValue({
        text: null,
        toolCalls: [
          {
            id: 'tool_001',
            name: 'create_order',
            input: {
              patientName: 'Juan',
              examType: 'hemograma',
              requestingDoctor: 'Dr. Pérez',
            },
          },
        ],
        stopReason: 'tool_use',
      });

      lisClient.createOrder.mockResolvedValue({ orderId: 'ORD-001' });

      claude.chatWithToolResult.mockResolvedValue({
        text: 'Orden ORD-001 creada correctamente.',
        toolCalls: [],
        stopReason: 'end_turn',
      });

      conversation.saveSession.mockResolvedValue();
      whatsapp.sendMessage.mockResolvedValue();

      await processor.processMessage('+1234567890', 'crear orden hemograma');

      expect(lisClient.createOrder).toHaveBeenCalledWith({
        patientName: 'Juan',
        examType: 'hemograma',
        requestingDoctor: 'Dr. Pérez',
      });
      expect(claude.chatWithToolResult).toHaveBeenCalledWith(
        expect.any(Array),
        'crear orden hemograma',
        'tool_001',
        'create_order',
        { patientName: 'Juan', examType: 'hemograma', requestingDoctor: 'Dr. Pérez' },
        { orderId: 'ORD-001' },
        undefined,
      );
      expect(whatsapp.sendMessage).toHaveBeenCalledWith(
        '+1234567890',
        'Orden ORD-001 creada correctamente.',
      );
    });

    it('sends error message when session load fails', async () => {
      conversation.getOrCreateSession.mockRejectedValue(
        new Error('DynamoDB unavailable'),
      );
      whatsapp.sendMessage.mockResolvedValue();

      await processor.processMessage('+1234567890', 'hola');

      expect(whatsapp.sendMessage).toHaveBeenCalledWith(
        '+1234567890',
        expect.stringContaining('error'),
      );
    });

    it('handles tool execution error gracefully', async () => {
      const session = mockSession();
      conversation.getOrCreateSession.mockResolvedValue(session);

      claude.chat.mockResolvedValue({
        text: null,
        toolCalls: [
          {
            id: 'tool_002',
            name: 'query_order',
            input: { orderId: 'ORD-999' },
          },
        ],
        stopReason: 'tool_use',
      });

      lisClient.queryOrder.mockRejectedValue(new Error('LIS 404'));

      claude.chatWithToolResult.mockResolvedValue({
        text: 'No se encontró la orden.',
        toolCalls: [],
        stopReason: 'end_turn',
      });

      conversation.saveSession.mockResolvedValue();
      whatsapp.sendMessage.mockResolvedValue();

      await processor.processMessage('+1234567890', 'buscar orden ORD-999');

      expect(claude.chatWithToolResult).toHaveBeenCalledWith(
        expect.any(Array),
        'buscar orden ORD-999',
        'tool_002',
        'query_order',
        { orderId: 'ORD-999' },
        expect.objectContaining({ error: true }),
        undefined,
      );
    });
  });
});
