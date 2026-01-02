import React from 'react';
import { apiFetch } from '../../lib/api';
import { CreditPack, CreditTx, Wallet } from './types';
import { currencyFmt } from './utils';
import { notifyError, notifyInfo, notifySuccess } from '../../lib/toast';
import { normalizeCameroonPhone } from '../../lib/phone';
import { formatAction } from '../../lib/actions';
import { useI18n } from '../../lib/i18n';
import { ConfirmDialog, Select } from '@repo/ui';

function makeIdempotencyKey(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function D_Credits(){
  const { lang, tx } = useI18n();
  const locale = lang === 'fr' ? 'fr-FR' : 'en-GB';
  const [wallet, setWallet] = React.useState<Wallet | null>(null);
  const [txs, setTxs] = React.useState<CreditTx[]>([]);
  const [packs, setPacks] = React.useState<CreditPack[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<any>(null);
  const [provider, setProvider] = React.useState<'MTN'|'ORANGE'|'STRIPE'>('MTN');
  const [phone, setPhone] = React.useState('');
  const [pendingPack, setPendingPack] = React.useState<CreditPack | null>(null);
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

  const reload = React.useCallback(() => {
    setError(null);
    Promise.all([
      apiFetch<{ wallet: Wallet; txs: CreditTx[] }>('/credits/wallet'),
      apiFetch<{ items: CreditPack[] }>('/credits/packs?country=CM'),
    ])
      .then(([w, p]) => {
        setWallet(w.wallet);
        setTxs(w.txs);
        setPacks(p.items);
      })
      .catch((err) => {
        setError(err);
        notifyError(err, tx('Erreur de chargement des crédits.', 'Unable to load credits.'));
      });
  }, [tx]);

  React.useEffect(() => {
    reload();
  }, [reload]);

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
      const start = Date.now();
      const poll = async () => {
        const st = await apiFetch<{ status: string; reason?: string | null; insufficientFunds?: boolean }>(`/payments/${init.intentId}/status`);
        if (st.status === 'SUCCESS') {
          reload();
          notifySuccess(tx('Achat confirmé.', 'Purchase confirmed.'));
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
      notifyInfo(init.instructions || tx(`Paiement en attente. Référence: ${init.reference || init.intentId}`, `Payment pending. Reference: ${init.reference || init.intentId}`));
      poll();
    } catch (e) {
      setError(e);
      notifyError(e, tx('Achat impossible.', 'Purchase failed.'));
    } finally {
      setLoading(false);
    }
  }, [phone, provider, reload, tx]);

  return (
    <div className="grid" style={{ gridTemplateColumns: '1.1fr 0.9fr', gap: 18 }}>
      <div className="panel pad">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <div className="small">{tx('Solde actuel', 'Current balance')}</div>
            <div style={{ fontSize: 46, fontWeight: 900, lineHeight: 1.05 }}>{wallet?.balance ?? 0} {tx('crédits', 'credits')}</div>
          </div>
          <a className="btn" href="/packs">{tx('Voir les packs publics', 'View public packs')}</a>
        </div>

        <div style={{ height: 18 }} />
        <h2 className="h2">{tx('Recharger (packs)', 'Top up (packs)')}</h2>
        <div className="small">{tx('Paiement via MTN/Orange/Stripe.', 'Pay with MTN/Orange/Stripe.')}</div>

        <div style={{ height: 12 }} />
        <div className="grid cols-2" style={{ gap: 12, alignItems: 'end' }}>
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

        <div style={{ height: 12 }} />
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

        {error ? (
          <div style={{ marginTop: 12 }} className="small">
            <b>{tx('Erreur', 'Error')}:</b> {String(error?.error || error?.message || error)}
            <div style={{ height: 6 }} />
            <a className="btn" href="/auth/login">{tx('Connexion', 'Log in')}</a>
          </div>
        ) : null}
      </div>

      <div className="panel pad">
        <h2 className="h2">{tx('Dernières transactions', 'Latest transactions')}</h2>
        <div style={{ height: 10 }} />
        <div style={{ display: 'grid', gap: 10 }}>
          {txs.length === 0 ? <div className="small">{tx('Aucune transaction pour le moment.', 'No transactions yet.')}</div> : null}
          {txs.map((t) => (
            <div key={t.id} className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 800 }}>
                  {t.meta?.packName
                    ? tx(`Achat pack ${t.meta.packName}`, `Pack purchase ${t.meta.packName}`)
                    : formatAction(t.reason, tx)}
                </div>
                <div className="small">{new Date(t.createdAt).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-GB')}</div>
              </div>
              <div style={{ fontWeight: 900 }}>
                {t.type === 'CREDIT' ? '+' : '-'}{t.amount}
              </div>
            </div>
          ))}
        </div>
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
    </div>
  )
}

export function D_Transactions(){
  const { tx } = useI18n();
  return <div className="panel pad"><h1 className="h1">{tx('Transactions', 'Transactions')}</h1><div className="small">{tx('Historique des paiements.', 'Payment history.')}</div></div>;
}
export function D_Invoices(){
  const { tx } = useI18n();
  return <div className="panel pad"><h1 className="h1">{tx('Factures', 'Invoices')}</h1><div className="small">{tx('Téléchargement PDF disponible dans votre compte.', 'PDF downloads available in your account.')}</div></div>;
}
