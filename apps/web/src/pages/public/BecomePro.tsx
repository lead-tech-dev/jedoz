import React from 'react';
import { PageTitle } from './_common';
import { apiFetch, getToken } from '../../lib/api';
import { useI18n } from '../../lib/i18n';
import { Select } from '@repo/ui';
import { notifyError, notifyInfo } from '../../lib/toast';
import { normalizeCameroonPhone } from '../../lib/phone';

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

export function BecomePro() {
  const { lang, tx } = useI18n();
  const fmtDays = React.useCallback((d: number) => {
    if (d >= 365) return lang === 'fr' ? `${Math.round(d / 365)} an` : `${Math.round(d / 365)} year`;
    if (d >= 30) return lang === 'fr' ? `${Math.round(d / 30)} mois` : `${Math.round(d / 30)} month`;
    return lang === 'fr' ? `${d} j` : `${d} d`;
  }, [lang]);
  const [offers, setOffers] = React.useState<ProOffer[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<any>(null);
  const isAuthed = Boolean(getToken());
  const [provider, setProvider] = React.useState<'MTN'|'ORANGE'|'STRIPE'>('MTN');
  const [phone, setPhone] = React.useState('');
  const locale = lang === 'fr' ? 'fr-FR' : 'en-GB';

  React.useEffect(() => {
    apiFetch<{ items: ProOffer[] }>(`/pro/offers?country=CM`).then((r) => setOffers(r.items)).catch(setErr);
  }, []);

  async function subscribe(offer: ProOffer) {
    setLoading(true);
    setErr(null);
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
        try {
          const st = await apiFetch<{ status: string; reason?: string | null; insufficientFunds?: boolean }>(`/payments/${init.intentId}/status`);
          if (st.status === 'SUCCESS') {
            window.location.href = '/dashboard/subscriptions/pro';
            return;
          }
          if (st.status === 'FAILED' || st.status === 'CANCELLED') {
            const msg = st.insufficientFunds
              ? tx('Solde MoMo insuffisant.', 'Insufficient MoMo balance.')
              : tx('Paiement refusé.', 'Payment failed.');
            notifyError(null, msg);
            setErr({ error: st.reason || msg });
            return;
          }
          if (Date.now() - start > 180000) {
            notifyError(null, tx('Délai de paiement dépassé.', 'Payment timed out.'));
            return;
          }
          setTimeout(poll, 3000);
        } catch (e) {
          setErr(e);
          notifyError(e, tx('Paiement impossible.', 'Payment failed.'));
        }
      };
      notifyInfo(init.instructions || tx(`Paiement en attente. Référence: ${init.reference || init.intentId}`, `Payment pending. Reference: ${init.reference || init.intentId}`));
      poll();
    } catch (e) {
      setErr(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel pad">
      <PageTitle title={tx('Devenir PRO', 'Go PRO')} subtitle={tx('Badge PRO + quotas illimités + avantages premium.', 'PRO badge + unlimited quotas + premium benefits.')} />
      <div className="small" style={{ maxWidth: 760 }}>
        {tx('Paiement via MTN/Orange/Stripe.', 'Pay with MTN/Orange/Stripe.')}
      </div>
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
      <div style={{ height: 14 }} />
      <div className="grid cols-2">
        <div className="panel pad">
          <div className="h2">{tx('Standard', 'Standard')}</div>
          <ul className="small" style={{ marginTop: 8, paddingLeft: 18 }}>
            <li>{tx('3 annonces / jour', '3 listings / day')}</li>
            <li>{tx('Boosts / jour : VIP x2 · Urgent x2 · Top x1 · Home x1', 'Boosts / day: VIP x2 · Urgent x2 · Top x1 · Home x1')}</li>
            <li>{tx('Messagerie : 8 msg / 30s · 4 pièces jointes · 1 lien · 2 000 caractères', 'Messaging: 8 msg / 30s · 4 attachments · 1 link · 2,000 chars')}</li>
            <li>{tx('Paiement normal sur publications & boosts', 'Standard pricing on listings & boosts')}</li>
          </ul>
        </div>
        <div className="panel pad" style={{ borderStyle: 'dashed' }}>
          <div className="h2">{tx('PRO', 'PRO')}</div>
          <ul className="small" style={{ marginTop: 8, paddingLeft: 18 }}>
            <li>{tx('Publications illimitées', 'Unlimited listings')}</li>
            <li>{tx('Boosts illimités (VIP / Urgent / Top / Home)', 'Unlimited boosts (VIP / Urgent / Top / Home)')}</li>
            <li>{tx('-30% sur publications & boosts', '-30% on listings & boosts')}</li>
            <li>{tx('Messagerie : 20 msg / 30s · 8 pièces jointes · 3 liens · 5 000 caractères', 'Messaging: 20 msg / 30s · 8 attachments · 3 links · 5,000 chars')}</li>
            <li>{tx('Badge PRO sur le profil', 'PRO badge on profile')}</li>
          </ul>
        </div>
      </div>
      <div style={{ height: 14 }} />

      {err ? (
        <div className="small" style={{ color: 'var(--red)' }}>
          <b>{tx('Erreur', 'Error')}:</b> {String(err?.error || err?.message || err)}
        </div>
      ) : null}

      <div className="grid cols-2" style={{ marginTop: 16 }}>
        {offers.map((o) => (
          <div key={o.id} className="panel pad" style={{ borderStyle: 'dashed' }}>
            <div className="h2">{o.name}</div>
            <div className="small">{tx('Durée', 'Duration')} : {fmtDays(o.durationDays)} · {tx('Plan', 'Plan')} : {o.plan}</div>
            <div style={{ height: 8 }} />
            <div style={{ fontWeight: 900, fontSize: 28 }}>
              {o.price ? currencyFmt(o.price, o.currency, locale) : `${o.creditsCost} ${tx('crédits', 'credits')}`}
            </div>
            <div style={{ height: 10 }} />
            {!isAuthed ? (
              <a className="btn primary" href="/auth/register">{tx('Créer un compte', 'Create account')}</a>
            ) : (
              <button className="btn primary" disabled={loading} onClick={() => subscribe(o)}>
                {loading ? tx('Activation…', 'Activating…') : tx('Activer PRO', 'Activate PRO')}
              </button>
            )}
          </div>
        ))}
      </div>

      <div style={{ height: 14 }} />
      <div className="row">
        <a className="btn" href="/dashboard/subscriptions/pro">{tx('Gérer mon PRO', 'Manage my PRO')}</a>
        <a className="btn ghost" href="/packs">{tx('Recharger des crédits', 'Top up credits')}</a>
      </div>
    </div>
  );
}
