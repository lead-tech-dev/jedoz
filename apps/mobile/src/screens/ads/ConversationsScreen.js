import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { io } from 'socket.io-client';
import { Screen } from '../../components/Screen';
import { ListRow } from '../../components/ListRow';
import { colors } from '../../lib/theme';
import { apiFetch, API_BASE } from '../../lib/api';
import { getItem, STORAGE_KEYS } from '../../lib/storage';
import { useAuth } from '../../context/AuthContext';
import { notifyError } from '../../lib/toast';
import { useI18n } from '../../lib/i18n';

function isMutedUntil(mutedUntil) {
  if (!mutedUntil) return false;
  return new Date(mutedUntil).getTime() > Date.now();
}

function getConversationPreviewText(message, tx) {
  if (!message) return '';
  const type = message.type || 'text';
  if (type === 'sticker') return message.body || tx('Sticker', 'Sticker');
  if (type === 'call') return tx('Appel audio', 'Audio call');
  if (type === 'voice') return tx('Message vocal', 'Voice message');
  if (message.attachments?.length) return tx('Pièce jointe', 'Attachment');
  return message.body || '';
}

export function ConversationsScreen({ navigation }) {
  const { tx, lang } = useI18n();
  const { user } = useAuth();
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [showArchived, setShowArchived] = React.useState(false);
  const socketRef = React.useRef(null);
  const joinedRef = React.useRef(new Set());
  const locale = lang === 'fr' ? 'fr-FR' : 'en-US';

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const query = showArchived ? '?archived=1' : '';
      const res = await apiFetch(`/conversations${query}`);
      setItems(res.items || []);
    } catch (e) {
      notifyError(e, tx('Impossible de charger les conversations.', 'Unable to load conversations.'));
    } finally {
      setLoading(false);
    }
  }, [showArchived]);

  React.useEffect(() => {
    load();
    const unsub = navigation.addListener('focus', () => load());
    return unsub;
  }, [load, navigation]);

  React.useEffect(() => {
    let active = true;
    const boot = async () => {
      const token = await getItem(STORAGE_KEYS.token);
      if (!token || !active) return;
      const socket = io(API_BASE, { transports: ['websocket'], auth: { token } });
      socketRef.current = socket;
      socket.on('message:new', (msg) => {
        setItems((prev) => {
          const exists = prev.find((c) => c.id === msg.conversationId);
          if (!exists) return prev;
          return prev.map((c) => {
            if (c.id !== msg.conversationId) return c;
            const inc = msg.senderId && user?.id && msg.senderId !== user.id ? 1 : 0;
            return {
              ...c,
              lastMessage: msg,
              lastMessageAt: msg.createdAt,
              unreadCount: (c.unreadCount || 0) + inc
            };
          });
        });
      });
    };
    boot();
    return () => {
      active = false;
      if (socketRef.current) socketRef.current.disconnect();
      socketRef.current = null;
      joinedRef.current = new Set();
    };
  }, [user?.id]);

  React.useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;
    items.forEach((c) => {
      if (joinedRef.current.has(c.id)) return;
      socket.emit('conversation:join', { conversationId: c.id });
      joinedRef.current.add(c.id);
    });
  }, [items]);

  const toggleArchive = async (conv) => {
    try {
      const archive = !conv.archivedAt;
      const res = await apiFetch(`/conversations/${conv.id}/archive`, {
        method: 'POST',
        body: JSON.stringify({ archive })
      });
      setItems((prev) => {
        if ((archive && !showArchived) || (!archive && showArchived)) {
          return prev.filter((c) => c.id !== conv.id);
        }
        return prev.map((c) => (c.id === conv.id ? { ...c, archivedAt: res.archivedAt } : c));
      });
    } catch (e) {
      notifyError(e, tx('Action impossible.', 'Action failed.'));
    }
  };

  const togglePin = async (conv) => {
    try {
      const pin = !conv.pinnedAt;
      const res = await apiFetch(`/conversations/${conv.id}/pin`, {
        method: 'POST',
        body: JSON.stringify({ pin })
      });
      setItems((prev) => prev.map((c) => (c.id === conv.id ? { ...c, pinnedAt: res.pinnedAt } : c)));
    } catch (e) {
      notifyError(e, tx("Impossible d'épingler.", 'Unable to pin.'));
    }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>{tx('Messages', 'Messages')}</Text>
        <View style={styles.headerActions}>
          <Pressable style={[styles.filterBtn, !showArchived ? styles.filterBtnActive : null]} onPress={() => setShowArchived(false)}>
            <Text style={styles.filterText}>{tx('Actifs', 'Active')}</Text>
          </Pressable>
          <Pressable style={[styles.filterBtn, showArchived ? styles.filterBtnActive : null]} onPress={() => setShowArchived(true)}>
            <Text style={styles.filterText}>{tx('Archivés', 'Archived')}</Text>
          </Pressable>
          {loading ? <Text style={styles.subtle}>{tx('Chargement...', 'Loading...')}</Text> : null}
        </View>
      </View>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: 12, paddingBottom: 20 }}
        ListEmptyComponent={!loading ? <Text style={styles.subtle}>{tx('Aucune conversation.', 'No conversations yet.')}</Text> : null}
        renderItem={({ item }) => {
          const other = item.members?.[0];
          const preview = getConversationPreviewText(item.lastMessage, tx) || tx('Pas encore de message.', 'No messages yet.');
          const muted = isMutedUntil(item.mutedUntil);
          return (
            <ListRow
              title={other?.username || tx('Utilisateur', 'User')}
              subtitle={item.ad?.title ? `${item.ad.title} · ${preview}` : preview}
              right={(
                <View style={styles.rightCol}>
                  <Text style={styles.time}>{item.lastMessageAt ? new Date(item.lastMessageAt).toLocaleTimeString(locale) : '—'}</Text>
                  {item.pinnedAt ? <Text style={styles.pinned}>{tx('Épinglé', 'Pinned')}</Text> : null}
                  {item.unreadCount ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{item.unreadCount}</Text>
                    </View>
                  ) : null}
                  {muted ? <Text style={styles.muted}>{tx('Muet', 'Muted')}</Text> : null}
                  <View style={styles.rowActions}>
                    <Pressable
                      style={styles.actionBtn}
                      onPress={(e) => {
                        e.stopPropagation && e.stopPropagation();
                        togglePin(item);
                      }}
                    >
                      <Text style={styles.actionText}>{item.pinnedAt ? tx('Désépingler', 'Unpin') : tx('Épingler', 'Pin')}</Text>
                    </Pressable>
                    <Pressable
                      style={styles.actionBtn}
                      onPress={(e) => {
                        e.stopPropagation && e.stopPropagation();
                        toggleArchive(item);
                      }}
                    >
                      <Text style={styles.actionText}>{showArchived ? tx('Restaurer', 'Restore') : tx('Archiver', 'Archive')}</Text>
                    </Pressable>
                  </View>
                </View>
              )}
              onPress={() => navigation.navigate('Chat', { conversationId: item.id })}
            />
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginTop: 6,
    marginBottom: 12,
    gap: 6
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    flexWrap: 'wrap'
  },
  filterBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel
  },
  filterBtnActive: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(51,199,196,0.15)'
  },
  filterText: {
    color: colors.text,
    fontSize: 12
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700'
  },
  subtle: {
    color: colors.muted
  },
  rightCol: {
    alignItems: 'flex-end',
    gap: 6
  },
  pinned: {
    color: colors.accent,
    fontSize: 10,
    textTransform: 'uppercase'
  },
  time: {
    color: colors.muted,
    fontSize: 11
  },
  badge: {
    minWidth: 24,
    paddingHorizontal: 6,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center'
  },
  badgeText: {
    color: '#041314',
    fontWeight: '700',
    fontSize: 12
  },
  muted: {
    color: colors.muted,
    fontSize: 10,
    textTransform: 'uppercase'
  },
  rowActions: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap'
  },
  actionBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel
  },
  actionText: {
    color: colors.text,
    fontSize: 10
  }
});
