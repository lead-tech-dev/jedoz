import React from 'react';
import { apiFetch } from '../../lib/api';
import { notifyError, notifySuccess } from '../../lib/toast';
import { useI18n } from '../../lib/i18n';

type Ticket = {
  id: string;
  subject: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt?: string | null;
};

type TicketMessage = {
  id: string;
  body: string;
  isInternal: boolean;
  createdAt: string;
};

type TicketDetail = Ticket & { messages?: TicketMessage[] };

export function D_Support() {
  const { tx } = useI18n();
  const [items, setItems] = React.useState<Ticket[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<TicketDetail | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [subject, setSubject] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [reply, setReply] = React.useState('');

  const load = React.useCallback(() => {
    setLoading(true);
    apiFetch<{ items: Ticket[] }>('/support/tickets')
      .then((res) => setItems(res.items || []))
      .catch((err) => notifyError(err, tx('Chargement impossible.', 'Unable to load.')))
      .finally(() => setLoading(false));
  }, [tx]);

  const loadDetail = React.useCallback((id: string) => {
    apiFetch<{ item: TicketDetail }>(`/support/tickets/${id}`)
      .then((res) => setDetail(res.item))
      .catch((err) => notifyError(err, tx('Chargement impossible.', 'Unable to load.')));
  }, [tx]);

  React.useEffect(() => {
    load();
  }, [load]);

  React.useEffect(() => {
    if (!selectedId) return;
    loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  const createTicket = async () => {
    if (!subject.trim() || !message.trim()) return;
    try {
      await apiFetch('/support/tickets', {
        method: 'POST',
        body: JSON.stringify({ subject, message, priority: 'MEDIUM' }),
      });
      setSubject('');
      setMessage('');
      notifySuccess(tx('Ticket créé.', 'Ticket created.'));
      load();
    } catch (err) {
      notifyError(err, tx('Création impossible.', 'Unable to create ticket.'));
    }
  };

  const sendReply = async () => {
    if (!detail || !reply.trim()) return;
    try {
      await apiFetch(`/support/tickets/${detail.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ message: reply }),
      });
      setReply('');
      loadDetail(detail.id);
      load();
    } catch (err) {
      notifyError(err, tx('Envoi impossible.', 'Unable to send.'));
    }
  };

  return (
    <div className="panel pad">
      <div className="section-title">
        <div className="h2">{tx('Support', 'Support')}</div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1fr 1.4fr', gap: 12 }}>
        <div className="panel pad" style={{ display: 'grid', gap: 8 }}>
          {loading ? <div className="small">{tx('Chargement…', 'Loading…')}</div> : null}
          {items.length === 0 ? <div className="small">{tx('Aucun ticket.', 'No tickets yet.')}</div> : null}
          {items.map((t) => (
            <button
              key={t.id}
              className="panel pad"
              style={{ textAlign: 'left', borderStyle: selectedId === t.id ? 'solid' : 'dashed' }}
              onClick={() => setSelectedId(t.id)}
            >
              <div style={{ fontWeight: 900 }}>{t.subject}</div>
              <div className="small">{t.status} · {t.priority}</div>
            </button>
          ))}
        </div>

        <div className="panel pad">
          {!detail ? (
            <div className="small">{tx('Sélectionnez un ticket.', 'Select a ticket.')}</div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              <div>
                <div style={{ fontWeight: 900 }}>{detail.subject}</div>
                <div className="small">{detail.status} · {detail.priority}</div>
              </div>
              <div style={{ display: 'grid', gap: 8, maxHeight: 320, overflow: 'auto' }}>
                {(detail.messages || []).map((m) => (
                  <div key={m.id} className="panel pad" style={{ padding: 10 }}>
                    <div className="small">{new Date(m.createdAt).toLocaleString('fr-FR')}</div>
                    <div style={{ whiteSpace: 'pre-wrap' }}>{m.body}</div>
                  </div>
                ))}
              </div>
              <div className="row" style={{ gap: 8 }}>
                <input className="input" value={reply} onChange={(e) => setReply(e.target.value)} placeholder={tx('Votre message...', 'Your message...')} />
                <button className="btn primary" onClick={sendReply}>{tx('Envoyer', 'Send')}</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="divider" />
      <div className="h2">{tx('Nouveau ticket', 'New ticket')}</div>
      <div className="grid cols-2" style={{ gap: 12 }}>
        <input className="input" placeholder={tx('Sujet', 'Subject')} value={subject} onChange={(e) => setSubject(e.target.value)} />
        <input className="input" placeholder={tx('Message', 'Message')} value={message} onChange={(e) => setMessage(e.target.value)} />
      </div>
      <div style={{ height: 10 }} />
      <button className="btn primary" onClick={createTicket}>{tx('Envoyer', 'Send')}</button>
    </div>
  );
}
