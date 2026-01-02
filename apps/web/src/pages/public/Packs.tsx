import React from 'react';
import { ConfirmDialog, Select } from '@repo/ui';
import { PageTitle } from './_common';
import { apiFetch } from '../../lib/api';
import { notifyError, notifyInfo } from '../../lib/toast';
import { normalizeCameroonPhone } from '../../lib/phone';
import { useI18n } from '../../lib/i18n';

type CreditPack = { id: string; name: string; credits: number; price: number; currency: string; country?: string | null };

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

export function Packs() {
  const { lang, tx } = useI18n();
  const [packs, setPacks] = React.useState<CreditPack[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<any>(null);
  const [provider, setProvider] = React.useState<'MTN'|'ORANGE'|'STRIPE'>('MTN');
  const [phone, setPhone] = React.useState('');
  const [pendingPack, setPendingPack] = React.useState<CreditPack | null>(null);
  const locale = lang === 'fr' ? 'fr-FR' : 'en-GB';
  const bestValueId = React.useMemo(() => {
    if (!packs.length) return null;
    let best = packs[0];
    let bestRatio = best.price > 0 ? best.credits / best.price : 0;
    for (const pack of packs) {
      const ratio = pack.price > 0 ? pack.credits / pack.price : 0;
      if (ratio > bestRatio) {
        best = pack;
        bestRatio = ratio;
      }
    }
    return best.id;
  }, [packs]);

  React.useEffect(() => {
    apiFetch<{ items: CreditPack[] }>('/credits/packs?country=CM')
      .then((r) => setPacks(r.items))
      .catch((err) => {
        setError(err);
        notifyError(err, tx('Erreur de chargement des packs.', 'Unable to load packs.'));
      });
  }, [tx]);

  const purchasePack = React.useCallback(async (pack: CreditPack) => {
    try {
      let normalizedPhone: string | null = null;
      if (provider === 'MTN' || provider === 'ORANGE') {
        normalizedPhone = normalizeCameroonPhone(phone);
        if (!normalizedPhone) {
          notifyError(null, tx('Numéro camerounais invalide.', 'Invalid Cameroon phone number.'));
          return;
        }
      }
      setLoading(true);
      const init = await apiFetch<{ intentId: string; status: string; checkoutUrl?: string; redirectUrl?: string; paymentUrl?: string; reference?: string; instructions?: string }>(
        '/payments/init',
        {
          method: 'POST',
          body: JSON.stringify({
            provider,
            productType: 'CREDIT_PACK',
            productRefId: pack.id,
            country: 'CM',
            phone: normalizedPhone,
            idempotencyKey: makeIdempotencyKey('pack'),
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
      // MoMo/Orange: poll until SUCCESS/FAILED
      const start = Date.now();
      const poll = async () => {
        const st = await apiFetch<{ status: string; reason?: string | null; insufficientFunds?: boolean }>(`/payments/${init.intentId}/status`);
        if (st.status === 'SUCCESS') {
          window.location.href = '/dashboard/wallet/credits';
          return;
        }
        if (st.status === 'FAILED' || st.status === 'CANCELLED') {
          const msg = st.insufficientFunds
            ? tx('Solde MoMo insuffisant.', 'Insufficient MoMo balance.')
            : tx('Paiement refusé.', 'Payment failed.');
          notifyError(null, msg);
          setError({ error: st.reason || msg });
          return;
        }
        if (Date.now() - start > 180000) {
          notifyError(null, tx('Délai de paiement dépassé.', 'Payment timed out.'));
          return;
        }
        setTimeout(poll, 3000);
      };
      setError(null);
      notifyInfo(init.instructions || tx(`Paiement en attente. Référence: ${init.reference || init.intentId}`, `Payment pending. Reference: ${init.reference || init.intentId}`));
      poll();
    } catch (e) {
      setError(e);
      notifyError(e, tx('Paiement impossible.', 'Payment failed.'));
      if ((e as any)?.status === 401) window.location.href = '/auth/login';
    } finally {
      setLoading(false);
    }
  }, [phone, provider, tx]);

  return (
    <>
      <PageTitle title={tx('Packs & Crédits', 'Packs & Credits')} />
      <div className="packsHero mb-6">
        <div className="panel pad">
          <div className="kicker">{tx('Crédits', 'Credits')}</div>
          <div className="h2">{tx('Recharge rapide', 'Instant top up')}</div>
          <div className="small">
            {tx('Achetez un pack et recevez vos crédits immédiatement.', 'Buy a pack and receive credits instantly.')}
          </div>
          <div style={{ height: 12 }} />
          <div className="row wrap" style={{ gap: 8 }}>
            <span className="badge neutral">{tx('Paiement sécurisé', 'Secure payment')}</span>
            <span className="badge neutral">{tx('Sans abonnement', 'No subscription')}</span>
            <span className="badge neutral">{tx('Crédits instantanés', 'Instant credits')}</span>
          </div>
        </div>
        <div className="panel pad">
          <div className="small">{tx('Choisis ton moyen de paiement', 'Choose your payment method')}</div>
          <div style={{ height: 10 }} />
          <div className="packsHeroFields">
            <div>
              <div className="label">{tx('Provider', 'Provider')}</div>
              <Select className="input" value={provider} onChange={(value) => setProvider(value as any)} ariaLabel={tx('Provider', 'Provider')}>
                <option value="MTN">MTN MoMo</option>
                <option value="ORANGE">Orange Money</option>
                <option value="STRIPE">Stripe</option>
              </Select>
            </div>
            {(provider === "MTN" || provider === "ORANGE") && (
              <div>
                <div className="label">{tx('Téléphone', 'Phone')}</div>
                <input className="input" placeholder={tx('2376xxxxxxx', '2376xxxxxxx')} value={phone} onChange={(e)=>setPhone(e.target.value)} />
              </div>
            )}
          </div>
        </div>
      </div>

      {error ? (
        <div className="panel pad">
          <b>{tx('Erreur', 'Error')}:</b> {String(error?.error || error?.message || error)}
        </div>
      ) : null}

      <div className="grid cols-3">
        {packs.map((p) => (
          <div key={p.id} className={`panel pad packCard${p.id === bestValueId ? ' best' : ''}`}>
            {p.id === bestValueId ? <span className="badge vip packBadge">{tx('Meilleur choix', 'Best value')}</span> : null}
            <div className="packGlow" />
            <div className="kicker">{tx('Pack', 'Pack')}</div>
            <div className="h2">{p.name}</div>
            <div style={{ height: 6 }} />
            <div className="packCredits">{p.credits} {tx('crédits', 'credits')}</div>
            <div className="packMeta">
              <span>≈ {currencyFmt(p.credits ? p.price / p.credits : p.price, p.currency, locale)} / {tx('crédit', 'credit')}</span>
              <span>{tx('Paiement unique', 'One-time')}</span>
            </div>
            <div style={{ height: 10 }} />
            <div className="packFoot">
              <div className="packPrice">{currencyFmt(p.price, p.currency, locale)}</div>
              <button
                className="btn primary"
                disabled={loading}
                onClick={() => setPendingPack(p)}
              >
                {tx('Acheter', 'Buy')}
              </button>
            </div>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={!!pendingPack}
        title={tx('Confirmer l’achat', 'Confirm purchase')}
        description={
          pendingPack
            ? tx(
                `Voulez-vous acheter le pack ${pendingPack.name} (${pendingPack.credits} crédits) ?`,
                `Do you want to buy the ${pendingPack.name} pack (${pendingPack.credits} credits)?`
              )
            : undefined
        }
        confirmLabel={tx('Acheter', 'Buy')}
        cancelLabel={tx('Annuler', 'Cancel')}
        confirmDisabled={loading}
        onCancel={() => setPendingPack(null)}
        onConfirm={() => {
          if (!pendingPack) return;
          const pack = pendingPack;
          setPendingPack(null);
          purchasePack(pack);
        }}
      />
    </>
  );
}
