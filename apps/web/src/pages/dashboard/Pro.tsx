import React from 'react';
import { apiFetch } from '../../lib/api';
import { notifyError, notifyInfo, notifySuccess } from '../../lib/toast';
import { normalizeCameroonPhone } from '../../lib/phone';
import { ProState } from './types';
import { useI18n } from '../../lib/i18n';
import { Select } from '@repo/ui';

type ProOffer = { id: string; plan: 'MONTHLY' | 'YEARLY'; name: string; creditsCost: number; durationDays: number; currency: string; price?: number; country?: string | null };

function makeIdempotencyKey(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function currencyFmt(amount: number, currency: string, locale: string) {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

export function D_Pro(){
  const { lang, tx } = useI18n();
  const [state, setState] = React.useState<ProState | null>(null);
  const [offers, setOffers] = React.useState<ProOffer[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<any>(null);
  const [provider, setProvider] = React.useState<'MTN'|'ORANGE'|'STRIPE'>('MTN');
  const [phone, setPhone] = React.useState('');
  const locale = lang === 'fr' ? 'fr-FR' : 'en-GB';

  const reload = React.useCallback(() => {
    setError(null);
    Promise.all([
      apiFetch<ProState>('/pro/me'),
      apiFetch<{ items: ProOffer[] }>('/pro/offers?country=CM'),
    ])
      .then(([s, o]) => { setState(s); setOffers(o.items); })
      .catch((err) => {
        setError(err);
        notifyError(err, tx('Erreur de chargement PRO.', 'Unable to load PRO data.'));
      });
  }, [tx]);

  React.useEffect(() => { reload(); }, [reload]);

  async function subscribe(offer: ProOffer) {
    setLoading(true);
    setError(null);
    try {
    let normalizedPhone: string | null = null;
    if (provider === 'MTN' || provider === 'ORANGE') {
      normalizedPhone = normalizeCameroonPhone(phone);
      if (!normalizedPhone) {
        notifyError(null, tx('Numéro camerounais invalide.', 'Invalid Cameroon phone number.'));
        return;
      }
    }
      const init = await apiFetch<{ intentId: string; status: string; checkoutUrl?: string; redirectUrl?: string; paymentUrl?: string; reference?: string; instructions?: string }>(
        '/payments/init',
        {
          method: 'POST',
          body: JSON.stringify({
            provider,
            productType: 'PRO_SUBSCRIPTION',
            productRefId: offer.id,
            country: 'CM',
        phone: normalizedPhone,
            idempotencyKey: makeIdempotencyKey('pro'),
          }),
        }
      );
      if (init.checkoutUrl) {
        window.location.href = init.checkoutUrl;
        return;
      }
      if (init.redirectUrl) {
        window.location.href = init.redirectUrl;
        return;
      }
      if (init.paymentUrl) {
        window.location.href = init.paymentUrl;
        return;
      }
      const start = Date.now();
      const poll = async () => {
        const st = await apiFetch<{ status: string }>(`/payments/${init.intentId}/status`);
        if (st.status === 'SUCCESS') {
          notifySuccess(tx('Abonnement PRO activé.', 'PRO subscription activated.'));
          reload();
          return;
        }
        if (st.status === 'FAILED' || st.status === 'CANCELLED') {
          throw new Error('PAYMENT_FAILED');
        }
        if (Date.now() - start > 180000) throw new Error('PAYMENT_TIMEOUT');
        setTimeout(poll, 3000);
      };
      notifyInfo(init.instructions || tx(`Paiement en attente. Référence: ${init.reference || init.intentId}`, `Payment pending. Reference: ${init.reference || init.intentId}`));
      poll();
    } catch (e) {
      setError(e);
      notifyError(e, tx('Souscription impossible.', 'Subscription failed.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel pad">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <h1 className="h1">{tx('Abonnement PRO', 'PRO subscription')}</h1>
          <div className="small">{tx('PRO débloque des quotas illimités + badge. Paiement via MTN/Orange/Stripe.', 'PRO unlocks unlimited quotas + badge. Pay with MTN/Orange/Stripe.')}</div>
        </div>
      </div>

      <div style={{ height: 12 }} />
      {error ? (
        <div className="small" style={{ color: 'var(--red)' }}>
          <b>{tx('Erreur', 'Error')}:</b> {String(error?.error || error?.message || error)}
        </div>
      ) : null}

      <div className="panel pad" style={{ marginTop: 12 }}>
        <div className="h2">{tx('Statut', 'Status')}</div>
        {!state ? <div className="small">{tx('Chargement…', 'Loading…')}</div> : null}
        {state ? (
          state.isPro ? (
            <div className="small">✅ {tx('PRO actif', 'PRO active')} — {tx('plan', 'plan')} <b>{state.active?.plan}</b> {tx('jusqu’au', 'until')} <b>{new Date(state.active!.endAt).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-GB')}</b>.</div>
          ) : (
            <div className="small">{tx('Tu n’es pas PRO actuellement.', 'You are not PRO yet.')}</div>
          )
        ) : null}
      </div>

      <div className="panel pad" style={{ marginTop: 12 }}>
        <div className="h2">{tx('Règles Standard vs PRO', 'Standard vs PRO rules')}</div>
        <div className="grid cols-2" style={{ marginTop: 10 }}>
          <div className="panel pad">
            <div style={{ fontWeight: 900 }}>{tx('Standard', 'Standard')}</div>
            <ul className="small" style={{ marginTop: 8, paddingLeft: 18 }}>
              <li>{tx('3 annonces / jour', '3 listings / day')}</li>
              <li>{tx('Boosts / jour : VIP x2 · Urgent x2 · Top x1 · Home x1', 'Boosts / day: VIP x2 · Urgent x2 · Top x1 · Home x1')}</li>
              <li>{tx('Messagerie : 8 msg / 30s · 4 pièces jointes · 1 lien · 2 000 caractères', 'Messaging: 8 msg / 30s · 4 attachments · 1 link · 2,000 chars')}</li>
              <li>{tx('Paiement normal sur publications & boosts', 'Standard pricing on listings & boosts')}</li>
            </ul>
          </div>
          <div className="panel pad" style={{ borderStyle: 'dashed' }}>
            <div style={{ fontWeight: 900 }}>{tx('PRO', 'PRO')}</div>
            <ul className="small" style={{ marginTop: 8, paddingLeft: 18 }}>
              <li>{tx('Publications illimitées', 'Unlimited listings')}</li>
              <li>{tx('Boosts illimités (VIP / Urgent / Top / Home)', 'Unlimited boosts (VIP / Urgent / Top / Home)')}</li>
              <li>{tx('-30% sur publications & boosts', '-30% on listings & boosts')}</li>
              <li>{tx('Messagerie : 20 msg / 30s · 8 pièces jointes · 3 liens · 5 000 caractères', 'Messaging: 20 msg / 30s · 8 attachments · 3 links · 5,000 chars')}</li>
              <li>{tx('Badge PRO sur le profil', 'PRO badge on profile')}</li>
            </ul>
          </div>
        </div>
      </div>

      <div style={{ height: 14 }} />
      <h2 className="h2">{tx('Offres PRO', 'PRO offers')}</h2>
      <div style={{ height: 12 }} />
      <div className="grid cols-2" style={{ gap: 12 }}>
        <div>
          <div className="label">{tx('Provider', 'Provider')}</div>
          <Select className="input" value={provider} onChange={(value) => setProvider(value as any)} ariaLabel={tx('Provider', 'Provider')}>
            <option value="MTN">MTN MoMo</option>
            <option value="ORANGE">Orange Money</option>
            <option value="STRIPE">Stripe</option>
          </Select>
        </div>
        {(provider === 'MTN' || provider === 'ORANGE') ? (
          <div>
            <div className="label">{tx('Téléphone', 'Phone')}</div>
            <input className="input" placeholder={tx('2376xxxxxxx', '2376xxxxxxx')} value={phone} onChange={(e)=>setPhone(e.target.value)} />
          </div>
        ) : (
          <div />
        )}
      </div>
      <div className="grid cols-2" style={{ marginTop: 10 }}>
        {offers.map((o) => (
          <div key={o.id} className="panel pad" style={{ borderStyle: 'dashed' }}>
            <div style={{ fontWeight: 900, fontSize: 20 }}>{o.name}</div>
            <div className="small">{tx('Plan', 'Plan')}: {o.plan} · {tx('Durée', 'Duration')}: {o.durationDays} {tx('jours', 'days')}</div>
            <div style={{ height: 8 }} />
            <div style={{ fontWeight: 900, fontSize: 28 }}>
              {o.price ? currencyFmt(o.price, o.currency, locale) : `${o.creditsCost} ${tx('crédits', 'credits')}`}
            </div>
            <div style={{ height: 10 }} />
            <button className="btn primary" disabled={loading} onClick={() => subscribe(o)}>
              {loading ? tx('Activation…', 'Activating…') : tx('Activer', 'Activate')}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export function D_SubHistory(){
  const { tx } = useI18n();
  return <div className="panel pad"><h1 className="h1">{tx('Historique abonnement', 'Subscription history')}</h1><div className="small">{tx('Aucun historique pour le moment.', 'No history yet.')}</div></div>;
}
