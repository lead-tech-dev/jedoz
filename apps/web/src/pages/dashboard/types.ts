export type Wallet = { id: string; userId: string; balance: number };

export type CreditTx = {
  id: string;
  type: 'CREDIT' | 'DEBIT';
  amount: number;
  reason: string;
  createdAt: string;
  meta?: any;
};

export type CreditPack = {
  id: string;
  name: string;
  credits: number;
  price: number;
  currency: string;
  country?: string | null;
};

export type ProState = {
  isPro: boolean;
  active?: { id: string; plan: string; startAt: string; endAt: string; status: string } | null;
};

export type Ad = {
  id: string;
  title: string;
  city: string;
  country: string;
  categorySlug: string;
  status: string;
  createdAt: string;
  badges: string[];
};

export type ChatUser = { id: string; username: string; city?: string | null; country?: string | null };

export type ChatAttachment = {
  id?: string;
  url: string;
  mime?: string | null;
  size?: number | null;
  type?: string | null;
};

export type ChatRead = { userId: string; readAt: string };
export type ChatReaction = { emoji: string; userId: string };

export type ChatMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  type?: string;
  warning?: string | null;
  spamScore?: number;
  meta?: any;
  createdAt: string;
  sender?: { id: string; username: string };
  attachments?: ChatAttachment[];
  reads?: ChatRead[];
  status?: string;
  flagged?: boolean;
  reactions?: ChatReaction[];
};

export type ConversationPreview = {
  id: string;
  adId?: string | null;
  ad?: { id: string; title?: string | null; city?: string | null; country?: string | null; categorySlug?: string | null } | null;
  lastMessageAt?: string | null;
  lastReadAt?: string | null;
  mutedUntil?: string | null;
  pinnedAt?: string | null;
  archivedAt?: string | null;
  unreadCount: number;
  members: ChatUser[];
  lastMessage?: ChatMessage | null;
};
