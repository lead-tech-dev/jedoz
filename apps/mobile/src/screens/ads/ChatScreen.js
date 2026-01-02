import React from 'react';
import { View, Text, StyleSheet, FlatList, Image, Pressable, Linking } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import { io } from 'socket.io-client';
import { Screen } from '../../components/Screen';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { colors, radius } from '../../lib/theme';
import { apiFetch, API_BASE } from '../../lib/api';
import { getItem, STORAGE_KEYS } from '../../lib/storage';
import { useAuth } from '../../context/AuthContext';
import { notifyError, notifyInfo, notifySuccess } from '../../lib/toast';
import { useI18n } from '../../lib/i18n';
import { useAudioPlayer } from '../../context/AudioPlayerContext';

const MAX_ATTACHMENTS = 4;
const STICKER_OPTIONS = ['💋', '🔥', '😍', '😊', '😈', '💖', '🎉'];
const REACTION_OPTIONS = ['❤️', '👍', '😂', '😮', '😢', '🔥'];

function resolveMediaUrl(url) {
  if (!url) return url;
  return url.startsWith('http') ? url : `${API_BASE}${url}`;
}

function isImageAttachment(att) {
  if (!att) return false;
  if (att.type && String(att.type).toLowerCase() === 'image') return true;
  if (att.mime && String(att.mime).startsWith('image/')) return true;
  return /\.(png|jpe?g|webp|gif)$/i.test(att.url || '');
}

function isAudioAttachment(att) {
  if (!att) return false;
  if (att.type && String(att.type).toLowerCase() === 'audio') return true;
  if (att.mime && String(att.mime).startsWith('audio/')) return true;
  return /\.(mp3|wav|m4a|aac|ogg)$/i.test(att.url || '');
}

function groupReactions(reactions, meId) {
  const buckets = new Map();
  (reactions || []).forEach((r) => {
    const existing = buckets.get(r.emoji) || { emoji: r.emoji, count: 0, reacted: false };
    existing.count += 1;
    if (meId && r.userId === meId) existing.reacted = true;
    buckets.set(r.emoji, existing);
  });
  return Array.from(buckets.values());
}

function isMutedUntil(mutedUntil) {
  if (!mutedUntil) return false;
  return new Date(mutedUntil).getTime() > Date.now();
}

function buildFileName(uri) {
  const parts = String(uri || '').split('/');
  return parts[parts.length - 1] || `upload_${Date.now()}.jpg`;
}

export function ChatScreen({ route }) {
  const { tx, lang } = useI18n();
  const { user } = useAuth();
  const { userId, adId, conversationId: initialConversationId } = route.params || {};
  const [conversationId, setConversationId] = React.useState(initialConversationId || null);
  const [conversation, setConversation] = React.useState(null);
  const [messages, setMessages] = React.useState([]);
  const [value, setValue] = React.useState('');
  const [typing, setTyping] = React.useState(false);
  const [blocked, setBlocked] = React.useState(false);
  const [mutedUntil, setMutedUntil] = React.useState(null);
  const [attachments, setAttachments] = React.useState([]);
  const [uploading, setUploading] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [searching, setSearching] = React.useState(false);
  const [recording, setRecording] = React.useState(null);
  const [recordingActive, setRecordingActive] = React.useState(false);
  const socketRef = React.useRef(null);
  const audioPlayer = useAudioPlayer();
  const typingRef = React.useRef(false);
  const typingTimeout = React.useRef(null);
  const locale = lang === 'fr' ? 'fr-FR' : 'en-US';

  const other = conversation?.members?.[0];
  const muted = isMutedUntil(mutedUntil);

  const bootstrapConversation = React.useCallback(async () => {
    if (conversationId) return conversationId;
    if (!adId) {
      notifyError(tx('Une annonce est requise pour démarrer la conversation.', 'A listing is required to start the conversation.'));
      return null;
    }
    const res = await apiFetch('/conversations/start', {
      method: 'POST',
      body: JSON.stringify({ adId })
    });
    const conv = res.conversation || res;
    setConversationId(conv.id);
    return conv.id;
  }, [conversationId, adId]);

  const loadConversationMeta = React.useCallback(async (convId) => {
    const [convs, archivedConvs, blocks] = await Promise.all([
      apiFetch('/conversations'),
      apiFetch('/conversations?archived=1'),
      apiFetch('/chat/blocks')
    ]);
    const allConvs = [...(convs.items || []), ...(archivedConvs.items || [])];
    const conv = allConvs.find((c) => c.id === convId) || null;
    setConversation(conv);
    setMutedUntil(conv?.mutedUntil || null);
    const blockIds = (blocks.items || []).map((b) => b.blocked?.id).filter(Boolean);
    const isBlocked = conv?.members?.some((m) => blockIds.includes(m.id)) || false;
    setBlocked(isBlocked);
  }, []);

  const loadMessages = React.useCallback(async (convId) => {
    if (!convId) return;
    const res = await apiFetch(`/conversations/${convId}/messages?limit=40`);
    setMessages(res.items || []);
    const last = res.items?.[res.items.length - 1];
    if (last?.id) {
      await apiFetch(`/conversations/${convId}/read`, {
        method: 'POST',
        body: JSON.stringify({ messageId: last.id })
      });
    }
  }, []);

  React.useEffect(() => {
    let isMounted = true;
    const boot = async () => {
      const convId = await bootstrapConversation();
      if (!convId || !isMounted) return;
      await Promise.all([loadMessages(convId), loadConversationMeta(convId)]);
      const token = await getItem(STORAGE_KEYS.token);
      if (token) {
        const socket = io(API_BASE, {
          transports: ['websocket'],
          auth: { token }
        });
        socketRef.current = socket;
        socket.emit('conversation:join', { conversationId: convId });
        socket.on('message:new', (payload) => {
          if (payload?.conversationId !== convId) return;
          setMessages((prev) => [...prev, payload]);
          if (payload.senderId && payload.senderId !== user?.id) {
            apiFetch(`/conversations/${convId}/read`, {
              method: 'POST',
              body: JSON.stringify({ messageId: payload.id })
            }).catch(() => {});
          }
        });
        socket.on('typing', (payload) => {
          if (payload?.conversationId !== convId || payload.userId === user?.id) return;
          setTyping(Boolean(payload.isTyping));
        });
        socket.on('message:read', (payload) => {
          if (payload?.conversationId !== convId) return;
          if (!payload?.messageId || !payload?.userId) return;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === payload.messageId
                ? {
                  ...m,
                  reads: (m.reads || []).some((r) => r.userId === payload.userId)
                    ? m.reads
                    : [...(m.reads || []), { userId: payload.userId, readAt: payload.readAt }]
                }
                : m
            )
          );
        });
        socket.on('message:reaction', (payload) => {
          if (!payload?.messageId || !payload?.emoji || !payload?.userId) return;
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id !== payload.messageId) return m;
              const current = m.reactions || [];
              if (payload.action === 'removed') {
                return {
                  ...m,
                  reactions: current.filter((r) => !(r.userId === payload.userId && r.emoji === payload.emoji))
                };
              }
              return {
                ...m,
                reactions: [...current, { emoji: payload.emoji, userId: payload.userId }]
              };
            })
          );
        });
      }
    };
    boot();
    return () => {
      isMounted = false;
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [bootstrapConversation, loadMessages, loadConversationMeta, user?.id]);

  const uploadFile = async (item) => {
    const form = new FormData();
    form.append('file', {
      uri: item.uri,
      name: item.fileName || buildFileName(item.uri),
      type: item.mimeType || 'image/jpeg'
    });
    const res = await apiFetch('/media/upload', { method: 'POST', body: form });
    return {
      url: res.url,
      mime: res.mime,
      size: res.size,
      type: res.mime && String(res.mime).startsWith('image/')
        ? 'image'
        : res.mime && String(res.mime).startsWith('audio/')
          ? 'audio'
          : 'file'
    };
  };

  const pickAttachments = async () => {
    const spaceLeft = MAX_ATTACHMENTS - attachments.length;
    if (spaceLeft <= 0) {
      notifyInfo(tx(`Maximum ${MAX_ATTACHMENTS} pièces jointes.`, `Maximum ${MAX_ATTACHMENTS} attachments.`));
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: true,
      quality: 0.8
    });
    if (res.canceled) return;
    const assets = res.assets || [];
    const next = assets.slice(0, spaceLeft).map((asset) => ({
      uri: asset.uri,
      mimeType: asset.mimeType || 'image/jpeg',
      fileName: asset.fileName || buildFileName(asset.uri),
      size: asset.fileSize || asset.size || 0,
      type: asset.type || 'image'
    }));
    setUploading(true);
    try {
      const uploaded = [];
      for (const item of next) {
        uploaded.push(await uploadFile(item));
      }
      setAttachments((prev) => [...prev, ...uploaded]);
    } catch (e) {
      notifyError(e, tx('Erreur upload.', 'Upload failed.'));
    } finally {
      setUploading(false);
    }
  };

  const removeAttachment = (index) => {
    setAttachments((prev) => prev.filter((_, idx) => idx !== index));
  };

  const startRecording = async () => {
    if (recordingActive) return;
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        notifyError(tx('Microphone refusé.', 'Microphone permission denied.'));
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await rec.startAsync();
      setRecording(rec);
      setRecordingActive(true);
      notifyInfo(tx('Enregistrement...', 'Recording...'));
    } catch (e) {
      notifyError(e, tx('Enregistrement impossible.', 'Unable to record.'));
    }
  };

  const stopRecording = async () => {
    if (!recording) return;
    try {
      setRecordingActive(false);
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      if (!uri) {
        notifyError(tx('Audio introuvable.', 'Audio not found.'));
        return;
      }
      setUploading(true);
      const uploaded = await uploadFile({
        uri,
        mimeType: 'audio/m4a',
        fileName: `voice_${Date.now()}.m4a`,
        type: 'audio'
      });
      setUploading(false);
      await sendPayload({ body: '', attachments: [uploaded], type: 'voice' });
    } catch (e) {
      setRecording(null);
      setRecordingActive(false);
      setUploading(false);
      notifyError(e, tx('Erreur audio.', 'Audio failed.'));
    }
  };

  const formatTime = (ms) => {
    if (!ms || Number.isNaN(ms)) return '0:00';
    const total = Math.floor(ms / 1000);
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  };

  const sendTyping = (active) => {
    const socket = socketRef.current;
    if (!socket || !conversationId) return;
    socket.emit(active ? 'typing:start' : 'typing:stop', { conversationId });
  };

  const onTyping = (next) => {
    setValue(next);
    if (!conversationId) return;
    if (next && !typingRef.current) {
      typingRef.current = true;
      sendTyping(true);
    }
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      typingRef.current = false;
      sendTyping(false);
    }, 1200);
  };

  const sendPayload = async (payload) => {
    if (!conversationId) return;
    if (blocked) {
      notifyError(tx('Utilisateur bloqué.', 'User blocked.'));
      return;
    }
    const socket = socketRef.current;
    const outgoing = { conversationId, ...payload };
    if (socket && socket.connected) {
      socket.emit('message:send', outgoing);
      return;
    }
    const res = await apiFetch(`/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (res?.message) setMessages((prev) => [...prev, res.message]);
  };

  const sendMessage = async () => {
    if ((!value.trim() && attachments.length === 0) || !conversationId) return;
    const body = value.trim();
    setValue('');
    sendTyping(false);
    typingRef.current = false;
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    const isVoice = !body && attachments.length > 0 && attachments.every((att) => isAudioAttachment(att));
    const type = isVoice ? 'voice' : 'text';
    const payload = { body, attachments, type };
    setAttachments([]);
    await sendPayload(payload);
  };

  const sendSticker = async (emoji) => {
    if (!emoji) return;
    await sendPayload({ body: emoji, type: 'sticker' });
  };

  const sendCallInvite = async () => {
    if (!conversationId) return;
    const roomId = `lodix-${conversationId}-${Date.now()}`;
    const url = `https://meet.jit.si/${roomId}`;
    await sendPayload({ body: tx('Appel audio', 'Audio call'), type: 'call', meta: { provider: 'jitsi', roomId, url } });
  };

  const handleReaction = async (messageId, emoji) => {
    if (!user?.id) return;
    try {
      const res = await apiFetch(`/messages/${messageId}/reactions`, {
        method: 'POST',
        body: JSON.stringify({ emoji })
      });
      if (!res?.action) return;
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== res.messageId) return m;
          const current = m.reactions || [];
          if (res.action === 'removed') {
            return { ...m, reactions: current.filter((r) => !(r.userId === user.id && r.emoji === res.emoji)) };
          }
          return { ...m, reactions: [...current, { emoji: res.emoji, userId: user.id }] };
        })
      );
    } catch (e) {
      notifyError(e, tx('Réaction impossible.', 'Unable to react.'));
    }
  };

  const reportMessage = async (messageId) => {
    try {
      await apiFetch('/chat/report', {
        method: 'POST',
        body: JSON.stringify({ messageId })
      });
      notifySuccess(tx('Message signalé.', 'Message reported.'));
    } catch (e) {
      notifyError(e, tx('Signalement impossible.', 'Unable to report.'));
    }
  };

  const toggleBlock = async () => {
    if (!other?.id) return;
    try {
      if (blocked) {
        await apiFetch(`/chat/block/${other.id}`, { method: 'DELETE' });
        setBlocked(false);
        notifySuccess(tx('Utilisateur débloqué.', 'User unblocked.'));
      } else {
        await apiFetch('/chat/block', {
          method: 'POST',
          body: JSON.stringify({ userId: other.id })
        });
        setBlocked(true);
        notifySuccess(tx('Utilisateur bloqué.', 'User blocked.'));
      }
    } catch (e) {
      notifyError(e, tx('Action impossible.', 'Action failed.'));
    }
  };

  const toggleMute = async () => {
    if (!conversationId) return;
    try {
      if (muted) {
        const res = await apiFetch(`/conversations/${conversationId}/mute`, {
          method: 'POST',
          body: JSON.stringify({ mute: false })
        });
        setMutedUntil(res.mutedUntil || null);
        notifySuccess(tx('Notifications réactivées.', 'Notifications re-enabled.'));
      } else {
        const res = await apiFetch(`/conversations/${conversationId}/mute`, {
          method: 'POST',
          body: JSON.stringify({ mute: true, durationMinutes: 7 * 24 * 60 })
        });
        setMutedUntil(res.mutedUntil || null);
        notifySuccess(tx('Conversation mise en sourdine.', 'Conversation muted.'));
      }
    } catch (e) {
      notifyError(e, tx('Impossible de mettre en sourdine.', 'Unable to mute.'));
    }
  };

  const toggleArchive = async () => {
    if (!conversationId) return;
    try {
      const archive = !conversation?.archivedAt;
      const res = await apiFetch(`/conversations/${conversationId}/archive`, {
        method: 'POST',
        body: JSON.stringify({ archive })
      });
      setConversation((prev) => (prev ? { ...prev, archivedAt: res.archivedAt } : prev));
      notifySuccess(archive ? tx('Conversation archivée.', 'Conversation archived.') : tx('Conversation restaurée.', 'Conversation restored.'));
    } catch (e) {
      notifyError(e, tx("Impossible d'archiver.", 'Unable to archive.'));
    }
  };

  const togglePin = async () => {
    if (!conversationId) return;
    try {
      const pin = !conversation?.pinnedAt;
      const res = await apiFetch(`/conversations/${conversationId}/pin`, {
        method: 'POST',
        body: JSON.stringify({ pin })
      });
      setConversation((prev) => (prev ? { ...prev, pinnedAt: res.pinnedAt } : prev));
      notifySuccess(pin ? tx('Conversation épinglée.', 'Conversation pinned.') : tx('Épinglage retiré.', 'Unpinned.'));
    } catch (e) {
      notifyError(e, tx("Impossible d'épingler.", 'Unable to pin.'));
    }
  };

  const handleSearch = async (queryArg) => {
    if (!conversationId) return;
    const query = (typeof queryArg === 'string' ? queryArg : searchQuery).trim();
    setSearching(true);
    try {
      const q = query ? `&q=${encodeURIComponent(query)}` : '';
      const res = await apiFetch(`/conversations/${conversationId}/messages?limit=40${q}`);
      setMessages(res.items || []);
      if (!query) {
        const last = res.items?.[res.items.length - 1];
        if (last?.id) {
          await apiFetch(`/conversations/${conversationId}/read`, {
            method: 'POST',
            body: JSON.stringify({ messageId: last.id })
          });
        }
      }
    } catch (e) {
      notifyError(e, tx('Recherche impossible.', 'Search failed.'));
    } finally {
      setSearching(false);
    }
  };

  const clearSearch = async () => {
    setSearchQuery('');
    await handleSearch('');
  };

  const warningMap = {
    CONTAINS_LINKS: tx('Contient des liens', 'Contains links'),
    SENSITIVE_KEYWORDS: tx('Contenu sensible', 'Sensitive content'),
    SPAM_SUSPECT: tx('Message suspect', 'Suspected spam')
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>{other?.username || tx('Chat', 'Chat')}</Text>
        {typing ? <Text style={styles.typing}>{tx("En train d'écrire...", 'Typing...')}</Text> : null}
        {conversation?.ad?.title ? <Text style={styles.subtle}>{conversation.ad.title}</Text> : null}
        <View style={styles.actions}>
          <Button title={tx('Appeler', 'Call')} variant="ghost" onPress={sendCallInvite} />
          <Button title={conversation?.pinnedAt ? tx('Désépingler', 'Unpin') : tx('Épingler', 'Pin')} variant="ghost" onPress={togglePin} />
          <Button title={conversation?.archivedAt ? tx('Restaurer', 'Restore') : tx('Archiver', 'Archive')} variant="ghost" onPress={toggleArchive} />
          <Button title={muted ? tx('Réactiver', 'Unmute') : tx('Sourdine', 'Mute')} variant="ghost" onPress={toggleMute} />
          <Button title={blocked ? tx('Débloquer', 'Unblock') : tx('Bloquer', 'Block')} variant="ghost" onPress={toggleBlock} />
        </View>
      </View>
      <View style={styles.searchRow}>
        <Input
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={tx('Rechercher dans la conversation', 'Search in conversation')}
          style={{ flex: 1 }}
        />
        <Button title={searching ? tx('...', '...') : tx('Rechercher', 'Search')} variant="ghost" onPress={() => handleSearch()} disabled={searching} />
        {searchQuery ? <Button title={tx('Effacer', 'Clear')} variant="ghost" onPress={clearSearch} /> : null}
      </View>
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: 10, paddingBottom: 12 }}
        renderItem={({ item }) => {
          const mine = item.senderId === user?.id;
          const readByOther = mine && item.reads?.some((r) => r.userId !== user?.id);
          const messageType = item.type || 'text';
          const warningList = String(item.warning || '')
            .split(',')
            .map((w) => w.trim())
            .filter(Boolean)
            .map((w) => warningMap[w] || w);
          const reactionGroups = groupReactions(item.reactions || [], user?.id);
          const callUrl = item.meta?.url || item.meta?.link;
          return (
            <View style={[styles.messageRow, mine ? styles.rowMine : styles.rowOther]}>
              <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
                {!mine ? <Text style={styles.sender}>{item.sender?.username || tx('Utilisateur', 'User')}</Text> : null}
                {warningList.length ? (
                  <Text style={styles.warning}>{warningList.join(' · ')}</Text>
                ) : null}
                {messageType === 'sticker' ? (
                  <Text style={styles.sticker}>{item.body}</Text>
                ) : null}
                {messageType !== 'sticker' && item.body ? <Text style={styles.body}>{item.body}</Text> : null}
                {messageType === 'call' ? (
                  <View style={styles.callCard}>
                    <Text style={styles.callTitle}>{tx('Invitation à un appel audio', 'Audio call invite')}</Text>
                    <Pressable onPress={() => callUrl && Linking.openURL(callUrl)}>
                      <Text style={styles.callLink}>{tx('Rejoindre', 'Join')}</Text>
                    </Pressable>
                  </View>
                ) : null}
                {item.attachments?.length ? (
                  <View style={styles.attachments}>
                    {item.attachments.map((att, idx) => {
                      const url = resolveMediaUrl(att.url);
                      if (isAudioAttachment(att)) {
                        const isActive = audioPlayer.url === url;
                        const statusLabel = isActive
                          ? `${formatTime(audioPlayer.position)} / ${formatTime(audioPlayer.duration)}`
                          : tx('Audio', 'Audio');
                        return (
                          <View key={`${att.url}-${idx}`} style={styles.audioRow}>
                            <Pressable
                              style={styles.audioButton}
                              onPress={() => audioPlayer.toggle(url, { title: tx('Message vocal', 'Voice message') })}
                            >
                              <Text style={styles.audioButtonText}>
                                {isActive && audioPlayer.playing ? tx('Pause', 'Pause') : tx('Lire', 'Play')}
                              </Text>
                            </Pressable>
                            <Text style={styles.audioMeta}>
                              {statusLabel}
                            </Text>
                          </View>
                        );
                      }
                      return isImageAttachment(att) ? (
                        <Image key={`${att.url}-${idx}`} source={{ uri: url }} style={styles.attachmentImage} />
                      ) : (
                        <Text key={`${att.url}-${idx}`} style={styles.attachmentText}>{att.url}</Text>
                      );
                    })}
                  </View>
                ) : null}
                {reactionGroups.length ? (
                  <View style={styles.reactionRow}>
                    {reactionGroups.map((r) => (
                      <Pressable key={`${item.id}-${r.emoji}`} onPress={() => handleReaction(item.id, r.emoji)} style={[styles.reactionChip, r.reacted ? styles.reactionChipActive : null]}>
                        <Text style={styles.reactionText}>{r.emoji} {r.count}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
                <View style={styles.reactionRow}>
                  {REACTION_OPTIONS.map((emoji) => (
                    <Pressable key={`${item.id}-${emoji}`} onPress={() => handleReaction(item.id, emoji)} style={styles.reactionChip}>
                      <Text style={styles.reactionText}>{emoji}</Text>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.time}>{new Date(item.createdAt).toLocaleTimeString(locale)}</Text>
                  {mine ? <Text style={styles.time}>{readByOther ? tx('Lu', 'Read') : tx('Envoyé', 'Sent')}</Text> : null}
                  {!mine ? (
                    <Pressable onPress={() => reportMessage(item.id)}>
                      <Text style={styles.report}>{tx('Signaler', 'Report')}</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            </View>
          );
        }}
      />
      {attachments.length ? (
        <View style={styles.attachmentsPreview}>
          {attachments.map((att, idx) => (
            <Pressable key={`${att.url}-${idx}`} onPress={() => removeAttachment(idx)} style={styles.previewItem}>
              {isImageAttachment(att) ? (
                <Image source={{ uri: resolveMediaUrl(att.url) }} style={styles.previewImage} />
              ) : (
                <Text style={styles.previewText}>{att.type === 'audio' ? tx('Audio', 'Audio') : tx('Fichier', 'File')}</Text>
              )}
              <Text style={styles.previewRemove}>{tx('Retirer', 'Remove')}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <View style={styles.stickerRow}>
        <Text style={styles.stickerLabel}>{tx('Stickers', 'Stickers')}</Text>
        {STICKER_OPTIONS.map((emoji) => (
          <Pressable key={`sticker-${emoji}`} style={styles.stickerButton} onPress={() => sendSticker(emoji)}>
            <Text style={styles.stickerText}>{emoji}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.composerRow}>
        <Button title="+" variant="secondary" onPress={pickAttachments} disabled={uploading} />
        <Button
          title={recordingActive ? tx('Stop', 'Stop') : tx('Vocal', 'Voice')}
          variant="secondary"
          onPress={recordingActive ? stopRecording : startRecording}
          disabled={uploading}
        />
        <Input value={value} onChangeText={onTyping} placeholder={blocked ? tx('Utilisateur bloqué.', 'User blocked.') : tx('Écrire un message', 'Write a message')} style={{ flex: 1 }} />
        <Button title={tx('Envoyer', 'Send')} onPress={sendMessage} disabled={uploading || blocked} />
      </View>
      {uploading ? <Text style={styles.subtle}>{tx('Téléchargement...', 'Uploading...')}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginTop: 6,
    marginBottom: 12
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700'
  },
  typing: {
    color: colors.muted,
    marginTop: 4
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginBottom: 10
  },
  messageRow: {
    flexDirection: 'row'
  },
  rowMine: {
    justifyContent: 'flex-end'
  },
  rowOther: {
    justifyContent: 'flex-start'
  },
  bubble: {
    maxWidth: '78%',
    padding: 12,
    borderRadius: radius.md
  },
  bubbleMine: {
    marginLeft: 24,
    backgroundColor: 'rgba(51,199,196,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(51,199,196,0.35)'
  },
  bubbleOther: {
    marginRight: 24,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line
  },
  sender: {
    color: colors.muted,
    fontSize: 11,
    marginBottom: 4
  },
  warning: {
    color: colors.warning,
    fontSize: 11,
    marginBottom: 4
  },
  body: {
    color: colors.text
  },
  sticker: {
    fontSize: 30,
    marginTop: 4
  },
  callCard: {
    marginTop: 8,
    padding: 8,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(0,0,0,0.04)'
  },
  callTitle: {
    color: colors.text,
    fontWeight: '700',
    marginBottom: 4
  },
  callLink: {
    color: colors.accent,
    fontWeight: '700'
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6
  },
  reactionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6
  },
  reactionChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel
  },
  reactionChipActive: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(51,199,196,0.15)'
  },
  reactionText: {
    color: colors.text,
    fontSize: 12
  },
  time: {
    color: colors.muted,
    fontSize: 10
  },
  report: {
    color: colors.warning,
    fontSize: 10,
    textTransform: 'uppercase'
  },
  attachments: {
    marginTop: 8,
    gap: 8
  },
  attachmentImage: {
    width: '100%',
    height: 180,
    borderRadius: radius.md
  },
  attachmentText: {
    color: colors.muted,
    fontSize: 12
  },
  audioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6
  },
  audioButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel
  },
  audioButtonText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700'
  },
  audioMeta: {
    color: colors.muted,
    fontSize: 11
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 8
  },
  stickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: 6
  },
  stickerLabel: {
    color: colors.muted,
    fontSize: 11
  },
  stickerButton: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line
  },
  stickerText: {
    fontSize: 16
  },
  attachmentsPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingBottom: 8
  },
  previewItem: {
    width: 92,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: 6,
    backgroundColor: colors.panel
  },
  previewImage: {
    width: '100%',
    height: 68,
    borderRadius: radius.sm
  },
  previewText: {
    color: colors.muted,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 8
  },
  previewRemove: {
    color: colors.warning,
    fontSize: 10,
    textAlign: 'center',
    marginTop: 6
  },
  subtle: {
    color: colors.muted,
    marginTop: 8
  }
});
