import React, { useEffect, useState } from 'react';
import { PageTitle } from './_common';
import { apiFetch } from '../../lib/api';
import { notifyError } from '../../lib/toast';
import { useI18n } from '../../lib/i18n';

export function Categories() {
  const { tx } = useI18n();
  const [cats, setCats] = useState<{ id: string; name: string; slug: string; icon?: string | null; color?: string | null; gradient?: string | null; children?: { id: string; name: string; slug: string }[] }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    setLoading(true);
    setError(null);
    apiFetch<{ items: { id: string; name: string; slug: string; icon?: string | null; color?: string | null; gradient?: string | null; children?: { id: string; name: string; slug: string }[] }[] }>('/categories/tree')
      .then((res) => setCats(res.items || []))
      .catch(() => {
        setCats([]);
        setError(tx('Erreur de chargement.', 'Loading error.'));
        notifyError(tx('Erreur de chargement.', 'Loading error.'));
      })
      .finally(() => setLoading(false));
  }, [tx]);

  const totalChildren = React.useMemo(
    () => cats.reduce((acc, c) => acc + (c.children?.length || 0), 0),
    [cats]
  );

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cats;
    return cats
      .map((c) => {
        const matchCategory = c.name.toLowerCase().includes(q);
        const children = (c.children || []).filter((child) => child.name.toLowerCase().includes(q));
        if (matchCategory) return { ...c, children: c.children || [] };
        if (children.length) return { ...c, children };
        return null;
      })
      .filter(Boolean) as typeof cats;
  }, [cats, query]);

  const featured = React.useMemo(() => cats.slice(0, 4), [cats]);

  return (
    <>
      <PageTitle
        title={tx('Catégories', 'Categories')}
        subtitle={tx('Choisissez une catégorie pour voir les annonces.', 'Choose a category to see listings.')}
      />
      <div className="categoriesHero">
        <div className="panel pad categoriesHeroCard">
          <div className="kicker">{tx('Explorer', 'Explore')}</div>
          <div className="h2">{tx('Trouvez votre univers', 'Find your space')}</div>
          <div className="small">
            {tx('Parcourez les catégories et accédez rapidement aux annonces.', 'Browse categories and jump straight into listings.')}
          </div>
          <div className="categoriesSearch">
            <input
              className="input"
              placeholder={tx('Rechercher une catégorie…', 'Search a category…')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button className="btn ghost" onClick={() => setQuery('')}>
              {tx('Effacer', 'Clear')}
            </button>
          </div>
          <div className="categoriesStatsRow">
            <div className="statPill">
              <div className="statValue">{cats.length}</div>
              <div className="small">{tx('Catégories', 'Categories')}</div>
            </div>
            <div className="statPill">
              <div className="statValue">{totalChildren}</div>
              <div className="small">{tx('Sous-catégories', 'Subcategories')}</div>
            </div>
            <div className="statPill">
              <div className="statValue">{filtered.length}</div>
              <div className="small">{tx('Résultats', 'Results')}</div>
            </div>
          </div>
        </div>
        <div className="panel pad categoriesHeroAside">
          <div className="kicker">{tx('En vedette', 'Featured')}</div>
          <div className="categoriesFeatured">
            {featured.map((c) => (
              <a
                key={c.slug}
                className="categoryTile"
                href={`/category/${c.slug}`}
                style={{
                  '--category-color': c.color || undefined,
                  '--category-gradient': c.gradient || (c.color ? `linear-gradient(135deg, ${c.color}26, transparent)` : undefined),
                } as React.CSSProperties}
              >
                <div className="categoryIcon">{c.icon || '✨'}</div>
                <div>
                  <div className="categoryTileTitle">{c.name}</div>
                  <div className="small">{c.children?.length || 0} {tx('sous-catégories', 'subcategories')}</div>
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>
      {loading ? (
        <div className="pageLoading">
          <div className="panel pad">{tx('Chargement…', 'Loading…')}</div>
        </div>
      ) : null}
      {error ? <div className="panel pad">{error}</div> : null}
      {!loading && !error ? (
        <div className="grid cols-3 categoryGrid">
          {filtered.map((c) => (
            <div
              key={c.slug}
              className="categoryCard"
              style={{
                '--category-color': c.color || undefined,
                '--category-gradient': c.gradient || (c.color ? `linear-gradient(135deg, ${c.color}2a, transparent)` : undefined),
              } as React.CSSProperties}
            >
              <div className="categoryCardHeader">
                <div className="categoryIdentity">
                  <div className="categoryIcon">{c.icon || '📌'}</div>
                  <div>
                    <div className="categoryTitle">{c.name}</div>
                    <div className="categoryMeta">
                      <span>{c.children?.length || 0} {tx('sous-catégories', 'subcategories')}</span>
                    </div>
                  </div>
                </div>
                <a className="btn ghost categoryAction" href={`/category/${c.slug}`}>
                  {tx('Voir', 'View')}
                </a>
              </div>
              {c.children && c.children.length ? (
                <div className="categoryChildren">
                  {c.children.slice(0, 6).map((child) => (
                    <a
                      key={child.slug}
                      className="badge"
                      href={`/category/${c.slug}/${child.slug}`}
                    >
                      {child.name}
                    </a>
                  ))}
                  {c.children.length > 6 ? (
                    <a className="badge neutral" href={`/category/${c.slug}`}>
                      +{c.children.length - 6} {tx('autres', 'more')}
                    </a>
                  ) : null}
                </div>
              ) : (
                <div className="small">{tx('Aucune sous-catégorie.', 'No subcategories.')}</div>
              )}
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}
