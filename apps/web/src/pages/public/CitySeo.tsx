import React from 'react';
import { useParams } from 'react-router-dom';
import { useInfiniteQuery } from '@tanstack/react-query';
import { PageTitle } from './_common';
import { Card, Badge } from '@repo/ui';
import { useSeo } from '../../lib/seo';
import { useI18n } from '../../lib/i18n';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001') as string;

async function fetchAds({
  pageParam,
  country,
  city,
}: {
  pageParam?: string | null;
  country: string;
  city: string;
}) {
  const u = new URL(`${API_URL}/ads`);
  u.searchParams.set('country', country);
  u.searchParams.set('city', city);
  u.searchParams.set('limit', '20');
  if (pageParam) u.searchParams.set('cursor', pageParam);
  const r = await fetch(u.toString());
  if (!r.ok) throw new Error('FETCH_FAILED');
  return r.json() as Promise<{ items: any[]; nextCursor: string | null }>;
}

export function CitySeo() {
  const { lang, tx } = useI18n();
  const { country = 'CM', citySlug = '' } = useParams();
  const city = decodeURIComponent(citySlug).replace(/-/g, ' ');

  useSeo({
    title: lang === 'fr' ? `Ville · ${city}` : `City · ${city}`,
    description: lang === 'fr'
      ? `Annonces et profils à ${city} (${country}). Filtre VIP, URGENT, TOP et recherche par catégorie.`
      : `Listings and profiles in ${city} (${country}). VIP, URGENT, TOP filters and category search.`,
    canonicalPath: `/city/${country}/${citySlug}`,
  });

  const q = useInfiniteQuery({
    queryKey: ['ads', 'city', country, citySlug],
    queryFn: ({ pageParam }) => fetchAds({ pageParam: pageParam as string | null | undefined, country, city }),
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const items = q.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <>
      <PageTitle title={city} subtitle={`${tx('Ville', 'City')} • ${country} • ${items.length} ${tx('annonces', 'listings')}`} />

      <div className="section-title">
        <div className="h2">{tx('Annonces récentes', 'Recent listings')}</div>
        <div className="small">{tx('Chargement progressif et mise en cache.', 'Progressive loading and caching.')}</div>
      </div>

      <div style={{ height: 12 }} />

      {q.isError ? <div className="panel pad">{tx('Erreur de chargement.', 'Loading error.')}</div> : null}

      <div className="grid cols-4">
        {items.map((a) => (
          <Card
            key={a.id}
            title={a.title}
            city={a.city}
            price={a.price ? String(a.price) : '—'}
            imageUrl={a.media?.[0]?.url ? `${API_URL}${a.media[0].url}` : undefined}
            badge={
              Array.isArray(a.badges) && a.badges.length ? (
                <Badge kind={(a.badges[0] || 'vip').toLowerCase()}>{String(a.badges[0]).toUpperCase()}</Badge>
              ) : undefined
            }
            onClick={() => (window.location.href = `/ad/${a.id}`)}
          />
        ))}
      </div>

      <div style={{ height: 16 }} />

      <div className="row" style={{ justifyContent: 'center' }}>
        <button
          className="btn primary"
          disabled={!q.hasNextPage || q.isFetchingNextPage}
          onClick={() => q.fetchNextPage()}
        >
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
