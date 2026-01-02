import React, { useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useInfiniteQuery } from '@tanstack/react-query';
import { ListingCard, PageTitle, SearchHero } from './_common';
import { useSeo } from '../../lib/seo';
import { useI18n } from '../../lib/i18n';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001') as string;

async function fetchAds({
  pageParam,
  categorySlug,
}: {
  pageParam?: string | null;
  categorySlug: string;
}) {
  const u = new URL(`${API_URL}/ads`);
  u.searchParams.set('limit', '20');
  u.searchParams.set('status', 'PUBLISHED');
  u.searchParams.set('categorySlug', categorySlug);
  if (pageParam) u.searchParams.set('cursor', pageParam);
  const r = await fetch(u.toString());
  if (!r.ok) throw new Error('FETCH_FAILED');
  return (await r.json()) as { items: any[]; nextCursor: string | null };
}

export function Category() {
  const { lang, tx } = useI18n();
  const nav = useNavigate();
  const { slug = '' } = useParams();

  useSeo({
    title: lang === 'fr' ? `Catégorie · ${slug}` : `Category · ${slug}`,
    description: lang === 'fr'
      ? `Toutes les annonces de la catégorie ${slug}. Grille magazine, badges VIP/URGENT/TOP, pagination infinie.`
      : `All listings in ${slug}. Magazine grid, VIP/URGENT/TOP badges, infinite scroll.`,
    canonicalPath: `/category/${slug}`,
  });

  const q = useInfiniteQuery({
    queryKey: ['ads', 'category', slug],
    queryFn: ({ pageParam }) => fetchAds({ pageParam: pageParam as string | null | undefined, categorySlug: slug }),
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: Boolean(slug),
  });

  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && q.hasNextPage && !q.isFetchingNextPage) q.fetchNextPage();
      },
      { rootMargin: '600px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [q.hasNextPage, q.isFetchingNextPage]);

  return (
    <>
      <PageTitle title={slug} subtitle={tx('Catégorie • Grille magazine + scroll infini', 'Category • Magazine grid + infinite scroll')} />
      <SearchHero />
      <div style={{ height: 12 }} />

      {q.isError ? <div className="panel pad">{tx('Erreur de chargement.', 'Loading error.')}</div> : null}

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
