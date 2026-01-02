import React from 'react';
import '../styles/index.scss';

export function SearchBar(props: {
  value?: string;
  placeholder?: string;
  onChange?: (v: string) => void;
  onSubmit?: () => void;
}) {
  return (
    <div className="panel pad" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
      <input
        className="input"
        value={props.value ?? ''}
        placeholder={props.placeholder ?? 'Rechercher une annonce, une ville, un service…'}
        onChange={(e) => props.onChange?.(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') props.onSubmit?.();
        }}
      />
      <button className="btn primary" onClick={props.onSubmit}>Rechercher</button>
    </div>
  );
}
