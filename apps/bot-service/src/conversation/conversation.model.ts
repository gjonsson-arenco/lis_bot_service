export interface ConversationHistory {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface ConversationSession {
  sessionId: string;
  phoneNumber: string;
  history: ConversationHistory[];
  metadata: Record<string, any>;
  createdAt: Date;
  lastUpdatedAt: Date;
  expiresAt: Date;
}

export interface IBotService {
  processMessage(
    phoneNumber: string,
    text: string,
    mediaUrl?: string,
  ): Promise<void>;

  getSession(sessionId: string): Promise<ConversationSession | null>;

  saveSession(
    sessionId: string,
    session: ConversationSession,
  ): Promise<void>;
}
