import React, { useEffect, useMemo, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useInfiniteQuery } from '@tanstack/react-query';
import { ListingCard, PageTitle } from './_common';
import { Checkbox, Select } from '@repo/ui';
import { apiFetch } from '../../lib/api';
import { useSeo } from '../../lib/seo';
import { useI18n } from '../../lib/i18n';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001') as string;
const ALL_CITIES = ['Douala', 'Yaoundé', 'Bafoussam', 'Bertoua', 'Paris', 'Lyon', 'Marseille', 'Garoua', 'Ngaoundéré'];

type CategoryTree = { id: string; name: string; slug: string; children?: CategoryTree[] };

async function fetchAds({
  pageParam,
  q,
  city,
  country,
  categorySlug,
  badges,
  minPrice,
  maxPrice,
  tags,
  sort,
  lat,
  lng,
  radiusKm,
}: {
  pageParam?: string | null;
  q?: string | null;
  city?: string | null;
  country?: string | null;
  categorySlug?: string | null;
  badges?: string[] | null;
  minPrice?: string | null;
  maxPrice?: string | null;
  tags?: string[] | null;
  sort?: string | null;
  lat?: string | null;
  lng?: string | null;
  radiusKm?: string | null;
}) {
  const u = new URL(`${API_URL}/ads`);
  u.searchParams.set('limit', '20');
  u.searchParams.set('status', 'PUBLISHED');
  if (pageParam) u.searchParams.set('cursor', pageParam);
  if (q) u.searchParams.set('q', q);
  if (city) u.searchParams.set('city', city);
  if (country) u.searchParams.set('country', country);
  if (categorySlug) u.searchParams.set('categorySlug', categorySlug);
  if (badges && badges.length) u.searchParams.set('badges', badges.join(','));
  if (minPrice) u.searchParams.set('minPrice', minPrice);
  if (maxPrice) u.searchParams.set('maxPrice', maxPrice);
  if (tags && tags.length) u.searchParams.set('tags', tags.join(','));
  if (sort) u.searchParams.set('sort', sort);
  if (lat) u.searchParams.set('lat', lat);
  if (lng) u.searchParams.set('lng', lng);
  if (radiusKm) u.searchParams.set('radiusKm', radiusKm);
  const r = await fetch(u.toString());
  if (!r.ok) throw new Error('FETCH_FAILED');
  return (await r.json()) as { items: any[]; nextCursor: string | null; totalCount?: number };
}

export function Search() {
  const { lang, tx } = useI18n();
  const [sp, setSp] = useSearchParams();
  const nav = useNavigate();
  const qStr = sp.get('q');
  const city = sp.get('city');
  const country = sp.get('country');
  const categorySlug = sp.get('category');
  const badgesParam = sp.get('badges');
  const minPriceParam = sp.get('minPrice');
  const maxPriceParam = sp.get('maxPrice');
  const tagsParam = sp.get('tags');
  const sortParam = sp.get('sort');
  const latParam = sp.get('lat');
  const lngParam = sp.get('lng');
  const radiusParam = sp.get('radiusKm');
  const [queryInput, setQueryInput] = React.useState(qStr ?? '');
  const [selectedCategory, setSelectedCategory] = React.useState(categorySlug ?? '');
  const [selectedCity, setSelectedCity] = React.useState(city ?? '');
  const [selectedBadges, setSelectedBadges] = React.useState<string[]>([]);
  const [minPrice, setMinPrice] = React.useState(minPriceParam ?? '');
  const [maxPrice, setMaxPrice] = React.useState(maxPriceParam ?? '');
  const [tagsInput, setTagsInput] = React.useState(tagsParam ?? '');
  const [sortMode, setSortMode] = React.useState(sortParam ?? 'premium');
  const [radiusKm, setRadiusKm] = React.useState(radiusParam ?? '');
  const [geoLat, setGeoLat] = React.useState(latParam ?? '');
  const [geoLng, setGeoLng] = React.useState(lngParam ?? '');
  const [categories, setCategories] = React.useState<CategoryTree[]>([]);
  const [suggestions, setSuggestions] = React.useState<{ categories: { slug: string; name: string }[]; cities: string[]; tags: string[] } | null>(null);
  const [suggestOpen, setSuggestOpen] = React.useState(false);
  const [topCities, setTopCities] = React.useState<{ city: string; count: number }[]>([]);
  const [themes, setThemes] = React.useState<{ slug: string; label: string; count: number }[]>([]);
  const [recoAds, setRecoAds] = React.useState<any[]>([]);
  const [historySeed, setHistorySeed] = React.useState<{ category?: string; city?: string; tags?: string } | null>(null);
  const [recentSearches, setRecentSearches] = React.useState<string[]>([]);

  const badgesFromParams = useMemo(() => {
    if (!badgesParam) return [];
    const items = badgesParam
      .split(',')
      .map((b) => b.trim())
      .filter(Boolean)
      .map((b) => b.toUpperCase());
    return Array.from(new Set(items));
  }, [badgesParam]);

  React.useEffect(() => {
    setQueryInput(qStr ?? '');
    setSelectedCategory(categorySlug ?? '');
    setSelectedCity(city ?? '');
    setSelectedBadges(badgesFromParams);
    setMinPrice(minPriceParam ?? '');
    setMaxPrice(maxPriceParam ?? '');
    setTagsInput(tagsParam ?? '');
    setSortMode(sortParam ?? 'premium');
    setRadiusKm(radiusParam ?? '');
    setGeoLat(latParam ?? '');
    setGeoLng(lngParam ?? '');
  }, [qStr, categorySlug, city, badgesFromParams, minPriceParam, maxPriceParam, tagsParam, sortParam, radiusParam, latParam, lngParam]);

  React.useEffect(() => {
    apiFetch<{ items: CategoryTree[] }>('/categories/tree')
      .then((res) => setCategories(res.items || []))
      .catch(() => setCategories([]));
  }, []);

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem('lodix_search_seed');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          setHistorySeed({
            category: parsed.category || undefined,
            city: parsed.city || undefined,
            tags: parsed.tags || undefined,
          });
        }
      }
    } catch {
      setHistorySeed(null);
    }
  }, []);

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem('lodix_recent_searches');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setRecentSearches(parsed.filter((item) => typeof item === 'string'));
      }
    } catch {
      setRecentSearches([]);
    }
  }, []);

  React.useEffect(() => {
    const term = queryInput.trim();
    if (!term) {
      setSuggestions(null);
      setSuggestOpen(false);
      return;
    }
    const handle = window.setTimeout(() => {
      const qs = new URLSearchParams();
      qs.set('term', term);
      qs.set('limit', '6');
      if (country) qs.set('country', country);
      apiFetch<{ categories: { slug: string; name: string }[]; cities: string[]; tags: string[] }>(`/search/suggest?${qs.toString()}`)
        .then((res) => {
          setSuggestions(res);
          setSuggestOpen(true);
        })
        .catch(() => setSuggestions(null));
    }, 250);
    return () => window.clearTimeout(handle);
  }, [queryInput, country]);

  React.useEffect(() => {
    const qs = new URLSearchParams();
    qs.set('limit', '8');
    if (country) qs.set('country', country);
    apiFetch<{ items: { city: string; count: number }[] }>(`/collections/top-cities?${qs.toString()}`)
      .then((res) => setTopCities(res.items || []))
      .catch(() => setTopCities([]));
    apiFetch<{ items: { slug: string; label: string; count: number }[] }>(`/collections/themes?${qs.toString()}`)
      .then((res) => setThemes(res.items || []))
      .catch(() => setThemes([]));
  }, [country]);

  React.useEffect(() => {
    const qs = new URLSearchParams();
    const seedCategory = selectedCategory || historySeed?.category;
    const seedCity = selectedCity || historySeed?.city;
    const seedTags = tagsParam || historySeed?.tags;
    if (seedCategory) qs.set('categorySlug', seedCategory);
    if (seedCity) qs.set('city', seedCity);
    if (seedTags) qs.set('tags', seedTags);
    if (country) qs.set('country', country);
    qs.set('limit', '8');
    apiFetch<{ items: any[] }>(`/ads/recommendations?${qs.toString()}`)
      .then((res) => setRecoAds(res.items || []))
      .catch(() => setRecoAds([]));
  }, [selectedCategory, selectedCity, tagsParam, country, historySeed]);

  const title = useMemo(() => {
    const bits = [tx('Recherche', 'Search')];
    if (qStr) bits.push(`“${qStr}”`);
    if (city) bits.push(city);
    return bits.join(' · ');
  }, [qStr, city, tx]);

  useSeo({
    title,
    description: tx(
      'Recherche d’annonces par ville, catégorie et mots-clés. Scroll infini + cache.',
      'Search listings by city, category, and keywords. Infinite scroll + cache.'
    ),
    canonicalPath: `/search${window.location.search}`,
  });

  const q = useInfiniteQuery({
    queryKey: ['ads', 'search', qStr, city, country, categorySlug, badgesParam, minPriceParam, maxPriceParam, tagsParam, sortParam, latParam, lngParam, radiusParam],
    queryFn: ({ pageParam }) => fetchAds({
      pageParam: pageParam as string | null | undefined,
      q: qStr,
      city,
      country,
      categorySlug,
      badges: badgesFromParams,
      minPrice: minPriceParam,
      maxPrice: maxPriceParam,
      tags: tagsParam ? tagsParam.split(',').map((t) => t.trim()).filter(Boolean) : null,
      sort: sortParam,
      lat: latParam,
      lng: lngParam,
      radiusKm: radiusParam,
    }),
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  const totalCount = q.data?.pages?.[0]?.totalCount;
  const totalCountLabel = new Intl.NumberFormat(lang === 'fr' ? 'fr-FR' : 'en-GB').format(totalCount ?? items.length);
  const flatCategories = useMemo(() => {
    const out: { slug: string; label: string }[] = [];
    const walk = (node: CategoryTree, prefix = '') => {
      out.push({ slug: node.slug, label: `${prefix}${node.name}` });
      (node.children || []).forEach((child) => walk(child, `${prefix}— `));
    };
    categories.forEach((cat) => walk(cat));
    return out;
  }, [categories]);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const suggestionCategories = suggestions?.categories ?? [];
  const suggestionCities = suggestions?.cities ?? [];
  const suggestionTags = suggestions?.tags ?? [];

  // Infinite scroll
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first?.isIntersecting && q.hasNextPage && !q.isFetchingNextPage) {
          q.fetchNextPage();
        }
      },
      { rootMargin: '600px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [q.hasNextPage, q.isFetchingNextPage]);

  const applySearch = React.useCallback((nextValue?: string, nextBadges?: string[], overrides?: {
    category?: string;
    city?: string;
    tagsInput?: string;
    minPrice?: string;
    maxPrice?: string;
    sortMode?: string;
    geoLat?: string;
    geoLng?: string;
    radiusKm?: string;
  }) => {
    const next = new URLSearchParams(sp);
    const trimmed = (nextValue ?? queryInput).trim();
    const badges = Array.from(new Set((nextBadges ?? selectedBadges).map((b) => b.toUpperCase())));
    const nextCategory = overrides?.category ?? selectedCategory;
    const nextCity = overrides?.city ?? selectedCity;
    const nextTagsInput = overrides?.tagsInput ?? tagsInput;
    const nextMinPrice = overrides?.minPrice ?? minPrice;
    const nextMaxPrice = overrides?.maxPrice ?? maxPrice;
    const nextSortMode = overrides?.sortMode ?? sortMode;
    const nextGeoLat = overrides?.geoLat ?? geoLat;
    const nextGeoLng = overrides?.geoLng ?? geoLng;
    const nextRadius = overrides?.radiusKm ?? radiusKm;
    const tags = Array.from(
      new Set(
        (nextTagsInput || '')
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      )
    );
    if (trimmed) next.set('q', trimmed);
    else next.delete('q');
    if (nextCategory) next.set('category', nextCategory);
    else next.delete('category');
    if (nextCity) next.set('city', nextCity);
    else next.delete('city');
    if (badges.length) next.set('badges', badges.join(','));
    else next.delete('badges');
    if (nextMinPrice) next.set('minPrice', nextMinPrice);
    else next.delete('minPrice');
    if (nextMaxPrice) next.set('maxPrice', nextMaxPrice);
    else next.delete('maxPrice');
    if (tags.length) next.set('tags', tags.join(','));
    else next.delete('tags');
    if (nextSortMode) next.set('sort', nextSortMode);
    else next.delete('sort');
    if (nextGeoLat && nextGeoLng && nextRadius) {
      next.set('lat', nextGeoLat);
      next.set('lng', nextGeoLng);
      next.set('radiusKm', nextRadius);
    } else {
      next.delete('lat');
      next.delete('lng');
      next.delete('radiusKm');
    }
    try {
      window.localStorage.setItem('lodix_search_seed', JSON.stringify({ category: nextCategory, city: nextCity, tags: tags.join(',') }));
      if (trimmed) {
        const nextRecents = [trimmed, ...recentSearches]
          .filter((item, idx, arr) => arr.findIndex((v) => v.toLowerCase() === item.toLowerCase()) === idx)
          .slice(0, 6);
        setRecentSearches(nextRecents);
        window.localStorage.setItem('lodix_recent_searches', JSON.stringify(nextRecents));
      }
    } catch {
      // ignore storage errors
    }
    setSp(next);
  }, [sp, queryInput, selectedCategory, selectedCity, selectedBadges, minPrice, maxPrice, tagsInput, sortMode, geoLat, geoLng, radiusKm, setSp, recentSearches]);

  const toggleBadge = (value: string) => {
    const badge = value.toUpperCase();
    const next = selectedBadges.includes(badge)
      ? selectedBadges.filter((b) => b !== badge)
      : [...selectedBadges, badge];
    setSelectedBadges(next);
    applySearch(undefined, next);
  };

  const applySuggestion = (payload: { type: 'city' | 'category' | 'tag'; value: string; slug?: string }) => {
    if (payload.type === 'city') {
      setSelectedCity(payload.value);
      applySearch(undefined, undefined, { city: payload.value });
    } else if (payload.type === 'category') {
      const slug = payload.slug || payload.value;
      setSelectedCategory(slug);
      applySearch(undefined, undefined, { category: slug });
    } else if (payload.type === 'tag') {
      const nextTags = Array.from(new Set((tagsInput || '').split(',').map((t) => t.trim()).filter(Boolean).concat(payload.value))).join(', ');
      setTagsInput(nextTags);
      applySearch(undefined, undefined, { tagsInput: nextTags });
    }
    setSuggestOpen(false);
  };

  const requestGeo = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const nextLat = String(pos.coords.latitude);
        const nextLng = String(pos.coords.longitude);
        setGeoLat(nextLat);
        setGeoLng(nextLng);
        if (!radiusKm) setRadiusKm('10');
        applySearch(undefined, undefined, { geoLat: nextLat, geoLng: nextLng, radiusKm: radiusKm || '10' });
      },
      () => {},
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  return (
    <>
      <PageTitle title={tx('Recherche', 'Search')} subtitle={tx('Trouvez rapidement les annonces qui vous intéressent.', 'Find listings that match what you want.')} />
      <div className="panel pad searchPanel">
        <div className="searchPanelHeader">
          <div className="h2">
            {totalCountLabel} {tx('annonces rencontres Ndolo', 'Ndolo dating listings')} · {tx('Cameroun', 'Cameroon')}
          </div>
          <div className="small">{tx('Filtres rapides & recommandations personnalisées.', 'Quick filters & personalized recommendations.')}</div>
        </div>
        <form
          className="searchTopbar"
          onSubmit={(e) => {
            e.preventDefault();
            applySearch();
          }}
        >
          <div>
            <div className="small">{tx('Que cherchez-vous ?', 'What are you looking for?')}</div>
            <div className="searchInputWrap">
              <input
                className="input"
                placeholder={tx('Que cherchez-vous ?', 'What are you looking for?')}
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                onFocus={() => setSuggestOpen(true)}
                onBlur={() => window.setTimeout(() => setSuggestOpen(false), 150)}
              />
              {(suggestions || recentSearches.length) ? (
                <div
                  className={`searchSuggest ${suggestOpen ? 'open' : ''}`}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  {suggestionCategories.length ? (
                    <div>
                      <div className="kicker">{tx('Catégories', 'Categories')}</div>
                      <div className="suggestChips">
                        {suggestionCategories.map((c) => (
                          <button key={c.slug} type="button" className="btn ghost" onClick={() => applySuggestion({ type: 'category', value: c.name, slug: c.slug })}>
                            {c.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {suggestionCities.length ? (
                    <div style={{ marginTop: 8 }}>
                      <div className="kicker">{tx('Villes', 'Cities')}</div>
                      <div className="suggestChips">
                        {suggestionCities.map((c) => (
                          <button key={c} type="button" className="btn ghost" onClick={() => applySuggestion({ type: 'city', value: c })}>
                            {c}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {suggestionTags.length ? (
                    <div style={{ marginTop: 8 }}>
                      <div className="kicker">{tx('Tags', 'Tags')}</div>
                      <div className="suggestChips">
                        {suggestionTags.map((t) => (
                          <button key={t} type="button" className="btn ghost" onClick={() => applySuggestion({ type: 'tag', value: t })}>
                            #{t}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {recentSearches.length ? (
                    <div style={{ marginTop: 8 }}>
                      <div className="kicker">{tx('Recherches récentes', 'Recent searches')}</div>
                      <div className="suggestChips">
                        {recentSearches.map((term) => (
                          <button
                            key={term}
                            type="button"
                            className="btn ghost"
                            onClick={() => {
                              setQueryInput(term);
                              applySearch(term);
                              setSuggestOpen(false);
                            }}
                          >
                            {term}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
          <div>
            <div className="small">{tx('Catégories', 'Categories')}</div>
            <Select
              className="input"
              value={selectedCategory}
              onChange={setSelectedCategory}
              ariaLabel={tx('Catégories', 'Categories')}
              options={[
                { value: '', label: tx('Toutes les catégories', 'All categories') },
                ...flatCategories.map((c) => ({ value: c.slug, label: c.label }))
              ]}
            />
          </div>
          <div>
            <div className="small">{tx('Villes', 'Cities')}</div>
            <Select
              className="input"
              value={selectedCity}
              onChange={setSelectedCity}
              ariaLabel={tx('Villes', 'Cities')}
              options={[
                { value: '', label: tx('Toutes les villes', 'All cities') },
                ...ALL_CITIES.map((c) => ({ value: c, label: c }))
              ]}
            />
          </div>
          <div style={{ alignSelf: 'end' }}>
            <button className="btn primary" type="submit">{tx('Rechercher', 'Search')}</button>
          </div>
        </form>
        <div className="searchFiltersGrid">
          <div>
            <div className="small">{tx('Prix min', 'Min price')}</div>
            <input className="input" placeholder="0" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} />
          </div>
          <div>
            <div className="small">{tx('Prix max', 'Max price')}</div>
            <input className="input" placeholder="100000" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
          </div>
          <div>
            <div className="small">{tx('Tags', 'Tags')}</div>
            <input className="input" placeholder={tx('ex: massage, vip', 'e.g. massage, vip')} value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} />
          </div>
          <div>
            <div className="small">{tx('Tri', 'Sort')}</div>
            <Select
              className="input"
              value={sortMode}
              onChange={setSortMode}
              ariaLabel={tx('Tri', 'Sort')}
              options={[
                { value: 'premium', label: tx('Qualité premium', 'Premium quality') },
                { value: 'fresh', label: tx('Fraîcheur', 'Freshness') },
                { value: 'distance', label: tx('Distance', 'Distance') }
              ]}
            />
          </div>
        </div>
        <div className="searchFiltersRow">
          <div style={{ minWidth: 220 }}>
            <div className="small">{tx('Rayon (km)', 'Radius (km)')}</div>
            <Select
              className="input"
              value={radiusKm}
              onChange={setRadiusKm}
              ariaLabel={tx('Rayon (km)', 'Radius (km)')}
              options={[
                { value: '', label: tx('Aucun', 'None') },
                { value: '5', label: '5 km' },
                { value: '10', label: '10 km' },
                { value: '25', label: '25 km' },
                { value: '50', label: '50 km' }
              ]}
            />
          </div>
          <div className="searchFiltersAction">
            <button className="btn ghost" type="button" onClick={requestGeo}>{tx('Utiliser ma position', 'Use my location')}</button>
          </div>
          <div className="searchFiltersAction">
            <button className="btn" type="button" onClick={() => applySearch()}>{tx('Appliquer les filtres', 'Apply filters')}</button>
          </div>
        </div>
        <div className="searchBadges">
          <Checkbox
            className="compact"
            checked={selectedBadges.includes('VIP')}
            onChange={() => toggleBadge('VIP')}
            ariaLabel={tx('VIP', 'VIP')}
          >
            <span className="badge vip">{tx('VIP', 'VIP')}</span>
          </Checkbox>
          <Checkbox
            className="compact"
            checked={selectedBadges.includes('PREMIUM')}
            onChange={() => toggleBadge('PREMIUM')}
            ariaLabel={tx('PREMIUM', 'PREMIUM')}
          >
            <span className="badge premium">{tx('PREMIUM', 'PREMIUM')}</span>
          </Checkbox>
          <Checkbox
            className="compact"
            checked={selectedBadges.includes('URGENT')}
            onChange={() => toggleBadge('URGENT')}
            ariaLabel={tx('URGENT', 'URGENT')}
          >
            <span className="badge urgent">{tx('URGENT', 'URGENT')}</span>
          </Checkbox>
          <Checkbox
            className="compact"
            checked={selectedBadges.includes('TOP')}
            onChange={() => toggleBadge('TOP')}
            ariaLabel={tx('TOP', 'TOP')}
          >
            <span className="badge top">{tx('TOP', 'TOP')}</span>
          </Checkbox>
        </div>
      </div>

      <div style={{ height: 16 }} />
      {recoAds.length ? (
        <div className="panel pad">
          <div className="section-title">
            <div className="h2">{tx('Pour vous', 'Recommended')}</div>
            <a className="btn" href="/search">{tx('Explorer', 'Explore')}</a>
          </div>
          <div style={{ height: 10 }} />
          <div className="scrollrow">
            {recoAds.map((ad) => (
              <div key={ad.id} style={{ minWidth: 260 }}>
                <ListingCard ad={ad} onClick={() => nav(`/ad/${ad.id}`)} apiBaseUrl={API_URL} />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {(topCities.length || themes.length) ? <div style={{ height: 16 }} /> : null}
      {topCities.length ? (
        <div className="panel pad">
          <div className="section-title">
            <div className="h2">{tx('Top villes', 'Top cities')}</div>
            <a className="btn" href="/cities/cm">{tx('Voir toutes', 'View all')}</a>
          </div>
          <div style={{ height: 10 }} />
          <div className="grid cols-4">
            {topCities.map((item) => (
              <button key={item.city} className="card" style={{ padding: 14, textAlign: 'left' }} onClick={() => applySearch(undefined, undefined, { city: item.city })}>
                <div className="kicker">{tx('Ville', 'City')}</div>
                <div style={{ fontWeight: 900 }}>{item.city}</div>
                <div className="small">{item.count} {tx('annonces', 'listings')}</div>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {themes.length ? (
        <div className="panel pad" style={{ marginTop: 16 }}>
          <div className="section-title">
            <div className="h2">{tx('Thèmes', 'Themes')}</div>
            <a className="btn" href="/categories">{tx('Voir catégories', 'View categories')}</a>
          </div>
          <div style={{ height: 10 }} />
          <div className="grid cols-4">
            {themes.map((item) => (
              <button key={item.slug} className="card" style={{ padding: 14, textAlign: 'left' }} onClick={() => applySearch(undefined, undefined, { category: item.slug })}>
                <div className="kicker">{tx('Catégorie', 'Category')}</div>
                <div style={{ fontWeight: 900 }}>{item.label}</div>
                <div className="small">{item.count} {tx('annonces', 'listings')}</div>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div style={{ height: 16 }} />
      <div className="section-title">
        <div className="h2">{tx('Résultats', 'Results')}</div>
        <div className="small">{items.length} {tx('annonces', 'listings')}</div>
      </div>
      <div style={{ height: 12 }} />

      {q.isError ? <div className="panel pad">{tx('Erreur de chargement.', 'Loading error.')}</div> : null}
      {q.isLoading ? (
        <div className="pageLoading">
          <div className="panel pad">{tx('Chargement...', 'Loading...')}</div>
        </div>
      ) : null}

      <div className="grid cols-4">
        {items.map((a) => (
          <ListingCard key={a.id} ad={a} onClick={() => nav(`/ad/${a.id}`)} apiBaseUrl={API_URL} />
        ))}
      </div>

      <div ref={sentinelRef} style={{ height: 1 }} />

      <div style={{ height: 16 }} />
      <div className="row" style={{ justifyContent: 'center' }}>
        <button className="btn primary" disabled={!q.hasNextPage || q.isFetchingNextPage} onClick={() => q.fetchNextPage()}>
          {q.isFetchingNextPage
            ? tx('Chargement…', 'Loading…')
            : q.hasNextPage
              ? tx('Charger plus', 'Load more')
              : tx('Fin', 'End')}
        </button>
      </div>
    </>
  );
}
