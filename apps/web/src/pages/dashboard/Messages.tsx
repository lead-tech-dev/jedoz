import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { apiFetch, API_BASE, getToken } from '../../lib/api';
import { notifyError, notifyInfo, notifySuccess } from '../../lib/toast';
import { useI18n } from '../../lib/i18n';
import { ChatMessage, ConversationPreview } from './types';

type UploadItem = {
  url: string;
  mime?: string | null;
  size?: number | null;
  type?: string | null;
  name?: string | null;
};

const MAX_ATTACHMENTS = 4;

function resolveMediaUrl(url: string) {
  if (!url) return url;
  return url.startsWith('http') ? url : `${API_BASE}${url}`;
}

function isImageAttachment(att: { url: string; mime?: string | null; type?: string | null }) {
  if (att.type && att.type.toLowerCase() === 'image') return true;
  if (att.mime && att.mime.startsWith('image/')) return true;
  return /\.(png|jpe?g|webp|gif)$/i.test(att.url);
}

function isAudioAttachment(att: { url: string; mime?: string | null; type?: string | null }) {
  if (att.type && att.type.toLowerCase() === 'audio') return true;
  if (att.mime && att.mime.startsWith('audio/')) return true;
  return /\.(mp3|wav|m4a|aac|ogg)$/i.test(att.url);
}

function getMessagePreview(message: ChatMessage | null | undefined, tx: (fr: string, en: string) => string) {
  if (!message) return '';
  const type = message.type || 'text';
  if (type === 'sticker') return message.body || tx('Sticker', 'Sticker');
  if (type === 'call') return tx('Appel audio', 'Audio call');
  if (type === 'voice') return tx('Message vocal', 'Voice message');
  if (message.attachments?.length) return tx('Pièce jointe', 'Attachment');
  return message.body || '';
}

function groupReactions(reactions: { emoji: string; userId: string }[], meId?: string | null) {
  const buckets = new Map<string, { emoji: string; count: number; reacted: boolean }>();
  reactions.forEach((r) => {
    const entry = buckets.get(r.emoji) || { emoji: r.emoji, count: 0, reacted: false };
    entry.count += 1;
    if (meId && r.userId === meId) entry.reacted = true;
    buckets.set(r.emoji, entry);
  });
  return Array.from(buckets.values());
}

const STICKER_OPTIONS = ['💋', '🔥', '😍', '😊', '😈', '💖', '🎉'];
const REACTION_OPTIONS = ['❤️', '👍', '😂', '😮', '😢', '🔥'];

function isMutedUntil(mutedUntil?: string | null) {
  if (!mutedUntil) return false;
  return new Date(mutedUntil).getTime() > Date.now();
}

export function D_Threads() {
  const { tx, lang } = useI18n();
  const [items, setItems] = React.useState<ConversationPreview[]>([]);
  const [error, setError] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [showArchived, setShowArchived] = React.useState(false);
  const [meId, setMeId] = React.useState<string | null>(null);
  const socketRef = React.useRef<any>(null);
  const joinedRef = React.useRef<Set<string>>(new Set());
  const locale = lang === 'fr' ? 'fr-FR' : 'en-US';

  React.useEffect(() => {
    let mounted = true;
    setLoading(true);
    const query = showArchived ? '?archived=1' : '';
    Promise.all([
      apiFetch<any>('/me'),
      apiFetch<{ items: ConversationPreview[] }>(`/conversations${query}`),
    ])
      .then(([me, convs]) => {
        if (!mounted) return;
        setMeId(me?.id || null);
        setItems(convs.items || []);
        setError(null);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err);
        notifyError(err, tx('Impossible de charger les conversations.', 'Unable to load conversations.'));
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [showArchived]);

  React.useEffect(() => {
    const token = getToken();
    if (!token || !meId) return undefined;
    const socket = io(API_BASE, { auth: { token } });
    socketRef.current = socket;

    const onMessage = (msg: ChatMessage) => {
      setItems((prev) => {
        const next = prev.map((c) => {
          if (c.id !== msg.conversationId) return c;
          const inc = msg.senderId && meId && msg.senderId !== meId ? 1 : 0;
          return {
            ...c,
            lastMessage: msg,
            lastMessageAt: msg.createdAt,
            unreadCount: (c.unreadCount || 0) + inc,
          };
        });
        return next;
      });
    };

    socket.on('message:new', onMessage);

    return () => {
      socket.off('message:new', onMessage);
      socket.disconnect();
      socketRef.current = null;
      joinedRef.current.clear();
    };
  }, [meId]);

  React.useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;
    items.forEach((c) => {
      if (joinedRef.current.has(c.id)) return;
      socket.emit('conversation:join', { conversationId: c.id });
      joinedRef.current.add(c.id);
    });
  }, [items]);

  const toggleArchive = async (conv: ConversationPreview) => {
    try {
      const archive = !conv.archivedAt;
      const res = await apiFetch<{ archivedAt: string | null }>(`/conversations/${conv.id}/archive`, {
        method: 'POST',
        body: JSON.stringify({ archive }),
      });
      setItems((prev) => {
        if ((archive && !showArchived) || (!archive && showArchived)) {
          return prev.filter((c) => c.id !== conv.id);
        }
        return prev.map((c) => (c.id === conv.id ? { ...c, archivedAt: res.archivedAt } : c));
      });
      notifySuccess(archive ? tx('Conversation archivée.', 'Conversation archived.') : tx('Conversation restaurée.', 'Conversation restored.'));
    } catch (err) {
      notifyError(err, tx('Action impossible.', 'Action failed.'));
    }
  };

  const togglePin = async (conv: ConversationPreview) => {
    try {
      const pin = !conv.pinnedAt;
      const res = await apiFetch<{ pinnedAt: string | null }>(`/conversations/${conv.id}/pin`, {
        method: 'POST',
        body: JSON.stringify({ pin }),
      });
      setItems((prev) => prev.map((c) => (c.id === conv.id ? { ...c, pinnedAt: res.pinnedAt } : c)));
      notifySuccess(pin ? tx('Conversation épinglée.', 'Conversation pinned.') : tx('Épinglage retiré.', 'Unpinned.'));
    } catch (err) {
      notifyError(err, tx("Impossible d'épingler.", 'Unable to pin.'));
    }
  };

  return (
    <div className="panel pad">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h1 className="h1">{tx('Messages', 'Messages')}</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className={`btn ${showArchived ? 'ghost' : 'primary'}`} onClick={() => setShowArchived(false)}>
            {tx('Actifs', 'Active')}
          </button>
          <button className={`btn ${showArchived ? 'primary' : 'ghost'}`} onClick={() => setShowArchived(true)}>
            {tx('Archivés', 'Archived')}
          </button>
          {loading ? <div className="small">{tx('Chargement...', 'Loading...')}</div> : null}
        </div>
      </div>
      {error ? <div className="small">{tx('Erreur', 'Error')}: {String(error?.error || error?.message || error)}</div> : null}
      {items.length === 0 ? (
        <div className="small">{tx('Aucune conversation.', 'No conversations yet.')}</div>
      ) : (
        <div className="grid cols-2" style={{ gap: 12 }}>
          {items.map((c) => {
            const other = c.members?.[0];
            const last = c.lastMessage;
            const preview = getMessagePreview(last, tx);
            const muted = isMutedUntil(c.mutedUntil);
            return (
              <Link key={c.id} to={`/dashboard/messages/thread/${c.id}`} className="panel pad" style={{ display: 'grid', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span>{other?.username || tx('Utilisateur', 'User')}</span>
                    {c.pinnedAt ? <span className="badge">{tx('Épinglé', 'Pinned')}</span> : null}
                    {muted ? <span className="badge neutral">{tx('Muet', 'Muted')}</span> : null}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      className="btn ghost"
                      style={{ padding: '6px 10px', fontSize: 12 }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        togglePin(c);
                      }}
                    >
                      {c.pinnedAt ? tx('Désépingler', 'Unpin') : tx('Épingler', 'Pin')}
                    </button>
                    <button
                      className="btn ghost"
                      style={{ padding: '6px 10px', fontSize: 12 }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleArchive(c);
                      }}
                    >
                      {showArchived ? tx('Restaurer', 'Restore') : tx('Archiver', 'Archive')}
                    </button>
                  </div>
                </div>
                {c.ad ? (
                  <div className="small" style={{ opacity: 0.8 }}>
                    {tx('Annonce', 'Listing')}: {c.ad.title || c.ad.id}
                  </div>
                ) : null}
                <div className="small" style={{ opacity: 0.9 }}>
                  {preview || tx('Pas encore de message.', 'No messages yet.')}
                </div>
                <div className="small" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>{c.lastMessageAt ? new Date(c.lastMessageAt).toLocaleString(locale) : '—'}</span>
                  {c.unreadCount ? <span className="badge warn">{c.unreadCount} {tx('non lus', 'unread')}</span> : <span>{tx('Tout est lu', 'All read')}</span>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function D_Thread() {
  const { tx, lang } = useI18n();
  const { id } = useParams();
  const [conversation, setConversation] = React.useState<ConversationPreview | null>(null);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [value, setValue] = React.useState('');
  const [typing, setTyping] = React.useState<{ userId?: string } | null>(null);
  const [meId, setMeId] = React.useState<string | null>(null);
  const [blocked, setBlocked] = React.useState(false);
  const [mutedUntil, setMutedUntil] = React.useState<string | null>(null);
  const [attachments, setAttachments] = React.useState<UploadItem[]>([]);
  const [uploading, setUploading] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [searching, setSearching] = React.useState(false);
  const socketRef = React.useRef<any>(null);
  const endRef = React.useRef<HTMLDivElement | null>(null);
  const typingRef = React.useRef(false);
  const typingTimeout = React.useRef<number | null>(null);
  const locale = lang === 'fr' ? 'fr-FR' : 'en-US';

  const other = conversation?.members?.[0];
  const muted = isMutedUntil(mutedUntil);

  const scrollToBottom = (behavior: ScrollBehavior = 'auto') => {
    if (endRef.current) endRef.current.scrollIntoView({ behavior, block: 'end' });
  };

  React.useEffect(() => {
    let mounted = true;
    if (!id) return undefined;
    setLoading(true);
    Promise.all([
      apiFetch<any>('/me'),
      apiFetch<{ items: ConversationPreview[] }>('/conversations'),
      apiFetch<{ items: ConversationPreview[] }>('/conversations?archived=1'),
      apiFetch<{ items: ChatMessage[] }>(`/conversations/${id}/messages?limit=50`),
      apiFetch<{ items: { blocked: { id: string } }[] }>('/chat/blocks'),
    ])
      .then(([me, activeConvs, archivedConvs, res, blocks]) => {
        if (!mounted) return;
        setMeId(me?.id || null);
        const allConvs = [...(activeConvs.items || []), ...(archivedConvs.items || [])];
        const conv = allConvs.find((c) => c.id === id) || null;
        setConversation(conv);
        setMutedUntil(conv?.mutedUntil || null);
        setMessages(res.items || []);
        const blockIds = (blocks.items || [])
          .map((b) => b.blocked?.id)
          .filter((value): value is string => Boolean(value));
        const isBlocked = conv?.members?.some((m) => blockIds.includes(m.id)) || false;
        setBlocked(isBlocked);
        const last = res.items?.[res.items.length - 1];
        if (last?.id) {
          apiFetch(`/conversations/${id}/read`, { method: 'POST', body: JSON.stringify({ messageId: last.id }) }).catch(() => {});
        }
        scrollToBottom();
      })
      .catch((err) => {
        if (!mounted) return;
        notifyError(err, tx('Impossible de charger les messages.', 'Unable to load messages.'));
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    const token = getToken();
    if (token) {
      const socket = io(API_BASE, { auth: { token } });
      socketRef.current = socket;
      socket.emit('conversation:join', { conversationId: id });
      socket.on('message:new', (msg: ChatMessage) => {
        if (msg?.conversationId !== id) return;
        setMessages((prev) => [...prev, msg]);
        apiFetch(`/conversations/${id}/read`, { method: 'POST', body: JSON.stringify({ messageId: msg.id }) }).catch(() => {});
        scrollToBottom('smooth');
      });
      socket.on('typing', (payload: any) => {
        if (payload?.conversationId !== id) return;
        setTyping(payload?.isTyping ? { userId: payload?.userId } : null);
      });
      socket.on('message:read', (payload: any) => {
        if (payload?.conversationId !== id) return;
        if (!payload?.messageId || !payload?.userId) return;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === payload.messageId
              ? {
                ...m,
                reads: (m.reads || []).some((r) => r.userId === payload.userId)
                  ? m.reads
                  : [...(m.reads || []), { userId: payload.userId, readAt: payload.readAt }],
              }
              : m
          )
        );
      });
      socket.on('message:reaction', (payload: any) => {
        if (!payload?.messageId || !payload?.emoji || !payload?.userId) return;
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== payload.messageId) return m;
            const current = m.reactions || [];
            if (payload.action === 'removed') {
              return {
                ...m,
                reactions: current.filter((r) => !(r.userId === payload.userId && r.emoji === payload.emoji)),
              };
            }
            return {
              ...m,
              reactions: [...current, { emoji: payload.emoji, userId: payload.userId }],
            };
          })
        );
      });
    }

    return () => {
      mounted = false;
      if (socketRef.current) socketRef.current.disconnect();
      socketRef.current = null;
      if (typingTimeout.current) window.clearTimeout(typingTimeout.current);
    };
  }, [id]);

  React.useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

  const uploadFile = async (file: File) => {
    const token = getToken();
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${API_BASE}/media/upload`, {
      method: 'POST',
      body: form,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!res.ok) {
      let err: any = { status: res.status };
      try { err = { ...err, ...(await res.json()) }; } catch {}
      throw err;
    }
    const data = await res.json();
    return {
      url: data.url,
      mime: data.mime,
      size: data.size,
      type: data.mime && data.mime.startsWith('image/') ? 'image' : 'file',
      name: data.originalName || file.name,
    } as UploadItem;
  };

  const handleAddFiles = async (files: FileList | null) => {
    if (!files || !files.length) return;
    const spaceLeft = MAX_ATTACHMENTS - attachments.length;
    if (spaceLeft <= 0) {
      notifyInfo(tx(`Maximum ${MAX_ATTACHMENTS} pièces jointes.`, `Maximum ${MAX_ATTACHMENTS} attachments.`));
      return;
    }
    const toUpload = Array.from(files).slice(0, spaceLeft);
    setUploading(true);
    try {
      const uploaded: UploadItem[] = [];
      for (const file of toUpload) {
        uploaded.push(await uploadFile(file));
      }
      setAttachments((prev) => [...prev, ...uploaded]);
    } catch (err) {
      notifyError(err, tx('Erreur upload.', 'Upload failed.'));
    } finally {
      setUploading(false);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, idx) => idx !== index));
  };

  const sendTyping = (active: boolean) => {
    const socket = socketRef.current;
    if (!socket || !id) return;
    socket.emit(active ? 'typing:start' : 'typing:stop', { conversationId: id });
  };

  const handleTyping = (next: string) => {
    setValue(next);
    const socket = socketRef.current;
    if (!socket || !id) return;
    if (next && !typingRef.current) {
      typingRef.current = true;
      sendTyping(true);
    }
    if (typingTimeout.current) window.clearTimeout(typingTimeout.current);
    typingTimeout.current = window.setTimeout(() => {
      typingRef.current = false;
      sendTyping(false);
    }, 1200);
  };

  const sendPayload = async (payload: { body?: string; attachments?: UploadItem[]; type?: string; meta?: any }) => {
    if (!id) return;
    if (blocked) {
      notifyError(tx('Utilisateur bloqué.', 'User is blocked.'));
      return;
    }
    const socket = socketRef.current;
    const outgoing = { conversationId: id, ...payload };
    if (socket && socket.connected) {
      socket.emit('message:send', outgoing, (ack: any) => {
        if (!ack?.ok) {
          notifyError(ack?.error || tx('Erreur envoi.', 'Send failed.'));
        }
      });
      return;
    }
    try {
      await apiFetch(`/conversations/${id}/messages`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch (err) {
      notifyError(err, tx("Impossible d'envoyer le message.", 'Unable to send message.'));
    }
  };

  const sendMessage = async () => {
    const body = value.trim();
    if (!id) return;
    if (!body && attachments.length === 0) return;
    setValue('');
    sendTyping(false);
    typingRef.current = false;
    if (typingTimeout.current) window.clearTimeout(typingTimeout.current);
    const isVoice = !body && attachments.length > 0 && attachments.every((att) => isAudioAttachment(att));
    const type = isVoice ? 'voice' : 'text';
    const payload = { body, attachments, type };
    setAttachments([]);
    await sendPayload(payload);
  };

  const reportMessage = async (messageId: string) => {
    const reason = window.prompt(tx('Raison du signalement (optionnel)', 'Reason for report (optional)')) || '';
    try {
      await apiFetch('/chat/report', { method: 'POST', body: JSON.stringify({ messageId, reason }) });
      notifySuccess(tx('Message signalé.', 'Message reported.'));
    } catch (err) {
      notifyError(err, tx('Signalement impossible.', 'Unable to report.'));
    }
  };

  const toggleBlock = async () => {
    if (!other?.id) return;
    if (blocked) {
      try {
        await apiFetch(`/chat/block/${other.id}`, { method: 'DELETE' });
        setBlocked(false);
        notifySuccess(tx('Utilisateur débloqué.', 'User unblocked.'));
      } catch (err) {
        notifyError(err, tx('Déblocage impossible.', 'Unable to unblock.'));
      }
      return;
    }
    const reason = window.prompt(tx('Raison du blocage (optionnel)', 'Reason for block (optional)')) || '';
    try {
      await apiFetch('/chat/block', { method: 'POST', body: JSON.stringify({ userId: other.id, reason }) });
      setBlocked(true);
      notifySuccess(tx('Utilisateur bloqué.', 'User blocked.'));
    } catch (err) {
      notifyError(err, tx('Blocage impossible.', 'Unable to block.'));
    }
  };

  const toggleMute = async () => {
    if (!id) return;
    try {
      if (muted) {
        const res = await apiFetch<{ mutedUntil: string | null }>(`/conversations/${id}/mute`, {
          method: 'POST',
          body: JSON.stringify({ mute: false }),
        });
        setMutedUntil(res.mutedUntil || null);
        notifySuccess(tx('Notifications réactivées.', 'Notifications re-enabled.'));
      } else {
        const res = await apiFetch<{ mutedUntil: string | null }>(`/conversations/${id}/mute`, {
          method: 'POST',
          body: JSON.stringify({ mute: true, durationMinutes: 7 * 24 * 60 }),
        });
        setMutedUntil(res.mutedUntil || null);
        notifySuccess(tx('Conversation mise en sourdine (7 jours).', 'Conversation muted (7 days).'));
      }
    } catch (err) {
      notifyError(err, tx('Impossible de mettre en sourdine.', 'Unable to mute.'));
    }
  };

  const toggleArchive = async () => {
    if (!id) return;
    try {
      const archive = !conversation?.archivedAt;
      const res = await apiFetch<{ archivedAt: string | null }>(`/conversations/${id}/archive`, {
        method: 'POST',
        body: JSON.stringify({ archive }),
      });
      setConversation((prev) => (prev ? { ...prev, archivedAt: res.archivedAt } : prev));
      notifySuccess(archive ? tx('Conversation archivée.', 'Conversation archived.') : tx('Conversation restaurée.', 'Conversation restored.'));
    } catch (err) {
      notifyError(err, tx("Impossible d'archiver.", 'Unable to archive.'));
    }
  };

  const togglePin = async () => {
    if (!id) return;
    try {
      const pin = !conversation?.pinnedAt;
      const res = await apiFetch<{ pinnedAt: string | null }>(`/conversations/${id}/pin`, {
        method: 'POST',
        body: JSON.stringify({ pin }),
      });
      setConversation((prev) => (prev ? { ...prev, pinnedAt: res.pinnedAt } : prev));
      notifySuccess(pin ? tx('Conversation épinglée.', 'Conversation pinned.') : tx('Épinglage retiré.', 'Unpinned.'));
    } catch (err) {
      notifyError(err, tx("Impossible d'épingler.", 'Unable to pin.'));
    }
  };

  const handleSearch = async (queryArg?: string) => {
    if (!id) return;
    const query = (typeof queryArg === 'string' ? queryArg : searchQuery).trim();
    setSearching(true);
    try {
      const q = query ? `&q=${encodeURIComponent(query)}` : '';
      const res = await apiFetch<{ items: ChatMessage[] }>(`/conversations/${id}/messages?limit=50${q}`);
      setMessages(res.items || []);
      if (!query) {
        const last = res.items?.[res.items.length - 1];
        if (last?.id) {
          apiFetch(`/conversations/${id}/read`, { method: 'POST', body: JSON.stringify({ messageId: last.id }) }).catch(() => {});
        }
      }
    } catch (err) {
      notifyError(err, tx('Recherche impossible.', 'Search failed.'));
    } finally {
      setSearching(false);
    }
  };

  const clearSearch = async () => {
    setSearchQuery('');
    await handleSearch('');
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    if (!meId) return;
    try {
      const res = await apiFetch<{ action: string; emoji: string; messageId: string }>(`/messages/${messageId}/reactions`, {
        method: 'POST',
        body: JSON.stringify({ emoji }),
      });
      if (!res?.action) return;
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== res.messageId) return m;
          const current = m.reactions || [];
          if (res.action === 'removed') {
            return {
              ...m,
              reactions: current.filter((r) => !(r.userId === meId && r.emoji === res.emoji)),
            };
          }
          return {
            ...m,
            reactions: [...current, { emoji: res.emoji, userId: meId }],
          };
        })
      );
    } catch (err) {
      notifyError(err, tx('Réaction impossible.', 'Unable to react.'));
    }
  };

  const sendSticker = async (emoji: string) => {
    if (!emoji) return;
    await sendPayload({ body: emoji, type: 'sticker' });
  };

  const sendCallInvite = async () => {
    if (!id) return;
    const roomId = `lodix-${id}-${Date.now()}`;
    const url = `https://meet.jit.si/${roomId}`;
    await sendPayload({
      body: tx('Appel audio', 'Audio call'),
      type: 'call',
      meta: { provider: 'jitsi', roomId, url },
    });
  };

  const warningLabels: Record<string, string> = {
    CONTAINS_LINKS: tx('Contient des liens', 'Contains links'),
    SENSITIVE_KEYWORDS: tx('Contenu sensible', 'Sensitive content'),
    SPAM_SUSPECT: tx('Message suspect', 'Suspected spam'),
  };

  return (
    <div className="panel pad" style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h1 className="h1" style={{ marginBottom: 4 }}>{tx('Conversation', 'Conversation')}</h1>
          <div className="small">{other?.username || tx('Utilisateur', 'User')}</div>
          {conversation?.ad ? (
            <div className="small">
              {tx('Annonce', 'Listing')}: <a href={`/ad/${conversation.ad.id}`}>{conversation.ad.title || conversation.ad.id}</a>
            </div>
          ) : null}
          {typing ? <div className="small">{tx("En train d'écrire...", 'Typing...')}</div> : null}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn ghost" onClick={sendCallInvite}>{tx('Appeler', 'Call')}</button>
          <button className="btn ghost" onClick={togglePin}>{conversation?.pinnedAt ? tx('Désépingler', 'Unpin') : tx('Épingler', 'Pin')}</button>
          <button className="btn ghost" onClick={toggleArchive}>{conversation?.archivedAt ? tx('Restaurer', 'Restore') : tx('Archiver', 'Archive')}</button>
          <button className="btn ghost" onClick={toggleMute}>{muted ? tx('Réactiver', 'Unmute') : tx('Sourdine 7j', 'Mute 7d')}</button>
          <button className="btn ghost" onClick={toggleBlock}>{blocked ? tx('Débloquer', 'Unblock') : tx('Bloquer', 'Block')}</button>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          className="input"
          style={{ minWidth: 220 }}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={tx('Rechercher dans la conversation', 'Search in conversation')}
        />
        <button className="btn ghost" onClick={() => handleSearch()} disabled={searching}>
          {searching ? tx('Recherche...', 'Searching...') : tx('Rechercher', 'Search')}
        </button>
        {searchQuery ? (
          <button className="btn ghost" onClick={clearSearch}>
            {tx('Effacer', 'Clear')}
          </button>
        ) : null}
      </div>

      <div style={{ display: 'grid', gap: 12, minHeight: 240 }}>
        {loading ? <div className="small">{tx('Chargement...', 'Loading...')}</div> : null}
        {messages.map((m) => {
          const mine = meId && m.senderId === meId;
          const readByOther = mine && m.reads?.some((r) => r.userId !== meId);
          const messageType = m.type || 'text';
          const bubbleStyle: React.CSSProperties = {
            maxWidth: '70%',
            padding: 14,
            borderRadius: 18,
            border: mine ? '1px solid rgba(0,0,0,.05)' : '1px solid rgba(0,0,0,.12)',
            background: mine ? 'linear-gradient(120deg, var(--accent), var(--accent2))' : 'rgba(255,255,255,.92)',
            color: mine ? '#fff' : 'var(--text)',
            boxShadow: '0 10px 20px rgba(15,23,42,.08)',
          };
          const attachmentsList = m.attachments || [];
          const reactionGroups = groupReactions(m.reactions || [], meId);
          const warningList = (m.warning || '')
            .split(',')
            .map((w) => w.trim())
            .filter(Boolean)
            .map((w) => warningLabels[w] || w);
          const callUrl = m.meta?.url || m.meta?.link;
          return (
            <div key={m.id} style={{ display: 'grid', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                <div style={bubbleStyle}>
                  <div className="small" style={{ color: mine ? 'rgba(255,255,255,.8)' : 'var(--muted)' }}>
                    {m.sender?.username || m.senderId}
                  </div>
                  {warningList.length ? (
                    <div className="small" style={{ marginTop: 6, color: mine ? 'rgba(255,255,255,.8)' : 'var(--muted)' }}>
                      {warningList.join(' · ')}
                    </div>
                  ) : null}
                  {messageType === 'sticker' ? (
                    <div style={{ marginTop: 8, fontSize: 32 }}>{m.body}</div>
                  ) : null}
                  {messageType !== 'sticker' && m.body ? (
                    <div style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>{m.body}</div>
                  ) : null}
                  {messageType === 'call' ? (
                    <div className="panel pad" style={{ marginTop: 10, background: 'rgba(255,255,255,.15)' }}>
                      <div style={{ fontWeight: 700 }}>{tx('Invitation à un appel audio', 'Audio call invite')}</div>
                      <div className="small" style={{ marginTop: 4 }}>{tx('Clique pour rejoindre.', 'Tap to join.')}</div>
                      {callUrl ? (
                        <a className="btn ghost" style={{ marginTop: 8 }} href={callUrl} target="_blank" rel="noreferrer">
                          {tx('Rejoindre', 'Join')}
                        </a>
                      ) : null}
                    </div>
                  ) : null}
                  {attachmentsList.length ? (
                    <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                      {attachmentsList.map((att, idx) => {
                        const url = resolveMediaUrl(att.url);
                        if (isAudioAttachment(att)) {
                          return (
                            <audio key={`${att.url}-${idx}`} controls style={{ width: '100%' }}>
                              <source src={url} />
                            </audio>
                          );
                        }
                        if (isImageAttachment(att)) {
                          return (
                            <img
                              key={`${att.url}-${idx}`}
                              src={url}
                              alt={att.type || tx('pièce jointe', 'attachment')}
                              style={{ width: '100%', borderRadius: 12, maxHeight: 240, objectFit: 'cover' }}
                            />
                          );
                        }
                        return (
                          <a key={`${att.url}-${idx}`} href={url} target="_blank" rel="noreferrer" className="small">
                            {att.url}
                          </a>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              </div>
              {reactionGroups.length ? (
                <div style={{ display: 'flex', gap: 6, justifyContent: mine ? 'flex-end' : 'flex-start', flexWrap: 'wrap' }}>
                  {reactionGroups.map((r) => (
                    <button
                      key={`${m.id}-${r.emoji}`}
                      className={`btn ${r.reacted ? 'primary' : 'ghost'}`}
                      style={{ padding: '4px 8px', fontSize: 12 }}
                      onClick={() => handleReaction(m.id, r.emoji)}
                    >
                      {r.emoji} {r.count}
                    </button>
                  ))}
                </div>
              ) : null}
              <div style={{ display: 'flex', gap: 6, justifyContent: mine ? 'flex-end' : 'flex-start', flexWrap: 'wrap' }}>
                {REACTION_OPTIONS.map((emoji) => (
                  <button
                    key={`${m.id}-${emoji}`}
                    className="btn ghost"
                    style={{ padding: '4px 8px', fontSize: 12 }}
                    onClick={() => handleReaction(m.id, emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                <div className="small" style={{ opacity: 0.7 }}>{new Date(m.createdAt).toLocaleString(locale)}</div>
                {mine ? <div className="small">{readByOther ? tx('Lu', 'Read') : tx('Envoyé', 'Sent')}</div> : null}
                {!mine ? (
                  <button
                    className="btn ghost"
                    style={{ padding: '6px 10px', fontSize: 12 }}
                    onClick={() => reportMessage(m.id)}
                  >
                    {tx('Signaler', 'Report')}
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
        {attachments.length ? (
          <div className="panel pad" style={{ display: 'grid', gap: 10 }}>
            <div className="small">{tx('Pièces jointes', 'Attachments')} ({attachments.length}/{MAX_ATTACHMENTS})</div>
            <div className="grid cols-4" style={{ gap: 10 }}>
              {attachments.map((att, idx) => {
                const url = resolveMediaUrl(att.url);
                return (
                  <div key={`${att.url}-${idx}`} style={{ position: 'relative' }}>
                    {isImageAttachment(att) ? (
                      <img src={url} alt={att.name || tx('upload', 'upload')} style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 12 }} />
                    ) : (
                      <div className="panel pad" style={{ height: 120, display: 'grid', placeItems: 'center' }}>
                        <div className="small">{att.name || tx('Fichier', 'File')}</div>
                      </div>
                    )}
                    <button
                      className="btn ghost"
                      style={{ position: 'absolute', top: 6, right: 6, padding: '6px 10px', fontSize: 12 }}
                      onClick={() => removeAttachment(idx)}
                    >
                      {tx('Retirer', 'Remove')}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <label className="btn ghost">
            {tx('Ajouter un fichier', 'Add a file')}
            <input
              type="file"
              multiple
              style={{ display: 'none' }}
              onChange={(e) => handleAddFiles(e.target.files)}
            />
          </label>
          {uploading ? <div className="small">{tx('Téléchargement...', 'Uploading...')}</div> : null}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="small">{tx('Stickers', 'Stickers')}</div>
          {STICKER_OPTIONS.map((emoji) => (
            <button
              key={`sticker-${emoji}`}
              className="btn ghost"
              style={{ padding: '4px 8px', fontSize: 16 }}
              onClick={() => sendSticker(emoji)}
            >
              {emoji}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="input"
            value={value}
            onChange={(e) => handleTyping(e.target.value)}
            placeholder={blocked ? tx('Utilisateur bloqué.', 'User blocked.') : tx('Écrire un message...', 'Write a message...')}
            disabled={blocked || uploading}
          />
          <button className="btn primary" onClick={sendMessage} disabled={blocked || uploading}>{tx('Envoyer', 'Send')}</button>
        </div>
      </div>
    </div>
  );
}
