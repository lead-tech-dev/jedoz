import React, { useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useInfiniteQuery } from '@tanstack/react-query';
import { ListingCard, PageTitle, SearchHero } from './_common';
import { apiFetch } from '../../lib/api';
import { useSeo } from '../../lib/seo';
import { useI18n } from '../../lib/i18n';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001') as string;
type CategoryTree = { id: string; name: string; slug: string; children?: CategoryTree[] };

async function fetchAds({ pageParam, categorySlug }: { pageParam?: string | null; categorySlug: string }) {
  const u = new URL(`${API_URL}/ads`);
  u.searchParams.set('limit', '20');
  u.searchParams.set('status', 'PUBLISHED');
  u.searchParams.set('categorySlug', categorySlug);
  if (pageParam) u.searchParams.set('cursor', pageParam);
  const r = await fetch(u.toString());
  if (!r.ok) throw new Error('FETCH_FAILED');
  return (await r.json()) as { items: any[]; nextCursor: string | null };
}

export function SubCategory() {
  const { lang, tx } = useI18n();
  const nav = useNavigate();
  const { slug = '', subSlug = '' } = useParams();
  const [categorySlug, setCategorySlug] = React.useState<string>(subSlug || '');
  const [labels, setLabels] = React.useState<{ parent: string; child: string }>({ parent: slug, child: subSlug });

  const findBySlug = React.useCallback((nodes: CategoryTree[], target: string): CategoryTree | null => {
    for (const node of nodes) {
      if (node.slug === target) return node;
      if (node.children?.length) {
        const found = findBySlug(node.children, target);
        if (found) return found;
      }
    }
    return null;
  }, []);

  React.useEffect(() => {
    if (!slug || !subSlug) return;
    setCategorySlug(subSlug);
    setLabels({ parent: slug, child: subSlug });
    apiFetch<{ items: CategoryTree[] }>('/categories/tree')
      .then((res) => {
        const tree = res.items || [];
        const parent = findBySlug(tree, slug);
        const child = parent?.children?.find((c) => c.slug === subSlug)
          || (parent?.children ? findBySlug(parent.children, subSlug) : null)
          || findBySlug(tree, subSlug);
        if (child?.slug) setCategorySlug(child.slug);
        setLabels({
          parent: parent?.name || slug,
          child: child?.name || subSlug,
        });
      })
      .catch(() => {
        setCategorySlug(subSlug);
        setLabels({ parent: slug, child: subSlug });
      });
  }, [slug, subSlug, findBySlug]);

  useSeo({
    title: lang === 'fr' ? `Sous‑catégorie · ${labels.child}` : `Subcategory · ${labels.child}`,
    description: lang === 'fr'
      ? `Annonces de ${labels.parent} → ${labels.child}. Badges VIP/URGENT/TOP et pagination infinie.`
      : `Listings from ${labels.parent} → ${labels.child}. VIP/URGENT/TOP badges and infinite scroll.`,
    canonicalPath: `/category/${slug}/${subSlug}`,
  });

  const q = useInfiniteQuery({
    queryKey: ['ads', 'subcategory', categorySlug],
    queryFn: ({ pageParam }) => fetchAds({ pageParam: pageParam as string | null | undefined, categorySlug }),
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: Boolean(categorySlug),
  });

  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && q.hasNextPage && !q.isFetchingNextPage) q.fetchNextPage();
    }, { rootMargin: '600px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, [q.hasNextPage, q.isFetchingNextPage]);

  return (
    <>
      <PageTitle title={labels.child} subtitle={`${tx('Sous‑catégorie', 'Subcategory')} • ${labels.parent}`} />
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
