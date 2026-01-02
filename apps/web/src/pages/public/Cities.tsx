import React from 'react';
import { useParams } from 'react-router-dom';
import { PageTitle } from './_common';
import { useI18n } from '../../lib/i18n';

export function Cities() {
  const { tx } = useI18n();
  const { country } = useParams();
  const cities = ['Douala','Yaoundé','Bafoussam','Bertoua','Paris'];
  return (
    <>
      <PageTitle title={`${tx('Villes', 'Cities')} — ${country ?? ''}`} />
      <div className="grid cols-4">
        {cities.map((c) => (
          <a key={c} className="panel pad" href={`/search?city=${encodeURIComponent(c)}`}>{c}</a>
        ))}
      </div>
    </>
  );
}
