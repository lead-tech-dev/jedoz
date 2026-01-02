import React from 'react';
import '../styles/index.scss';

export function Card(props: {
  title: string;
  city: string;
  price?: string;
  badge?: React.ReactNode;
  imageUrl?: string;
  onClick?: () => void;
}) {
  return (
    <div className="card" role="button" tabIndex={0} onClick={props.onClick}>
      <div className="thumb" aria-hidden="true">
        {props.imageUrl ? (
          <img
            src={props.imageUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="thumbImg"
          />
        ) : (
          <div className="thumbPlaceholder" />
        )}
      </div>
      <div className="body">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 900 }}>{props.title}</div>
          {props.badge}
        </div>
        <div className="meta" style={{ marginTop: 10 }}>
          <span>{props.city}</span>
          <span>{props.price ?? '—'}</span>
        </div>
      </div>
    </div>
  );
}
