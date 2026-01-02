import React from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useNavigate, useParams } from 'react-router-dom';
import { Badge, Card } from '@repo/ui';
import { PageTitle } from './_common';
import { apiFetch, API_BASE, getToken } from '../../lib/api';
import { notifyError } from '../../lib/toast';
import { useSeo } from '../../lib/seo';
import { formatStatus } from '../../lib/status';
import { useI18n } from '../../lib/i18n';

type AdMedia = { id: string; type?: string; url: string; mime?: string; size?: number };
type Ad = {
  id: string;
  userId: string;
  status: string;
  title: string;
  description: string;
  city: string;
  country: string;
  categorySlug: string;
  badges: string[];
  dynamic?: any;
  createdAt: string;
  updatedAt?: string;
  views?: number;
  media?: AdMedia[];
  activeBoosts?: { id: string; type: string; startAt: string; endAt: string }[];
};

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;
const CAMEROON_CENTER = { lat: 5.96, lng: 12.36 };
const CAMEROON_BOUNDS: [[number, number], [number, number]] = [[8.4, 1.6], [16.2, 13.1]];

function toNumber(value: any) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const num = Number(trimmed);
    if (Number.isFinite(num)) return num;
  }
  return null;
}

function normalizeKeyTokens(input: string) {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

function normalizeKeyValue(input: string) {
  return normalizeKeyTokens(input).join('');
}

const HIDDEN_DETAIL_KEYS = new Set([
  'ncall',
  'incall',
  'photos',
  'photo',
  'photourl',
  'adtype',
  'coverurl',
  'cover',
  'location',
  'localisation',
  'coords',
  'phone',
  'tel',
  'telephone',
  'lookingfor',
  'displayname',
  'availablenow',
  'title',
  'description',
]);

function isHiddenDetailKey(key: string) {
  const normalized = normalizeKeyValue(key);
  if (HIDDEN_DETAIL_KEYS.has(normalized)) return true;
  if (normalized.startsWith('photo')) return true;
  if (normalized.startsWith('cover')) return true;
  if (normalized.startsWith('location')) return true;
  return false;
}

function isDescriptionKey(key: string) {
  const tokens = normalizeKeyTokens(key);
  return tokens.includes('description') || tokens.includes('desc') || tokens.includes('bio') || tokens.includes('texte');
}

function isAgeKey(key: string) {
  const tokens = normalizeKeyTokens(key);
  return tokens.includes('age');
}

function formatDetailValue(value: any) {
  if (Array.isArray(value)) return value.join(', ');
  if (value && typeof value === 'object') return JSON.stringify(value);
  return String(value ?? '');
}

function hasMeaningfulText(value: string) {
  const plain = value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > 0;
}

function isNonEmptyValue(value: any) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return hasMeaningfulText(value);
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

function getTokenSubject(token: string | null) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const payload = JSON.parse(atob(parts[1]));
    return payload?.sub || payload?.userId || payload?.id || null;
  } catch {
    return null;
  }
}

function extractLocation(dynamic: any): { lat: number; lng: number } | null {
  if (!dynamic || typeof dynamic !== 'object') return null;
  const directLat = toNumber(
    dynamic.lat ?? dynamic.latitude ?? dynamic.gps_lat ?? dynamic.coord_lat ?? dynamic.location_lat ?? dynamic.map_lat ?? dynamic.geo_lat
  );
  const directLng = toNumber(
    dynamic.lng ?? dynamic.lon ?? dynamic.longitude ?? dynamic.gps_lng ?? dynamic.coord_lng ?? dynamic.location_lng ?? dynamic.map_lng ?? dynamic.geo_lng
  );
  const nested = dynamic.location ?? dynamic.localisation ?? dynamic.coords ?? dynamic.coord ?? dynamic.gps;
  const nestedLat = toNumber(nested?.lat ?? nested?.latitude);
  const nestedLng = toNumber(nested?.lng ?? nested?.lon ?? nested?.longitude);
  const lat = directLat ?? nestedLat;
  const lng = directLng ?? nestedLng;
  if (typeof lat === 'number' && typeof lng === 'number') return { lat, lng };
  return null;
}

function AdLocationMap({ value, emptyLabel }: { value: { lat: number; lng: number }; emptyLabel: string }) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<mapboxgl.Map | null>(null);
  const markerRef = React.useRef<mapboxgl.Marker | null>(null);

  React.useEffect(() => {
    if (!MAPBOX_TOKEN || !containerRef.current || mapRef.current) return;
    mapboxgl.accessToken = MAPBOX_TOKEN;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [value.lng, value.lat],
      zoom: 12.5,
      maxBounds: CAMEROON_BOUNDS,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  React.useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    if (!markerRef.current) {
      markerRef.current = new mapboxgl.Marker({ color: '#111827' })
        .setLngLat([value.lng, value.lat])
        .addTo(map);
    } else {
      markerRef.current.setLngLat([value.lng, value.lat]);
    }
    map.easeTo({ center: [value.lng, value.lat], duration: 400 });
  }, [value.lat, value.lng]);

  if (!MAPBOX_TOKEN) {
    return (
      <div className="panel pad">
        <div className="small">{emptyLabel}</div>
      </div>
    );
  }

  return <div ref={containerRef} style={{ height: 240, borderRadius: 16, overflow: 'hidden' }} />;
}

export function AdDetail() {
  const { lang, tx } = useI18n();
  const { id } = useParams();
  const nav = useNavigate();
  const [ad, setAd] = React.useState<Ad | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<any>(null);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [similar, setSimilar] = React.useState<Ad[]>([]);
  const [contactError, setContactError] = React.useState<string | null>(null);
  const [contactLoading, setContactLoading] = React.useState(false);
  const [geoPoint, setGeoPoint] = React.useState<{ lat: number; lng: number } | null>(null);
  const [geoLoading, setGeoLoading] = React.useState(false);

  const dynamic = React.useMemo(() => {
    return ad && ad.dynamic && typeof ad.dynamic === 'object' ? ad.dynamic : {};
  }, [ad]);
  const resolvedLocation = React.useMemo(() => extractLocation(dynamic), [dynamic]);

  const phone = dynamic.phone || dynamic.tel || dynamic.contactPhone || dynamic.phoneNumber || '';
  const whatsapp = dynamic.whatsapp || dynamic.contactWhatsApp || phone;
  const phoneDigits = String(phone || '').replace(/[^\d]/g, '');
  const whatsappDigits = String(whatsapp || '').replace(/[^\d]/g, '');

  React.useEffect(() => {
    let alive = true;
    if (!id) return undefined;
    setLoading(true);
    setError(null);
    fetch(`${API_BASE}/ads/${id}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('NOT_FOUND');
        return res.json();
      })
      .then((data) => {
        if (!alive) return;
        setAd(data as Ad);
        setActiveIndex(0);
        setLoading(false);
      })
      .catch((err) => {
        if (!alive) return;
        setError(err);
        notifyError(err, tx('Annonce introuvable.', 'Listing not found.'));
        setLoading(false);
      });
    return () => { alive = false; };
  }, [id]);

  React.useEffect(() => {
    let alive = true;
    if (!ad?.categorySlug) {
      setSimilar([]);
      return undefined;
    }
    fetch(`${API_BASE}/ads?categorySlug=${encodeURIComponent(ad.categorySlug)}&limit=8`)
      .then(async (res) => {
        if (!res.ok) throw new Error('FAILED');
        return res.json();
      })
      .then((data) => {
        if (!alive) return;
        const items = (data.items || []).filter((item: Ad) => item.id !== ad.id).slice(0, 6);
        setSimilar(items);
      })
      .catch(() => {
        if (!alive) return;
        setSimilar([]);
      });
    return () => { alive = false; };
  }, [ad?.categorySlug, ad?.id]);

  React.useEffect(() => {
    if (resolvedLocation) {
      setGeoPoint(resolvedLocation);
      setGeoLoading(false);
      return;
    }
    if (!ad?.city || !MAPBOX_TOKEN) {
      setGeoPoint(null);
      setGeoLoading(false);
      return;
    }
    let active = true;
    const controller = new AbortController();
    setGeoLoading(true);
    const query = `${ad.city}${ad.country ? `, ${ad.country}` : ''}`;
    const params = new URLSearchParams({
      access_token: MAPBOX_TOKEN,
      country: 'cm',
      types: 'place,locality',
      language: lang === 'fr' ? 'fr' : 'en',
      limit: '1',
      autocomplete: 'false',
      bbox: `${CAMEROON_BOUNDS[0][0]},${CAMEROON_BOUNDS[0][1]},${CAMEROON_BOUNDS[1][0]},${CAMEROON_BOUNDS[1][1]}`,
    });
    fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?${params}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('MAPBOX_ERROR');
        return res.json();
      })
      .then((data) => {
        if (!active) return;
        const feature = (data.features || [])[0];
        const center = Array.isArray(feature?.center) ? feature.center : [];
        const lng = typeof center[0] === 'number' ? center[0] : null;
        const lat = typeof center[1] === 'number' ? center[1] : null;
        if (typeof lat === 'number' && typeof lng === 'number') {
          setGeoPoint({ lat, lng });
        } else {
          setGeoPoint(null);
        }
      })
      .catch(() => {
        if (!active) return;
        setGeoPoint(null);
      })
      .finally(() => {
        if (active) setGeoLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [resolvedLocation, ad?.city, ad?.country]);

  const seoTitle = ad?.title || (id ? `${tx('Annonce', 'Listing')} ${id}` : tx('Annonce', 'Listing'));
  const seoDesc = ad?.description
    ? String(ad.description).slice(0, 140)
    : tx('Détails d’une annonce : galerie, infos, badges, contact WhatsApp/Appel.', 'Listing details: gallery, info, badges, WhatsApp/Call contact.');
  useSeo({
    title: seoTitle,
    description: seoDesc,
    canonicalPath: id ? `/ad/${id}` : '/ad',
  });

  const mediaItems = ad?.media || [];
  const activeMedia = mediaItems[activeIndex] || mediaItems[0] || null;

  const dynamicEntries = Object.entries(dynamic || {}).filter(([, value]) => isNonEmptyValue(value));
  const ageEntry = React.useMemo(
    () => dynamicEntries.find(([key]) => isAgeKey(key)),
    [dynamicEntries]
  );
  const detailEntries = React.useMemo(
    () => dynamicEntries.filter(([key]) => !isDescriptionKey(key) && !isAgeKey(key) && !isHiddenDetailKey(key)),
    [dynamicEntries]
  );

  const startChat = async () => {
    if (!id) return;
    const token = getToken();
    if (!token) {
      window.location.href = `/auth/login?next=${encodeURIComponent(`/ad/${id}`)}`;
      return;
    }
    const subject = getTokenSubject(token);
    if (subject && ad?.userId && subject === ad.userId) {
      const message = tx('Vous ne pouvez pas vous contacter vous-même.', 'You cannot contact yourself.');
      setContactError(message);
      notifyError(message);
      return;
    }
    setContactLoading(true);
    setContactError(null);
    try {
      const res = await apiFetch<{ conversation?: { id: string } }>('/conversations/start', {
        method: 'POST',
        body: JSON.stringify({ adId: id }),
      });
      const convId = res.conversation?.id;
      if (convId) nav(`/dashboard/messages/thread/${convId}`);
    } catch (err: any) {
      const raw = String(err?.error || err?.message || err);
      const message = raw === 'INVALID_INPUT'
        ? tx('Impossible de démarrer la conversation.', 'Unable to start the conversation.')
        : raw;
      setContactError(message);
      notifyError(message);
    } finally {
      setContactLoading(false);
    }
  };

  return (
    <>
      <PageTitle
        title={ad?.title || `${tx('Annonce', 'Listing')} ${id || ''}`}
        subtitle={tx('Détails + galerie + contact (WhatsApp/Appel).', 'Details + gallery + contact (WhatsApp/Call).')}
      />
      {loading ? <div className="small">{tx('Chargement…', 'Loading…')}</div> : null}
      {error ? <div className="small" style={{ color: 'var(--red)' }}>{tx('Annonce introuvable.', 'Listing not found.')}</div> : null}
      <div className="grid layout-1-3">
        <div className="panel pad">
          <div className="kicker">{tx('Galerie', 'Gallery')}</div>
          <div style={{ height: 10 }} />
          <div className="card">
            <div className="thumb" style={{ height: 220 }}>
              {activeMedia ? (
                activeMedia.type === 'VIDEO' ? (
                  <video
                    src={activeMedia.url.startsWith('http') ? activeMedia.url : `${API_BASE}${activeMedia.url}`}
                    controls
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <img
                    src={activeMedia.url.startsWith('http') ? activeMedia.url : `${API_BASE}${activeMedia.url}`}
                    alt={ad?.title || tx('Annonce', 'Listing')}
                    className="thumbImg"
                  />
                )
              ) : (
                <div className="thumbPlaceholder" />
              )}
            </div>
            <div className="body">
              <div className="row" style={{ flexWrap: 'wrap' }}>
                {mediaItems.length === 0 ? (
                  <div className="small">{tx('Aucune image.', 'No images.')}</div>
                ) : (
                  mediaItems.map((m, idx) => (
                    <button
                      key={m.id}
                      type="button"
                      className="card"
                      style={{ width: 84, padding: 0, border: idx === activeIndex ? '2px solid var(--accent)' : undefined }}
                      onClick={() => setActiveIndex(idx)}
                    >
                      <div className="thumb" style={{ height: 64 }}>
                        {m.type === 'VIDEO' ? (
                          <div className="thumbPlaceholder" />
                        ) : (
                          <img
                            src={m.url.startsWith('http') ? m.url : `${API_BASE}${m.url}`}
                            alt=""
                            className="thumbImg"
                          />
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="divider" />

          <div className="h2">{tx('Description', 'Description')}</div>
          {ad?.description ? (
            <div
              className="panel pad"
              style={{ padding: 12, background: 'var(--panel2)' }}
              dangerouslySetInnerHTML={{ __html: ad.description }}
            />
          ) : (
            <p className="small">{tx('Aucune description.', 'No description.')}</p>
          )}

          {dynamicEntries.length ? (
            <>
              <div className="divider" />
              <div className="h2">{tx('Détails', 'Details')}</div>
              <div style={{ height: 8 }} />
              <div className="panel pad" style={{ padding: 12, display: 'grid', gap: 10 }}>
                {ageEntry ? (
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <span className="small">{ageEntry[0]}</span>
                    <span className="badge warn" style={{ fontWeight: 900 }}>
                      {(() => {
                        const raw = formatDetailValue(ageEntry[1]);
                        const digits = raw.replace(/[^\d]/g, '');
                        if (digits) return `${digits} ${tx('ans', 'yrs')}`;
                        return raw || tx('—', '—');
                      })()}
                    </span>
                  </div>
                ) : null}
                {detailEntries.map(([key, value]) => (
                  <div key={key} className="row" style={{ justifyContent: 'space-between' }}>
                    <span className="small">{key}</span>
                    <span style={{ fontWeight: 700 }}>
                      {formatDetailValue(value)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : null}

          <div className="divider" />
          <div className="h2">{tx('Localisation', 'Location')}</div>
          <div className="small">
            {ad?.city ? `${ad.city}${ad?.country ? `, ${ad.country}` : ''}` : tx('Localisation non renseignée.', 'Location not provided.')}
          </div>
          <div style={{ height: 8 }} />
          {geoLoading ? (
            <div className="panel pad">{tx('Chargement de la carte…', 'Loading map…')}</div>
          ) : geoPoint ? (
            <AdLocationMap value={geoPoint} emptyLabel={tx('Ajoutez `VITE_MAPBOX_TOKEN` dans `apps/web/.env`.', 'Add `VITE_MAPBOX_TOKEN` in `apps/web/.env`.')} />
          ) : (
            <div className="panel pad">{tx('Localisation indisponible.', 'Location unavailable.')}</div>
          )}

          <div className="divider" />

          <div className="section-title">
            <div className="h2">{tx('Annonces similaires', 'Similar listings')}</div>
            <a className="btn" href="/search">{tx('Voir plus', 'View more')}</a>
          </div>
          <div style={{ height: 12 }} />
          <div className="scrollrow">
            {similar.length === 0 ? (
              <div className="small">{tx('Aucune annonce similaire.', 'No similar listings.')}</div>
            ) : (
              similar.map((item) => (
                <div key={item.id} style={{ minWidth: 240 }}>
                  <Card
                    title={item.title}
                    city={item.city}
                    imageUrl={item.media?.[0]?.url ? (item.media[0].url.startsWith('http') ? item.media[0].url : `${API_BASE}${item.media[0].url}`) : undefined}
                    badge={Array.isArray(item.badges) && item.badges.length ? (
                      ['vip', 'urgent', 'top', 'premium'].includes(String(item.badges[0]).toLowerCase())
                        ? <Badge kind={String(item.badges[0]).toLowerCase() as any}>{String(item.badges[0]).toUpperCase()}</Badge>
                        : <span className="badge">{String(item.badges[0]).toUpperCase()}</span>
                    ) : undefined}
                    onClick={() => nav(`/ad/${item.id}`)}
                  />
                </div>
              ))
            )}
          </div>
        </div>

        <div className="panel pad">
          <div className="kicker">{tx('Contact', 'Contact')}</div>
          <div style={{ height: 10 }} />
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <button className="btn primary" type="button" onClick={startChat} disabled={contactLoading}>
              {contactLoading ? tx('Ouverture...', 'Opening...') : tx('Envoyer un message', 'Send a message')}
            </button>
            <a className="btn" href={whatsappDigits ? `https://wa.me/${whatsappDigits}` : undefined} target="_blank" rel="noreferrer" aria-disabled={!whatsappDigits}>
              WhatsApp
            </a>
            <a className="btn" href={phoneDigits ? `tel:${phoneDigits}` : undefined} aria-disabled={!phoneDigits}>
              {tx('Appeler', 'Call')}
            </a>
          </div>
          {contactError ? <div className="small" style={{ color: 'var(--red)', marginTop: 8 }}>{contactError}</div> : null}
          <div style={{ height: 12 }} />
          <a className="btn" href="/report">{tx('Signaler', 'Report')}</a>

          <div className="divider" />

          <div className="h2">{tx('Infos', 'Info')}</div>
          <div style={{ height: 8 }} />
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="small">{tx('Ville', 'City')}</span><b>{ad?.city || '-'}</b>
          </div>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="small">{tx('Badges', 'Badges')}</span>
            <span>
              {(ad?.badges || []).length === 0 ? (
                <span className="badge">{tx('—', '—')}</span>
              ) : (
                ad?.badges?.map((b) => (
                  ['vip', 'urgent', 'top', 'premium'].includes(String(b).toLowerCase())
                    ? <Badge key={b} kind={String(b).toLowerCase() as any}>{String(b).toUpperCase()}</Badge>
                    : <span key={b} className="badge">{String(b).toUpperCase()}</span>
                ))
              )}
            </span>
          </div>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="small">{tx('Publié', 'Published')}</span><b>{ad?.createdAt ? new Date(ad.createdAt).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB') : '-'}</b>
          </div>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="small">{tx('Vues', 'Views')}</span><b>{ad?.views ?? tx('—', '—')}</b>
          </div>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="small">{tx('Catégorie', 'Category')}</span><b>{ad?.categorySlug || '-'}</b>
          </div>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="small">{tx('Statut', 'Status')}</span><b>{formatStatus(ad?.status, tx)}</b>
          </div>
        </div>
      </div>
    </>
  );
}
