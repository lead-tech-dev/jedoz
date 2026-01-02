import React from 'react';
import { PageTitle } from './_common';
import { useI18n } from '../../lib/i18n';

export function Countries() {
  const { tx } = useI18n();
  const countries = [
    { fr: 'Cameroun', en: 'Cameroon' },
    { fr: "Côte d'Ivoire", en: "Côte d'Ivoire" },
    { fr: 'Sénégal', en: 'Senegal' },
    { fr: 'France', en: 'France' }
  ];
  return (
    <>
      <PageTitle title={tx('Choisir un pays', 'Choose a country')} />
      <div className="grid cols-3">
        {countries.map((c) => {
          const label = tx(c.fr, c.en);
          return (
            <a key={label} className="panel pad" href={`/cities/${encodeURIComponent(label)}`}>{label}</a>
          );
        })}
      </div>
    </>
  );
}
