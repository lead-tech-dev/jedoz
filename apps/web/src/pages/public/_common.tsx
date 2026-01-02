import React from 'react';
import { Badge, SearchBar } from '@repo/ui';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../../lib/api';
import { IconPin, IconUser } from '../../components/Icons';
import { useI18n } from '../../lib/i18n';

export type ListingAd = {
  id: string;
  title?: string | null;
  city?: string | null;
  country?: string | null;
  createdAt?: string | null;
  badges?: string[] | null;
  media?: { url?: string | null }[] | null;
  dynamic?: any;
};

const BADGE_KIND: Record<string, 'vip' | 'urgent' | 'top' | 'premium'> = {
  VIP: 'vip',
  URGENT: 'urgent',
  TOP: 'top',
  HOME: 'premium',
  PREMIUM: 'premium',
};

function resolveMediaUrl(url?: string | null, baseUrl = API_BASE) {
  if (!url) return undefined;
  return url.startsWith('http') ? url : `${baseUrl}${url}`;
}

function resolveName(dynamic: any) {
  if (!dynamic || typeof dynamic !== 'object') return null;
  return (
    dynamic.display_name ||
    dynamic.displayName ||
    dynamic.full_name ||
    dynamic.fullname ||
    dynamic.name ||
    dynamic.username ||
    dynamic.pseudo ||
    dynamic.nom ||
    null
  );
}

function resolveDistrict(dynamic: any) {
  if (!dynamic || typeof dynamic !== 'object') return null;
  return (
    dynamic.quartier ||
    dynamic.district ||
    dynamic.neighborhood ||
    dynamic.neighbourhood ||
    dynamic.area ||
    dynamic.zone ||
    dynamic.arrondissement ||
    null
  );
}

function renderQualityBadge(badges: string[] | null | undefined, tx: (fr: string, en: string) => string) {
  const list = (badges || []).map((b) => String(b || '').toUpperCase());
  for (const badge of list) {
    const kind = BADGE_KIND[badge];
    if (kind) return <Badge kind={kind}>{badge}</Badge>;
  }
  if (list.length) return <span className="badge neutral">{list[0]}</span>;
  return <span className="badge neutral">{tx('STANDARD', 'STANDARD')}</span>;
}

export function ListingCard(props: { ad: ListingAd; onClick?: () => void; apiBaseUrl?: string }) {
  const { lang, tx } = useI18n();
  const { ad, onClick, apiBaseUrl } = props;
  const name = resolveName(ad.dynamic) || tx('Anonyme', 'Anonymous');
  const district = resolveDistrict(ad.dynamic);
  const city = ad.city || '';
  const locationBits = [];
  if (district) locationBits.push(district);
  if (city) locationBits.push(city);
  const locationLine = locationBits.length ? locationBits.join(' · ') : tx('—', '—');
  const published = ad.createdAt ? new Date(ad.createdAt).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB') : tx('—', '—');
  const badgeNode = renderQualityBadge(ad.badges || [], tx);
  const imageUrl = resolveMediaUrl(ad.media?.[0]?.url || undefined, apiBaseUrl);

  return (
    <div
      className="card"
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && onClick) onClick();
      }}
    >
      <div className="thumb" aria-hidden="true">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="thumbImg"
          />
        ) : (
          <div className="thumbPlaceholder" />
        )}
        <div style={{ position: 'absolute', top: 10, right: 10 }}>
          {badgeNode}
        </div>
      </div>
      <div className="body">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 900 }}>{ad.title || tx('Annonce', 'Listing')}</div>
        </div>
        <div className="row small" style={{ marginTop: 6, gap: 6 }}>
          <IconUser className="icon" />
          <span>{name}</span>
        </div>
        <div className="row small" style={{ marginTop: 2, gap: 6 }}>
          <IconPin className="icon" />
          <span>{locationLine}</span>
        </div>
        <div className="meta" style={{ marginTop: 8 }}>
          <span>{tx('Publié le', 'Published')} {published}</span>
        </div>
      </div>
    </div>
  );
}

export function PageTitle(props: {
  title: string;
  subtitle?: string;
  titleClassName?: string;
  titleStyle?: React.CSSProperties;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <h1 className={`h1${props.titleClassName ? ` ${props.titleClassName}` : ''}`} style={props.titleStyle}>
        {props.title}
      </h1>
      {props.subtitle ? <div className="small">{props.subtitle}</div> : null}
    </div>
  );
}

export function SearchHero(props?: {
  value?: string;
  placeholder?: string;
  onChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
}) {
  const nav = useNavigate();
  const [localValue, setLocalValue] = React.useState(props?.value ?? '');

  React.useEffect(() => {
    if (props?.value !== undefined) setLocalValue(props.value);
  }, [props?.value]);

  const value = props?.value ?? localValue;
  const setValue = props?.onChange ?? setLocalValue;

  const submit = () => {
    const q = value.trim();
    if (props?.onSubmit) return props.onSubmit(q);
    nav(q ? `/search?q=${encodeURIComponent(q)}` : '/search');
  };

  return (
    <SearchBar
      value={value}
      placeholder={props?.placeholder}
      onChange={setValue}
      onSubmit={submit}
    />
  );
}
