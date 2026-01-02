import React from 'react';
import { useNavigate } from 'react-router-dom';
import { IconChat, IconPlus, IconStar } from '../../components/Icons';
import { ListingCard, PageTitle, SearchHero } from './_common';
import { apiFetch } from '../../lib/api';
import { useI18n } from '../../lib/i18n';

type HomeAd = {
  id: string;
  title: string;
  city: string;
  country: string;
  createdAt?: string;
  badges?: string[];
  media?: { url: string }[];
  dynamic?: any;
};

const HIGHLIGHT_BADGES = new Set(['HOME', 'TOP', 'VIP', 'URGENT', 'PREMIUM']);
export function Home() {
  const { tx } = useI18n();
  const nav = useNavigate();
  const [items, setItems] = React.useState<HomeAd[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    apiFetch<{ items: HomeAd[] }>('/ads?limit=60&status=PUBLISHED')
      .then((res) => {
        if (!mounted) return;
        setItems(res.items || []);
      })
      .catch(() => {
        if (!mounted) return;
        setError(tx('Impossible de charger la sélection.', 'Unable to load the selection.'));
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [tx]);

  const highlights = React.useMemo(() => {
    const featured = items.filter((ad) => (ad.badges || []).some((b) => HIGHLIGHT_BADGES.has(String(b).toUpperCase())));
    return (featured.length ? featured : items).slice(0, 8);
  }, [items]);

  const highlightIds = React.useMemo(() => new Set(highlights.map((ad) => ad.id)), [highlights]);

  const featuredAds = React.useMemo(() => {
    const rest = items.filter((ad) => !highlightIds.has(ad.id));
    const list = rest.length ? rest : items;
    return list.slice(0, 8);
  }, [items, highlightIds]);

  const trendingCities = React.useMemo(() => {
    const counts = new Map<string, number>();
    items.forEach((ad) => {
      const city = String(ad.city || '').trim();
      if (!city) return;
      counts.set(city, (counts.get(city) || 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [items]);

  return (
    <>
      {/* Hero (airy + bold typography) */}
      <div className="panel pad" style={{ padding: 18 }}>
        <div className="kicker">{tx('Plateforme 18+', '18+ platform')}</div>
        <div style={{ height: 8 }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr .8fr', gap: 16, alignItems: 'center' }}>
          <div>
            <PageTitle
              title={tx('Trouvez & publiez près de chez vous', 'Find & publish near you')}
              subtitle={tx('Plateforme 18+. Recherchez par ville, catégorie et options VIP — et publiez en quelques minutes.', '18+ platform. Search by city, category, and VIP options — publish in minutes.')}
              titleClassName="heroTitle"
            />
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <a className="btn primary" href="/search">{tx('Voir les annonces', 'View listings')}</a>
              <a className="btn" href="/dashboard/ads/create">{tx('Déposer une annonce', 'Post an ad')}</a>
              <a className="btn ghost" href="/become-pro">{tx('Devenir PRO', 'Go PRO')}</a>
            </div>
          </div>
          <div>
            <SearchHero />
          </div>
        </div>
      </div>

      <div style={{ height: 18 }} />

      {/* How it works */}
      <div className="panel pad">
        <div className="h2">{tx('Comment ça marche', 'How it works')}</div>
        <div style={{ height: 10 }} />
        <div className="grid cols-3">
          <div className="card" style={{ padding: 14 }}>
            <div className="row" style={{ alignItems: 'center' }}>
              <span className="iconBubble teal"><IconPlus /></span>
              <div>
                <div className="badge top">{tx('ÉTAPE 1', 'STEP 1')}</div>
                <div style={{ height: 6 }} />
                <div style={{ fontWeight: 900 }}>{tx('Créez votre annonce', 'Create your ad')}</div>
              </div>
            </div>
            <div style={{ height: 8 }} />
            <div className="small">{tx('Choisissez une catégorie, ajoutez description et médias.', 'Choose a category, add description and media.')}</div>
          </div>
          <div className="card" style={{ padding: 14 }}>
            <div className="row" style={{ alignItems: 'center' }}>
              <span className="iconBubble sun"><IconStar /></span>
              <div>
                <div className="badge vip">{tx('ÉTAPE 2', 'STEP 2')}</div>
                <div style={{ height: 6 }} />
                <div style={{ fontWeight: 900 }}>{tx('Boostez la visibilité', 'Boost visibility')}</div>
              </div>
            </div>
            <div style={{ height: 8 }} />
            <div className="small">{tx('VIP / Urgent / Top — augmentez vos contacts.', 'VIP / Urgent / Top — get more contacts.')}</div>
          </div>
          <div className="card" style={{ padding: 14 }}>
            <div className="row" style={{ alignItems: 'center' }}>
              <span className="iconBubble indigo"><IconChat /></span>
              <div>
                <div className="badge premium">{tx('ÉTAPE 3', 'STEP 3')}</div>
                <div style={{ height: 6 }} />
                <div style={{ fontWeight: 900 }}>{tx('Recevez des demandes', 'Get requests')}</div>
              </div>
            </div>
            <div style={{ height: 8 }} />
            <div className="small">{tx('WhatsApp / appel — gérez vos annonces depuis le dashboard.', 'WhatsApp / call — manage your ads from the dashboard.')}</div>
          </div>
        </div>
      </div>

      <div style={{ height: 18 }} />

      {/* Stats */}
      <div className="panel pad" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 12 }}>
        <div>
          <div className="small">{tx('Annonces actives', 'Active listings')}</div>
          <div className="h2">+2 000</div>
        </div>
        <div>
          <div className="small">{tx('Villes couvertes', 'Cities covered')}</div>
          <div className="h2">120+</div>
        </div>
        <div>
          <div className="small">{tx('Annonces VIP', 'VIP listings')}</div>
          <div className="h2">{tx('Chaque jour', 'Every day')}</div>
        </div>
      </div>

      <div style={{ height: 18 }} />

      {/* À la une */}
      <div className="panel pad">
        <div className="section-title">
          <div className="h2">{tx('À la une', 'Top picks')}</div>
          <a className="btn" href="/search">{tx('Explorer', 'Explore')}</a>
        </div>
        <div style={{ height: 10 }} />
        {loading ? <div className="small">{tx('Chargement…', 'Loading…')}</div> : null}
        {error ? <div className="small" style={{ color: 'var(--red)' }}>{error}</div> : null}
        {!loading && !highlights.length ? <div className="small">{tx('Aucune annonce en vedette.', 'No featured listings.')}</div> : null}
        {highlights.length ? (
          <div className="scrollrow">
            {highlights.map((ad) => (
              <div key={ad.id} style={{ minWidth: 260 }}>
                <ListingCard ad={ad} onClick={() => nav(`/ad/${ad.id}`)} />
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div style={{ height: 18 }} />

      {/* Villes tendances */}
      <div className="panel pad">
        <div className="section-title">
          <div className="h2">{tx('Villes tendances', 'Trending cities')}</div>
          <a className="btn" href="/cities/cm">{tx('Voir toutes', 'View all')}</a>
        </div>
        <div style={{ height: 10 }} />
        {loading ? <div className="small">{tx('Chargement…', 'Loading…')}</div> : null}
        {!loading && !trendingCities.length ? <div className="small">{tx('Aucune donnée.', 'No data yet.')}</div> : null}
        {trendingCities.length ? (
          <div className="grid cols-4">
            {trendingCities.map(([city, count]) => (
              <a key={city} href={`/search?city=${encodeURIComponent(city)}`} className="card" style={{ padding: 14 }}>
                <div className="kicker">{tx('Ville', 'City')}</div>
                <div style={{ fontWeight: 950 }}>{city}</div>
                <div className="small">{count} {tx('annonces actives', 'active listings')}</div>
              </a>
            ))}
          </div>
        ) : null}
      </div>

      <div style={{ height: 18 }} />

      {/* En vedette */}
      <div className="section-title">
        <div className="h2">{tx('En vedette', 'Featured')}</div>
        <a className="btn" href="/categories">{tx('Voir les catégories', 'View categories')}</a>
      </div>
      <div style={{ height: 12 }} />
      {loading ? <div className="small">{tx('Chargement…', 'Loading…')}</div> : null}
      {!loading && !featuredAds.length ? <div className="small">{tx('Aucune annonce disponible.', 'No listings available.')}</div> : null}
      {featuredAds.length ? (
        <div className="grid cols-4">
          {featuredAds.map((ad) => (
            <ListingCard key={ad.id} ad={ad} onClick={() => nav(`/ad/${ad.id}`)} />
          ))}
        </div>
      ) : null}
    </>
  );
}
