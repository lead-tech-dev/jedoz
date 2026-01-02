import React from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useParams } from 'react-router-dom';
import { Checkbox, Select } from '@repo/ui';
import { apiFetch, API_BASE, getToken } from '../../lib/api';
import { notifyError, notifySuccess } from '../../lib/toast';
import { formatStatus } from '../../lib/status';
import { useI18n } from '../../lib/i18n';
import { Ad, Wallet } from './types';
import { tone } from './utils';
import { Turnstile, turnstileEnabled } from '../../components/Turnstile';

type PublishConfig = { action: string; costCredits: number; maxPerDay: number | null; currency: string };
type CategoryTree = { id: string; name: string; slug: string; icon?: string | null; color?: string | null; gradient?: string | null; children?: CategoryTree[]; extraFields?: any };
type FormField = { id: string; name: string; label: string; type?: string | null; unit?: string | null; values?: any; rules?: any; default_checked?: boolean; disabled?: boolean };
type FormStep = { id: string; name: string; label: string; order: number; flow?: string | null; info?: any; fields?: FormField[] };
type AdMediaItem = { id?: string; url: string; mime?: string; size?: number; type?: string; name?: string };

const AD_TYPE_LABELS: Record<string, { fr: string; en: string }> = {
  OFFRE: { fr: 'Offre', en: 'Offer' },
  DEMANDE: { fr: 'Demande', en: 'Request' },
  RECHERCHE: { fr: 'Recherche', en: 'Search' },
  SERVICE: { fr: 'Service', en: 'Service' },
  OFFER: { fr: 'Offre', en: 'Offer' },
  REQUEST: { fr: 'Demande', en: 'Request' },
};
const AD_TYPE_FLOW: Record<string, string[]> = {
  OFFRE: ['offer', 'sell', 'offre'],
  DEMANDE: ['request', 'buy', 'demande'],
  RECHERCHE: ['search', 'recherche'],
  SERVICE: ['service'],
  OFFER: ['offer', 'sell', 'offre'],
  REQUEST: ['request', 'buy', 'demande'],
};
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;
const CAMEROON_CENTER = { lat: 5.96, lng: 12.36 };
const CAMEROON_BOUNDS: [[number, number], [number, number]] = [[8.4, 1.6], [16.2, 13.1]];
const LOCATION_STEP_MATCH = /localisation|location|gps|carte|map|lieu/i;
const LOCATION_LAT_KEYS = ['lat', 'latitude', 'gps_lat', 'coord_lat', 'location_lat', 'map_lat', 'geo_lat'];
const LOCATION_LNG_KEYS = ['lng', 'lon', 'longitude', 'gps_lng', 'coord_lng', 'location_lng', 'map_lng', 'geo_lng'];
const LOCATION_KEYS = ['location', 'localisation', 'adresse', 'address', 'lieu', 'gps', 'coords', 'coord'];

function toTitleCase(value: string) {
  if (!value) return value;
  const cleaned = value.replace(/[_-]+/g, ' ').trim();
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
}

function resolveAdTypeLabel(value: string, tx: (fr: string, en: string) => string) {
  const key = String(value || '').toUpperCase();
  const entry = AD_TYPE_LABELS[key];
  if (entry) return tx(entry.fr, entry.en);
  return toTitleCase(value);
}

function formatOptionLabel(value: string) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return trimmed;
  if (/[_-]/.test(trimmed)) return toTitleCase(trimmed);
  if (trimmed.toUpperCase() === trimmed) return trimmed;
  return toTitleCase(trimmed);
}

function parseJsonValue(value: any) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try { return JSON.parse(trimmed); } catch {}
  }
  return value;
}

function RichTextEditor({
  value,
  onChange,
  placeholder,
  disabled,
  required,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
}) {
  const { tx } = useI18n();
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [focused, setFocused] = React.useState(false);
  const resolvedPlaceholder = placeholder ?? tx('Écrivez votre description...', 'Write your description...');

  React.useEffect(() => {
    if (!ref.current) return;
    if (ref.current.innerHTML !== value) {
      ref.current.innerHTML = value || '';
    }
  }, [value]);

  const exec = (command: string, payload?: string) => {
    if (disabled) return;
    document.execCommand(command, false, payload);
    ref.current?.focus();
  };

  const isEmpty = !value || value.replace(/<[^>]*>/g, '').trim().length === 0;

  return (
    <div className="panel pad" style={{ padding: 12 }}>
      <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
        <button className="btn" type="button" onClick={() => exec('bold')} disabled={disabled}>{tx('Gras', 'Bold')}</button>
        <button className="btn" type="button" onClick={() => exec('italic')} disabled={disabled}>{tx('Italique', 'Italic')}</button>
        <button className="btn" type="button" onClick={() => exec('underline')} disabled={disabled}>{tx('Souligné', 'Underline')}</button>
        <button className="btn" type="button" onClick={() => exec('insertUnorderedList')} disabled={disabled}>{tx('• Liste', '• List')}</button>
        <button className="btn" type="button" onClick={() => exec('insertOrderedList')} disabled={disabled}>{tx('1. Liste', '1. List')}</button>
        <button
          className="btn"
          type="button"
          onClick={() => {
            const url = window.prompt(tx('Lien (https://...)', 'Link (https://...)'));
            if (url) exec('createLink', url);
          }}
          disabled={disabled}
        >
          {tx('Lien', 'Link')}
        </button>
        <button className="btn ghost" type="button" onClick={() => exec('removeFormat')} disabled={disabled}>{tx('Nettoyer', 'Clear')}</button>
      </div>
      <div
        ref={ref}
        contentEditable={!disabled}
        suppressContentEditableWarning
        role="textbox"
        aria-required={required}
        onInput={() => onChange(ref.current?.innerHTML || '')}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          minHeight: 180,
          marginTop: 10,
          padding: 12,
          lineHeight: 1.6,
          borderRadius: 12,
          background: 'var(--panel2)',
          border: '1px solid rgba(15, 23, 42, 0.12)',
          outline: 'none',
        }}
      />
      {isEmpty && !focused ? (
        <div className="small" style={{ marginTop: -162, paddingLeft: 14, opacity: 0.6, pointerEvents: 'none' }}>
          {resolvedPlaceholder}
        </div>
      ) : null}
    </div>
  );
}

function CustomRadioGroup({
  name,
  options,
  value,
  onChange,
  disabled,
  required,
}: {
  name: string;
  options: SelectOption[];
  value: string | number | null | undefined;
  onChange: (next: string) => void;
  disabled?: boolean;
  required?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={name}
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 10,
      }}
    >
      {options.map((opt) => {
        const active = String(opt.value) === String(value ?? '');
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-required={required}
            onClick={() => onChange(opt.value)}
            disabled={disabled}
            style={{
              padding: '12px 14px',
              borderRadius: 14,
              border: `1px solid ${active ? 'var(--accent)' : 'rgba(15, 23, 42, 0.12)'}`,
              background: active ? 'linear-gradient(135deg, var(--accent), rgba(15, 23, 42, 0.9))' : 'var(--panel2)',
              color: active ? 'white' : 'var(--text)',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              textAlign: 'left',
              boxShadow: active ? '0 10px 20px rgba(15, 23, 42, 0.2)' : '0 4px 12px rgba(15, 23, 42, 0.08)',
              opacity: disabled ? 0.6 : 1,
              cursor: disabled ? 'not-allowed' : 'pointer',
            }}
          >
            <span>
              <span style={{ display: 'block' }}>{opt.label}</span>
              {opt.description ? (
                <span style={{ display: 'block', fontSize: 12, opacity: 0.8, fontWeight: 500, marginTop: 4 }}>
                  {opt.description}
                </span>
              ) : null}
            </span>
            <span
              aria-hidden="true"
              style={{
                width: 18,
                height: 18,
                borderRadius: 999,
                display: 'grid',
                placeItems: 'center',
                border: `2px solid ${active ? 'white' : 'rgba(15, 23, 42, 0.3)'}`,
                background: active ? 'rgba(255, 255, 255, 0.18)' : 'transparent',
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background: active ? 'white' : 'transparent',
                }}
              />
            </span>
          </button>
        );
      })}
    </div>
  );
}

function CustomCheckboxGroup({
  name,
  options,
  values,
  onToggle,
  disabled,
  required,
}: {
  name: string;
  options: SelectOption[];
  values: string[];
  onToggle: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label={name}
      aria-required={required}
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 10,
      }}
    >
      {options.map((opt) => {
        const active = values.includes(String(opt.value));
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onToggle(opt.value)}
            disabled={disabled}
            style={{
              padding: '12px 14px',
              borderRadius: 14,
              border: `1px solid ${active ? 'var(--accent)' : 'rgba(15, 23, 42, 0.12)'}`,
              background: active ? 'rgba(15, 23, 42, 0.08)' : 'var(--panel2)',
              color: 'var(--text)',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              textAlign: 'left',
              opacity: disabled ? 0.6 : 1,
              cursor: disabled ? 'not-allowed' : 'pointer',
            }}
          >
            <span>{opt.label}</span>
            <span
              aria-hidden="true"
              style={{
                width: 18,
                height: 18,
                borderRadius: 6,
                display: 'grid',
                placeItems: 'center',
                border: `2px solid ${active ? 'var(--accent)' : 'rgba(15, 23, 42, 0.3)'}`,
                background: active ? 'var(--accent)' : 'transparent',
                color: active ? 'white' : 'transparent',
                fontSize: 12,
                fontWeight: 900,
              }}
            >
              ✓
            </span>
          </button>
        );
      })}
    </div>
  );
}

function CustomCheckbox({
  label,
  checked,
  onChange,
  disabled,
  required,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  required?: boolean;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-required={required}
      onClick={() => onChange(!checked)}
      disabled={disabled}
      style={{
        padding: '12px 14px',
        borderRadius: 14,
        border: `1px solid ${checked ? 'var(--accent)' : 'rgba(15, 23, 42, 0.12)'}`,
        background: checked ? 'rgba(15, 23, 42, 0.08)' : 'var(--panel2)',
        color: 'var(--text)',
        fontWeight: 700,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        textAlign: 'left',
        opacity: disabled ? 0.6 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      <span>{label}</span>
      <span
        aria-hidden="true"
        style={{
          width: 18,
          height: 18,
          borderRadius: 6,
          display: 'grid',
          placeItems: 'center',
          border: `2px solid ${checked ? 'var(--accent)' : 'rgba(15, 23, 42, 0.3)'}`,
          background: checked ? 'var(--accent)' : 'transparent',
          color: checked ? 'white' : 'transparent',
          fontSize: 12,
          fontWeight: 900,
        }}
      >
        ✓
      </span>
    </button>
  );
}

type CitySuggestion = {
  id: string;
  label: string;
  description: string;
  lat?: number;
  lng?: number;
};

function CitySearchInput({
  value,
  onChange,
  onSelect,
  followInput = false,
  disabled,
  required,
  placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  onSelect?: (next: { label: string; lat?: number; lng?: number }) => void;
  followInput?: boolean;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
}) {
  const { tx, lang } = useI18n();
  const [inputValue, setInputValue] = React.useState(value ?? '');
  const [items, setItems] = React.useState<CitySuggestion[]>([]);
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const mapLang = lang === 'fr' ? 'fr' : 'en';

  React.useEffect(() => {
    setInputValue(value ?? '');
  }, [value]);

  React.useEffect(() => {
    if (!MAPBOX_TOKEN || disabled) {
      setItems([]);
      setOpen(false);
      setLoading(false);
      setError(null);
      return;
    }
    const query = inputValue.trim();
    if (query.length < 2) {
      setItems([]);
      setOpen(false);
      setLoading(false);
      setError(null);
      return;
    }
    let active = true;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          access_token: MAPBOX_TOKEN,
          country: 'cm',
          types: 'place,locality',
          language: mapLang,
          limit: '6',
          autocomplete: 'true',
          bbox: `${CAMEROON_BOUNDS[0][0]},${CAMEROON_BOUNDS[0][1]},${CAMEROON_BOUNDS[1][0]},${CAMEROON_BOUNDS[1][1]}`,
        });
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?${params}`,
          { signal: controller.signal }
        );
        if (!res.ok) throw new Error('MAPBOX_ERROR');
        const data = await res.json();
        if (!active) return;
        const seen = new Set<string>();
        const nextItems = (data.features || [])
          .map((feature: any) => {
            const label = String(feature.text || '').trim();
            if (!label || seen.has(label)) return null;
            const center = Array.isArray(feature.center) ? feature.center : [];
            const lng = typeof center[0] === 'number' ? center[0] : undefined;
            const lat = typeof center[1] === 'number' ? center[1] : undefined;
            seen.add(label);
            return {
              id: String(feature.id || label),
              label,
              description: String(feature.place_name || label),
              lat,
              lng,
            };
          })
          .filter(Boolean) as CitySuggestion[];
        setItems(nextItems);
        if (followInput && onSelect && nextItems[0]?.lat !== undefined && nextItems[0]?.lng !== undefined) {
          onSelect({ label: nextItems[0].label, lat: nextItems[0].lat, lng: nextItems[0].lng });
        }
        setOpen(true);
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        if (!active) return;
        setError(tx('Recherche indisponible.', 'Search unavailable.'));
        setItems([]);
        setOpen(true);
      } finally {
        if (active) setLoading(false);
      }
    }, 250);
    return () => {
      active = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, [inputValue, disabled]);

  return (
    <div style={{ position: 'relative' }}>
      <input
        className="input"
        value={inputValue}
        onChange={(e) => {
          setInputValue(e.target.value);
          onChange(e.target.value);
        }}
        onFocus={() => {
          if (items.length) setOpen(true);
        }}
        onBlur={() => {
          setTimeout(() => setOpen(false), 120);
        }}
        disabled={disabled}
        aria-required={required}
        placeholder={placeholder}
        autoComplete="off"
      />
      {!MAPBOX_TOKEN ? (
        <div className="small" style={{ marginTop: 6 }}>
          {tx('Ajoutez `VITE_MAPBOX_TOKEN` dans `apps/web/.env`.', 'Add `VITE_MAPBOX_TOKEN` in `apps/web/.env`.')}
        </div>
      ) : null}
      {open && (items.length > 0 || loading || error) ? (
        <div
          className="panel"
          style={{
            position: 'absolute',
            zIndex: 20,
            width: '100%',
            marginTop: 6,
            maxHeight: 220,
            overflowY: 'auto',
            padding: 6,
          }}
        >
          {loading ? <div className="small">{tx('Recherche...', 'Searching...')}</div> : null}
          {error ? <div className="small" style={{ color: 'var(--red)' }}>{error}</div> : null}
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className="btn"
              style={{ width: '100%', justifyContent: 'space-between', marginTop: 6 }}
              onMouseDown={(e) => {
                e.preventDefault();
                setInputValue(item.label);
                onChange(item.label);
                if (onSelect) onSelect({ label: item.label, lat: item.lat, lng: item.lng });
                setOpen(false);
              }}
            >
              <span>{item.label}</span>
              <span className="small" style={{ opacity: 0.7 }}>{item.description}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function isPhotoField(field: FormField) {
  const name = String(field.name || '').toLowerCase();
  const type = String(field.type || '').toLowerCase();
  return type === 'photo' || name.includes('photo') || name.includes('image');
}

function normalizeFieldText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function isCityField(field: FormField) {
  const text = normalizeFieldText(`${field.name || ''} ${field.label || ''}`);
  if (text.includes('city') || text.includes('ville')) return true;
  return text.trim() === 'city' || text.trim() === 'ville';
}

function isOutcallField(field: FormField) {
  const text = normalizeFieldText(`${field.name || ''} ${field.label || ''}`);
  return text.includes('outcall') || text.includes('deplace');
}

function isFieldRequired(field: FormField) {
  const rules = parseJsonValue(field.rules);
  if (rules && typeof rules === 'object' && (rules as any).required) return true;
  return false;
}

function isFieldFilled(field: FormField, value: any, mediaCount = 0) {
  if (isPhotoField(field)) {
    if (Array.isArray(value)) return value.length > 0;
    if (value) return true;
    return mediaCount > 0;
  }
  const type = String(field.type || 'text').toLowerCase();
  if (type === 'checkbox' && !field.values) return Boolean(value);
  if (type === 'checkbox' || type === 'multiselect') {
    return Array.isArray(value) ? value.length > 0 : false;
  }
  if (type === 'number') return value !== null && value !== undefined && value !== '' && !Number.isNaN(value);
  return value !== null && value !== undefined && String(value).trim() !== '';
}

function orderFields(fields: FormField[]) {
  const ordered = [...fields];
  const cityIndex = ordered.findIndex(isCityField);
  if (cityIndex !== -1) {
    const [cityField] = ordered.splice(cityIndex, 1);
    const outcallIndex = ordered.findIndex(isOutcallField);
    if (outcallIndex !== -1) {
      ordered.splice(outcallIndex + 1, 0, cityField);
    } else {
      ordered.splice(cityIndex, 0, cityField);
    }
  }
  const nonTextareas = ordered.filter((field) => String(field.type || 'text').toLowerCase() !== 'textarea');
  const textareas = ordered.filter((field) => String(field.type || 'text').toLowerCase() === 'textarea');
  return [...nonTextareas, ...textareas];
}

function orderMediaByCover(items: AdMediaItem[], coverUrl: string | null) {
  if (!coverUrl) return items;
  const coverIdx = items.findIndex((item) => item.url === coverUrl);
  if (coverIdx <= 0) return items;
  const next = [...items];
  const [cover] = next.splice(coverIdx, 1);
  next.unshift(cover);
  return next;
}

function isLocationStep(step?: FormStep | null) {
  if (!step) return false;
  const label = `${step.label || ''} ${step.name || ''}`;
  return LOCATION_STEP_MATCH.test(label);
}

function pickFieldName(fields: FormField[] | undefined, candidates: string[]) {
  const list = fields || [];
  const lower = candidates.map((c) => c.toLowerCase());
  const match = list.find((field) => lower.includes(String(field.name || '').toLowerCase()));
  return match?.name;
}

function toNumber(value: any) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const num = Number(trimmed);
    if (Number.isFinite(num)) return num;
  }
  return null;
}

function getLocationFieldKeys(fields?: FormField[]) {
  return {
    lat: pickFieldName(fields, LOCATION_LAT_KEYS),
    lng: pickFieldName(fields, LOCATION_LNG_KEYS),
    location: pickFieldName(fields, LOCATION_KEYS),
  };
}

function resolveLocationValue(dynamic: Record<string, any>, keys: { lat?: string; lng?: string; location?: string }) {
  const fallbackLocation =
    dynamic.location ?? dynamic.localisation ?? dynamic.coords ?? dynamic.coord ?? dynamic.gps ?? null;
  const locationValue = keys.location ? dynamic[keys.location] : fallbackLocation;
  const lat =
    toNumber(keys.lat ? dynamic[keys.lat] : null) ??
    toNumber(locationValue?.lat ?? locationValue?.latitude) ??
    toNumber(fallbackLocation?.lat ?? fallbackLocation?.latitude) ??
    CAMEROON_CENTER.lat;
  const lng =
    toNumber(keys.lng ? dynamic[keys.lng] : null) ??
    toNumber(locationValue?.lng ?? locationValue?.lon ?? locationValue?.longitude) ??
    toNumber(fallbackLocation?.lng ?? fallbackLocation?.lon ?? fallbackLocation?.longitude) ??
    CAMEROON_CENTER.lng;
  return { lat, lng };
}

function MapboxPicker({
  value,
  onChange,
  disabled,
}: {
  value: { lat: number; lng: number };
  onChange: (next: { lat: number; lng: number }) => void;
  disabled?: boolean;
}) {
  const { tx } = useI18n();
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<mapboxgl.Map | null>(null);
  const markerRef = React.useRef<mapboxgl.Marker | null>(null);
  const onChangeRef = React.useRef(onChange);

  React.useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  React.useEffect(() => {
    if (!MAPBOX_TOKEN || !containerRef.current || mapRef.current) return;
    mapboxgl.accessToken = MAPBOX_TOKEN;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [value.lng, value.lat],
      zoom: 6.2,
      maxBounds: CAMEROON_BOUNDS,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
    map.on('click', (event) => {
      if (disabled) return;
      onChangeRef.current({ lat: event.lngLat.lat, lng: event.lngLat.lng });
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [disabled, value.lat, value.lng]);

  React.useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    if (!markerRef.current) {
      markerRef.current = new mapboxgl.Marker({ color: '#111827' })
        .setLngLat([value.lng, value.lat])
        .addTo(map);
    } else {
      markerRef.current.setLngLat([value.lng, value.lat]);
    }
    map.easeTo({ center: [value.lng, value.lat], duration: 400 });
  }, [value.lat, value.lng]);

  if (!MAPBOX_TOKEN) {
    return (
      <div className="panel pad">
        <div className="small">{tx('Mapbox token manquant.', 'Missing Mapbox token.')}</div>
        <div className="small">{tx('Ajoutez `VITE_MAPBOX_TOKEN` dans `apps/web/.env`.', 'Add `VITE_MAPBOX_TOKEN` in `apps/web/.env`.')}</div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        height: 320,
        borderRadius: 16,
        overflow: 'hidden',
        border: '1px solid rgba(15, 23, 42, 0.12)',
      }}
    />
  );
}

function normalizeAdTypeItem(item: any, tx: (fr: string, en: string) => string): { value: string; label: string; description?: string } | null {
  if (!item) return null;
  if (typeof item === 'string') {
    return { value: item, label: resolveAdTypeLabel(item, tx) };
  }
  if (typeof item !== 'object') return null;
  const rawValue = item.value ?? item.code ?? item.id ?? item.key ?? item.name ?? item.slug;
  if (!rawValue) return null;
  const value = String(rawValue);
  const label = item.label ?? item.title ?? item.name ?? resolveAdTypeLabel(value, tx);
  const description = item.description ?? item.desc ?? item.subtitle ?? item.help ?? item.text;
  return { value, label: String(label), description: description ? String(description) : undefined };
}

function extractAdTypes(extraFields: any, tx: (fr: string, en: string) => string): { value: string; label: string; description?: string }[] {
  if (!extraFields) return [];
  const parsed = parseJsonValue(extraFields);
  let raw: any = null;
  if (Array.isArray(parsed)) {
    const entry = parsed.find((item) => {
      const key = item?.key || item?.name || item?.slug;
      return key === 'ad_types' || key === 'adTypes' || key === 'ad_type' || item?.ad_types;
    });
    raw = entry?.ad_types ?? entry?.value ?? entry?.values ?? entry?.items ?? entry?.list ?? entry?.options ?? entry?.data ?? null;
  } else if (typeof parsed === 'object') {
    raw = parsed.ad_types ?? parsed.adTypes ?? parsed.ad_type ?? null;
  }
  raw = parseJsonValue(raw);
  if (!raw) return [];
  const list = Array.isArray(raw)
    ? raw
    : (typeof raw === 'object' && raw)
      ? Object.entries(raw).map(([key, value]) => ({ value: key, ...(value as any) }))
      : [raw];
  const out: { value: string; label: string; description?: string }[] = [];
  const seen = new Set<string>();
  list.forEach((item) => {
    const normalized = normalizeAdTypeItem(item, tx);
    if (!normalized) return;
    const key = normalized.value.toUpperCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(normalized);
  });
  return out;
}

function findCategoryBySlug(items: CategoryTree[], slug: string): CategoryTree | null {
  for (const item of items) {
    if (item.slug === slug) return item;
    const child = findCategoryBySlug(item.children || [], slug);
    if (child) return child;
  }
  return null;
}

export function D_AdsList(){
  const { tx, lang } = useI18n();
  const [items, setItems] = React.useState<Ad[] | null>(null);
  const [err, setErr] = React.useState<any>(null);
  const locale = lang === 'fr' ? 'fr-FR' : 'en-US';

  React.useEffect(() => {
    apiFetch<{ items: Ad[] }>('/ads/mine')
      .then((r) => setItems(r.items))
      .catch(setErr);
  }, []);

  return (
    <div className="panel pad">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <h1 className="h1">{tx('Mes annonces', 'My listings')}</h1>
          <div className="small">{tx('Statuts clairs, actions rapides et publication via crédits.', 'Clear statuses, quick actions, and credit-based publishing.')}</div>
        </div>
        <a className="btn primary" href="/dashboard/ads/create">{tx('Déposer une annonce', 'Create a listing')}</a>
      </div>
      <div style={{ height: 12 }} />
      {err ? <div className="small">{tx('Erreur', 'Error')}: {String(err?.error || err?.message || err)}</div> : null}
      {!items ? <div className="small">{tx('Chargement…', 'Loading…')}</div> : null}
      {items && items.length === 0 ? <div className="small">{tx('Aucune annonce.', 'No listings yet.')}</div> : null}
      {items ? (
        <div style={{ display: 'grid', gap: 10 }}>
          {items.map((a) => (
            <div key={a.id} className="panel pad" style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 900 }}>{a.title}</div>
                <div className="small">{a.city}, {a.country} — {a.categorySlug}</div>
                <div className="small" style={{ opacity: 0.75 }}>{new Date(a.createdAt).toLocaleString(locale)}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {(a.badges || []).map((b) => <span key={b} className="badge">{b}</span>)}
                <span className={`badge ${tone(a.status)}`}>{formatStatus(a.status, tx)}</span>
                <a className="btn" href={`/dashboard/ads/edit/${a.id}`}>{tx('Éditer', 'Edit')}</a>
                <a className="btn" href={`/dashboard/boosts/buy/${a.id}`}>{tx('Booster', 'Boost')}</a>
                <a className="btn ghost" href={`/ad/${a.id}`} target="_blank" rel="noreferrer">{tx('Voir', 'View')}</a>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function D_AdsCreate(){
  const { tx } = useI18n();
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [country, setCountry] = React.useState('CM');
  const [city, setCity] = React.useState('Douala');
  const [categorySlug, setCategorySlug] = React.useState('');
  const [media, setMedia] = React.useState<{ url: string; mime?: string; size?: number; type?: string; name?: string }[]>([]);
  const [coverUrl, setCoverUrl] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<any>(null);
  const [wallet, setWallet] = React.useState<Wallet | null>(null);
  const [config, setConfig] = React.useState<PublishConfig | null>(null);
  const [cats, setCats] = React.useState<CategoryTree[]>([]);
  const [parentSlug, setParentSlug] = React.useState('');
  const [childSlug, setChildSlug] = React.useState('');
  const [adTypes, setAdTypes] = React.useState<string[]>([]);
  const [stepIndex, setStepIndex] = React.useState(0);
  const [formSteps, setFormSteps] = React.useState<FormStep[]>([]);
  const [formLoading, setFormLoading] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [attemptedNext, setAttemptedNext] = React.useState(false);
  const [maxUnlockedStep, setMaxUnlockedStep] = React.useState(0);
  const [dynamic, setDynamic] = React.useState<Record<string, any>>({});
  const [ageConfirmed, setAgeConfirmed] = React.useState(false);
  const [captchaToken, setCaptchaToken] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<any>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const parentCats = React.useMemo(() => cats || [], [cats]);
  const selectedCategory = React.useMemo(
    () => (categorySlug ? findCategoryBySlug(parentCats, categorySlug) : null),
    [parentCats, categorySlug]
  );
  const selectedCategoryId = selectedCategory?.id || '';
  const selectedParent = React.useMemo(
    () => parentCats.find((c) => c.slug === parentSlug) || null,
    [parentCats, parentSlug]
  );
  const childCats = React.useMemo(
    () => selectedParent?.children || [],
    [selectedParent]
  );

  React.useEffect(() => {
    apiFetch<{ wallet: Wallet }>('/credits/wallet').then((r) => setWallet(r.wallet)).catch(() => null);
    apiFetch<{ items: CategoryTree[] }>('/categories/tree').then((r) => setCats(r.items || [])).catch(() => null);
  }, []);

  React.useEffect(() => {
    if (!categorySlug) {
      setConfig(null);
      return;
    }
    apiFetch<PublishConfig>(`/monetization/publish-config?country=${encodeURIComponent(country)}&categorySlug=${encodeURIComponent(categorySlug)}`)
      .then(setConfig)
      .catch(() => setConfig(null));
  }, [country, categorySlug]);

  React.useEffect(() => {
    if (!selectedCategoryId) {
      setFormSteps([]);
      setFormError(null);
      setFormLoading(false);
      return;
    }
    let cancelled = false;
    setFormLoading(true);
    setFormError(null);
    apiFetch<{ steps: FormStep[] }>(`/categories/${encodeURIComponent(selectedCategoryId)}/steps`)
      .then((res) => {
        const steps = (res.steps || []).map((step) => ({
          ...step,
          fields: Array.isArray(step.fields) ? step.fields : [],
        }));
        if (cancelled) return;
        setFormSteps(steps);
        setFormLoading(false);
        if (steps.length === 0) return;
        const fieldsByStep: Record<string, FormField[]> = {};
        Promise.all(steps.map(async (step) => {
          try {
            const stepFields = await apiFetch<{ items: FormField[] }>(`/step/${encodeURIComponent(step.id)}/fields`);
            fieldsByStep[step.id] = stepFields.items || [];
          } catch {
            fieldsByStep[step.id] = step.fields || [];
          }
        })).then(() => {
          if (cancelled) return;
          setFormSteps((prev) =>
            prev.map((step) => (Object.prototype.hasOwnProperty.call(fieldsByStep, step.id)
              ? { ...step, fields: fieldsByStep[step.id] }
              : step))
          );
        });
      })
      .catch(() => {
        setFormSteps([]);
        setFormError(tx('Erreur de chargement du formulaire.', 'Unable to load form.'));
      })
      .finally(() => {
        if (!cancelled) setFormLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedCategoryId]);

  React.useEffect(() => {
    setStepIndex(0);
    setAttemptedNext(false);
    setMaxUnlockedStep(0);
  }, [categorySlug, adTypes.join('|')]);

  async function submit() {
    if (!ageConfirmed) {
      const err = { error: 'AGE_CONFIRM_REQUIRED' };
      setError(err);
      notifyError(err, tx('Vous devez confirmer avoir 18+ pour publier.', 'You must confirm you are 18+ to publish.'));
      return;
    }
    if (turnstileEnabled && !captchaToken) {
      const err = { error: 'CAPTCHA_REQUIRED' };
      setError(err);
      notifyError(err, tx('Veuillez valider le captcha.', 'Please complete the captcha.'));
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const payloadDynamic = { ...dynamic, ad_type: adTypes };
      const orderedMedia = orderMediaByCover(media, coverUrl);
      const created = await apiFetch<{ id: string }>('/ads', {
        method: 'POST',
        body: JSON.stringify({
          title,
          description,
          country,
          city,
          categorySlug,
          badges: [],
          ageConfirmed,
          captchaToken,
          dynamic: coverUrl ? { ...payloadDynamic, coverUrl } : payloadDynamic,
          media: orderedMedia.map((m) => ({ url: m.url, mime: m.mime, size: m.size, type: m.type })),
        }),
      });
      setSuccess(tx(`Annonce créée: ${created.id} (en attente de validation).`, `Listing created: ${created.id} (pending review).`));
      notifySuccess(tx('Annonce créée.', 'Listing created.'));
      const w = await apiFetch<{ wallet: Wallet }>('/credits/wallet');
      setWallet(w.wallet);
      setTitle('');
      setDescription('');
      setMedia([]);
      setCoverUrl(null);
      setDynamic({});
      setAdTypes([]);
      setAgeConfirmed(false);
      setCaptchaToken('');
    } catch (e) {
      setError(e);
      notifyError(e, tx("Erreur lors de la création de l’annonce.", 'Unable to create listing.'));
    } finally {
      setLoading(false);
    }
  }

  const availableAdTypes = React.useMemo(() => {
    if (!categorySlug) return [];
    return extractAdTypes(selectedCategory?.extraFields, tx);
  }, [categorySlug, selectedCategory, tx]);
  const adTypesRequired = availableAdTypes.length > 0;
  const showAdTypes = Boolean(childSlug) || (Boolean(categorySlug) && childCats.length === 0);
  const cost = config?.costCredits ?? 0;
  const max = config?.maxPerDay;
  const canSubmit = !loading && !uploading && Boolean(title) && Boolean(categorySlug) && (!adTypesRequired || adTypes.length > 0) && ageConfirmed && (!turnstileEnabled || Boolean(captchaToken));
  const activeFlows = React.useMemo(() => {
    const flows = adTypes.flatMap((t) => AD_TYPE_FLOW[String(t).toUpperCase()] || [String(t).toLowerCase()]);
    return flows.map((f) => f.toLowerCase());
  }, [adTypes]);
  const filteredSteps = React.useMemo(() => {
    if (!activeFlows.length) return formSteps;
    return formSteps.filter((s) => {
      const flow = String(s.flow || '').toLowerCase().trim();
      if (!flow) return false;
      const flowTokens = flow.split(/[\s,|/]+/).filter(Boolean);
      return flowTokens.some((token) => activeFlows.includes(token));
    });
  }, [formSteps, activeFlows]);
  const activeStep = React.useMemo(() => {
    if (filteredSteps.length === 0) return null;
    return filteredSteps[Math.min(stepIndex, filteredSteps.length - 1)];
  }, [filteredSteps, stepIndex]);
  const missingRequired = React.useMemo(() => {
    if (!activeStep?.fields) return [];
    return activeStep.fields.filter((field) => isFieldRequired(field) && !isFieldFilled(field, dynamic[field.name], media.length));
  }, [activeStep, dynamic, media.length]);
  const canProceed = missingRequired.length === 0;
  const autoMaxCompleted = React.useMemo(() => {
    if (filteredSteps.length === 0) return -1;
    let max = -1;
    for (const step of filteredSteps) {
      const fields = step.fields || [];
      const missing = fields.filter((field) => isFieldRequired(field) && !isFieldFilled(field, dynamic[field.name], media.length));
      if (missing.length > 0) break;
      max += 1;
    }
    return max;
  }, [filteredSteps, dynamic, media.length]);
  const unlockedStep = Math.max(maxUnlockedStep, autoMaxCompleted + 1, 0);
  const isLastStep = stepIndex >= filteredSteps.length - 1;

  const locationFields = React.useMemo(() => getLocationFieldKeys(activeStep?.fields), [activeStep]);
  const locationValue = React.useMemo(
    () => resolveLocationValue(dynamic, locationFields),
    [dynamic, locationFields]
  );
  const showLocationMap = isLocationStep(activeStep);

  const handleLocationChange = (next: { lat: number; lng: number }) => {
    if (locationFields.lat) setFieldValue(locationFields.lat, next.lat);
    if (locationFields.lng) setFieldValue(locationFields.lng, next.lng);
    if (!locationFields.lat && !locationFields.lng) {
      const key = locationFields.location || 'location';
      setFieldValue(key, { lat: next.lat, lng: next.lng });
    }
  };

  const uploadFile = async (file: File) => {
    const token = getToken();
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${API_BASE}/media/upload`, {
      method: 'POST',
      body: form,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!res.ok) {
      let err: any = { status: res.status };
      try { err = { ...err, ...(await res.json()) }; } catch {}
      throw err;
    }
    return res.json();
  };

  const handleFiles = async (fieldName: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    setUploadError(null);
    try {
      const uploaded: { url: string; mime?: string; size?: number; type?: string; name?: string }[] = [];
      for (const file of files) {
        const item = await uploadFile(file);
        uploaded.push({
          url: item.url,
          mime: item.mime,
          size: item.size,
          type: item.mime && String(item.mime).startsWith('video/') ? 'VIDEO' : 'IMAGE',
          name: item.originalName || file.name,
        });
      }
      setMedia((prev) => {
        const next = [...prev, ...uploaded];
        if (!coverUrl && next.length > 0) setCoverUrl(next[0].url);
        setFieldValue(fieldName, next.map((m) => m.url));
        return next;
      });
    } catch (err) {
      setUploadError(err);
      notifyError(err, tx("Erreur lors de l'envoi des photos.", 'Unable to upload photos.'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeMedia = (idx: number, fieldName?: string) => {
    setMedia((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      if (coverUrl && !next.find((item) => item.url === coverUrl)) {
        setCoverUrl(next[0]?.url ?? null);
      }
      if (fieldName) setFieldValue(fieldName, next.map((m) => m.url));
      return next;
    });
  };

  const toggleAdType = (value: string) => {
    setAdTypes([value]);
  };

  const cancelSteps = () => {
    setAdTypes([]);
    setStepIndex(0);
    setAttemptedNext(false);
    setMaxUnlockedStep(0);
    setDynamic({});
  };

  const nextStep = () => {
    if (!canProceed) {
      setAttemptedNext(true);
      return;
    }
    setAttemptedNext(false);
    setMaxUnlockedStep((prev) => Math.max(prev, stepIndex + 1));
    setStepIndex((prev) => (prev < filteredSteps.length - 1 ? prev + 1 : prev));
  };

  const setFieldValue = (name: string, value: any) => {
    setDynamic((prev) => ({ ...prev, [name]: value }));
  };

  const toggleFieldOption = (name: string, value: string) => {
    const current = Array.isArray(dynamic[name]) ? dynamic[name] : [];
    const next = current.includes(value) ? current.filter((v: string) => v !== value) : [...current, value];
    setFieldValue(name, next);
  };

  const normalizeOptions = (raw: any): { value: string; label: string }[] => {
    const parsed = parseJsonValue(raw);
    if (!parsed) return [];
    if (Array.isArray(parsed)) {
      return parsed.map((item) => {
        if (item && typeof item === 'object') {
          const value = String(item.value ?? item.id ?? item.key ?? item.name ?? item.label ?? '');
          const label = String(item.label ?? item.name ?? item.title ?? formatOptionLabel(value));
          return { value, label };
        }
        const value = String(item);
        return { value, label: formatOptionLabel(value) };
      }).filter((opt) => opt.value);
    }
    if (typeof parsed === 'object') {
      return Object.entries(parsed).map(([key, val]) => {
        if (val && typeof val === 'object') {
          const value = String((val as any).value ?? key);
          const label = String((val as any).label ?? (val as any).name ?? (val as any).title ?? formatOptionLabel(key));
          return { value, label };
        }
        return {
          value: String(key),
          label: typeof val === 'string' ? String(val) : formatOptionLabel(key),
        };
      });
    }
    const value = String(parsed);
    return value ? [{ value, label: formatOptionLabel(value) }] : [];
  };

  const selectParent = (cat: CategoryTree) => {
    setParentSlug(cat.slug);
    if (!cat.children || cat.children.length === 0) {
      setChildSlug(cat.slug);
      setCategorySlug(cat.slug);
    } else {
      setChildSlug('');
      setCategorySlug('');
    }
    setAdTypes([]);
    setDynamic({});
    setFormSteps([]);
    setStepIndex(0);
    setAttemptedNext(false);
    setMaxUnlockedStep(0);
  };

  const clearParent = () => {
    setParentSlug('');
    setChildSlug('');
    setCategorySlug('');
    setAdTypes([]);
    setDynamic({});
    setFormSteps([]);
    setStepIndex(0);
    setAttemptedNext(false);
    setMaxUnlockedStep(0);
  };

  const selectChild = (cat: CategoryTree) => {
    setChildSlug(cat.slug);
    setCategorySlug(cat.slug);
    setAdTypes([]);
    setDynamic({});
    setStepIndex(0);
    setAttemptedNext(false);
    setMaxUnlockedStep(0);
  };

  const renderField = (field: FormField) => {
    const type = String(field.type || 'text').toLowerCase();
    const options = normalizeOptions(field.values);
    const value = dynamic[field.name];
    const disabled = Boolean(field.disabled);
    const required = isFieldRequired(field);
    if (isPhotoField(field)) {
      return (
        <div>
          <input
            ref={fileInputRef}
            className="input"
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => handleFiles(field.name, e)}
            disabled={disabled}
          />
          {uploading ? <div className="small" style={{ marginTop: 6 }}>{tx('Téléchargement…', 'Uploading…')}</div> : null}
          {uploadError ? <div className="small" style={{ marginTop: 6, color: 'var(--red)' }}>{tx('Erreur upload', 'Upload error')}: {String(uploadError?.error || uploadError?.message || uploadError)}</div> : null}
          {media.length ? (
            <div className="grid cols-3" style={{ marginTop: 10 }}>
              {media.map((m, idx) => {
                const preview = m.url.startsWith('http') ? m.url : `${API_BASE}${m.url}`;
                return (
                <div key={`${m.url}-${idx}`} className="panel pad" style={{ padding: 12, position: 'relative' }}>
                  <img src={preview} alt={m.name || tx('media', 'media')} style={{ width: '100%', height: 170, objectFit: 'cover', borderRadius: 12 }} />
                  <button
                    className="btn"
                    type="button"
                    onClick={() => setCoverUrl(m.url)}
                    disabled={coverUrl === m.url}
                    style={{
                      position: 'absolute',
                      top: 16,
                      right: 16,
                      padding: '6px 10px',
                      borderRadius: 999,
                      background: coverUrl === m.url ? 'var(--accent)' : 'rgba(15, 23, 42, 0.82)',
                      color: 'white',
                      fontSize: 12,
                      fontWeight: 700,
                      boxShadow: '0 8px 18px rgba(15, 23, 42, 0.25)',
                    }}
                  >
                    {coverUrl === m.url ? tx('Couverture', 'Cover') : tx('Définir couverture', 'Set cover')}
                  </button>
                  {coverUrl === m.url ? (
                    <div
                      className="small"
                      style={{
                        position: 'absolute',
                        top: 16,
                        left: 16,
                        background: 'rgba(255,255,255,0.9)',
                        padding: '4px 8px',
                        borderRadius: 999,
                        fontWeight: 700,
                      }}
                    >
                      ⭐ {tx('Couverture', 'Cover')}
                    </div>
                  ) : null}
                  <div className="small" style={{ marginTop: 6 }}>
                    {m.name || tx('Image', 'Image')}
                  </div>
                  <div className="row" style={{ gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                    <button className="btn ghost" type="button" onClick={() => removeMedia(idx, field.name)}>{tx('Supprimer', 'Remove')}</button>
                  </div>
                </div>
              );
            })}
            </div>
          ) : (
            <div className="small" style={{ marginTop: 6 }}>
              {required ? tx('Ajoutez au moins une photo.', 'Add at least one photo.') : tx('Aucune photo ajoutée.', 'No photos added.')}
            </div>
          )}
        </div>
      );
    }
    if (type === 'textarea') {
      return (
        <RichTextEditor
          value={value ?? ''}
          onChange={(next) => setFieldValue(field.name, next)}
          disabled={disabled}
          required={required}
        />
      );
    }
    if (type === 'text' && isCityField(field)) {
      return (
        <CitySearchInput
          value={value ?? city ?? ''}
          onChange={(next) => {
            setFieldValue(field.name, next);
            setCity(next);
          }}
          onSelect={(next) => {
            if (typeof next.lat === 'number' && typeof next.lng === 'number') {
              handleLocationChange({ lat: next.lat, lng: next.lng });
            }
          }}
          followInput
          disabled={disabled}
          required={required}
          placeholder={tx('Ville (Cameroun)', 'City (Cameroon)')}
        />
      );
    }
    if (type === 'number') {
      return (
        <input
          className="input"
          type="number"
          value={value ?? ''}
          onChange={(e) => setFieldValue(field.name, e.target.value === '' ? '' : Number(e.target.value))}
          disabled={disabled}
        />
      );
    }
    if (type === 'date') {
      return (
        <input
          className="input"
          type="date"
          value={value ?? ''}
          onChange={(e) => setFieldValue(field.name, e.target.value)}
          disabled={disabled}
        />
      );
    }
    if (type === 'select') {
      return (
        <Select
          className="input"
          value={value ?? ''}
          onChange={(next) => setFieldValue(field.name, next)}
          disabled={disabled}
          ariaLabel={field.label}
          options={[{ value: '', label: tx('Sélectionner', 'Select') }, ...options]}
        />
      );
    }
    if (type === 'radio') {
      return (
        <CustomRadioGroup
          name={field.name}
          options={options}
          value={value ?? ''}
          onChange={(next) => setFieldValue(field.name, next)}
          disabled={disabled}
          required={required}
        />
      );
    }
    if (type === 'multiselect' || (type === 'checkbox' && options.length)) {
      const selected = Array.isArray(value) ? value : [];
      return (
        <CustomCheckboxGroup
          name={field.name}
          options={options}
          values={selected.map((item) => String(item))}
          onToggle={(next) => toggleFieldOption(field.name, next)}
          disabled={disabled}
          required={required}
        />
      );
    }
    if (type === 'checkbox') {
      return (
        <CustomCheckbox
          label={field.label}
          checked={Boolean(value)}
          onChange={(next) => setFieldValue(field.name, next)}
          disabled={disabled}
          required={required}
        />
      );
    }
    return (
      <input
        className="input"
        value={value ?? ''}
        onChange={(e) => setFieldValue(field.name, e.target.value)}
        disabled={disabled}
      />
    );
  };

  return (
    <div className="panel pad">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <h1 className="h1">{tx('Créer une annonce', 'Create a listing')}</h1>
          <div className="small">
            {categorySlug
              ? (
                <>
                  {tx('Publication payante:', 'Paid publication:')} <b>{cost}</b> {tx('crédits', 'credits')}
                  {max ? tx(` · quota: ${max}/jour`, ` · quota: ${max}/day`) : ''}.
                </>
              )
              : tx('Choisissez une catégorie pour voir le coût de publication.', 'Select a category to see publish cost.')}
          </div>
        </div>
        <div>
          <div className="small">{tx('Solde', 'Balance')}</div>
          <div style={{ fontWeight: 900, fontSize: 26 }}>{wallet?.balance ?? 0} {tx('crédits', 'credits')}</div>
        </div>
      </div>

      <div style={{ height: 12 }} />
      {success ? <div className="small" style={{ color: 'var(--green)' }}>{success}</div> : null}
      {error ? (
        <div className="small" style={{ color: 'var(--red)' }}>
          <b>{tx('Erreur', 'Error')}:</b> {String(error?.error || error?.message || error)}
          {error?.error === 'INSUFFICIENT_CREDITS' ? (
            <div style={{ marginTop: 8 }} className="row" >
              <a className="btn primary" href="/dashboard/wallet/credits">{tx('Recharger', 'Top up')}</a>
              <a className="btn" href="/packs">{tx('Voir packs', 'View packs')}</a>
            </div>
          ) : null}
        </div>
      ) : null}

      <div style={{ height: 12 }} />
      <div className="h2">{tx('Catégorie', 'Category')}</div>
      <div className="small">{tx('Choisissez la catégorie principale.', 'Choose the main category.')}</div>
      <div style={{ height: 8 }} />
      {parentCats.length === 0 ? (
        <div className="panel pad">{tx('Aucune catégorie.', 'No categories.')}</div>
      ) : !selectedParent ? (
        <div className="grid cols-4">
          {parentCats.map((c) => {
            const active = parentSlug === c.slug;
            return (
              <button
                key={c.slug}
                type="button"
                className="panel pad"
                style={{
                  aspectRatio: '1 / 1',
                  padding: 12,
                  textAlign: 'left',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  borderColor: active ? 'var(--accent)' : c.color || undefined,
                  background: c.gradient || (c.color ? `linear-gradient(135deg, ${c.color}1a, transparent)` : undefined),
                  cursor: 'pointer',
                }}
                onClick={() => selectParent(c)}
              >
                <div className="row" style={{ gap: 10, alignItems: 'center' }}>
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 12,
                      display: 'grid',
                      placeItems: 'center',
                      fontSize: 18,
                      fontWeight: 700,
                      color: c.color || 'var(--text)',
                      background: c.gradient || (c.color ? `${c.color}26` : 'var(--panel2)'),
                      border: `1px solid ${c.color || 'rgba(15, 23, 42, 0.12)'}`,
                    }}
                  >
                    {c.icon || '📌'}
                  </div>
                  <div>
                    <div style={{ fontWeight: 800 }}>{c.name}</div>
                    <div className="small">{c.children?.length || 0} {tx('sous-catégories', 'subcategories')}</div>
                  </div>
                </div>
                {c.description ? <div className="small" style={{ marginTop: 8 }}>{c.description}</div> : null}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="panel pad" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div className="row" style={{ gap: 10, alignItems: 'center' }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 14,
                display: 'grid',
                placeItems: 'center',
                fontSize: 20,
                fontWeight: 700,
                color: selectedParent.color || 'var(--text)',
                background: selectedParent.gradient || (selectedParent.color ? `${selectedParent.color}26` : 'var(--panel2)'),
                border: `1px solid ${selectedParent.color || 'rgba(15, 23, 42, 0.12)'}`,
              }}
            >
              {selectedParent.icon || '📌'}
            </div>
            <div>
              <div style={{ fontWeight: 800 }}>{selectedParent.name}</div>
              <div className="small">{selectedParent.children?.length || 0} {tx('sous-catégories', 'subcategories')}</div>
            </div>
          </div>
          <button className="btn ghost" type="button" onClick={clearParent}>{tx('Changer', 'Change')}</button>
        </div>
      )}

      {selectedParent ? (
        <>
          <div style={{ height: 12 }} />
          <div className="h2">{tx('Sous-catégorie', 'Subcategory')}</div>
          <div className="small">{tx('Sélectionnez une sous-catégorie.', 'Select a subcategory.')}</div>
          <div style={{ height: 8 }} />
          {childCats.length === 0 ? (
            <div className="panel pad">{tx('Aucune sous-catégorie. Cette catégorie sera utilisée.', 'No subcategories. This category will be used.')}</div>
          ) : (
            <div className="grid cols-4">
              {childCats.map((c) => {
                const active = childSlug === c.slug;
                return (
                  <button
                    key={c.slug}
                    type="button"
                    className="panel pad"
                    style={{
                      aspectRatio: '1 / 1',
                      padding: 12,
                      textAlign: 'left',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      borderColor: active ? 'var(--accent)' : c.color || undefined,
                      background: c.gradient || (c.color ? `linear-gradient(135deg, ${c.color}1a, transparent)` : undefined),
                      cursor: 'pointer',
                    }}
                    onClick={() => selectChild(c)}
                  >
                    <div className="row" style={{ gap: 10, alignItems: 'center' }}>
                      <div
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: 10,
                          display: 'grid',
                          placeItems: 'center',
                          fontSize: 16,
                          fontWeight: 700,
                          color: c.color || 'var(--text)',
                          background: c.gradient || (c.color ? `${c.color}26` : 'var(--panel2)'),
                          border: `1px solid ${c.color || 'rgba(15, 23, 42, 0.12)'}`,
                        }}
                      >
                        {c.icon || '📌'}
                      </div>
                      <div>
                        <div style={{ fontWeight: 800 }}>{c.name}</div>
                        <div className="small">{c.slug}</div>
                      </div>
                    </div>
                    {c.description ? <div className="small" style={{ marginTop: 8 }}>{c.description}</div> : null}
                  </button>
                );
              })}
            </div>
          )}
        </>
      ) : null}

      {showAdTypes ? (
        <>
          <div style={{ height: 12 }} />
          <div className="h2">{tx('Type d’annonce', 'Listing type')}</div>
          <div className="small">{tx('Choisissez le type d’annonce.', 'Choose the listing type.')}</div>
          <div style={{ height: 8 }} />
          {formLoading ? (
            <div className="panel pad">{tx('Chargement des types d’annonce…', 'Loading listing types…')}</div>
          ) : availableAdTypes.length === 0 ? (
            <div className="panel pad">{tx('Aucun type d’annonce défini pour cette catégorie.', 'No listing types defined for this category.')}</div>
          ) : (
            <CustomRadioGroup
              name="ad-type"
              options={availableAdTypes.map((t) => ({
                value: t.value,
                label: t.label,
                description: t.description,
              }))}
              value={adTypes[0] ?? ''}
              onChange={toggleAdType}
              disabled={formLoading}
              required
            />
          )}

          {adTypes.length > 0 ? (
            <>
              <div className="divider" />
              <div className="h2">{tx('Étapes', 'Steps')}</div>
              <div className="small">{tx('Naviguez entre les étapes terminées.', 'Navigate through completed steps.')}</div>
              <div style={{ height: 8 }} />
              {filteredSteps.length === 0 ? (
                <div className="panel pad">{tx('Aucune étape pour ce type d’annonce.', 'No steps for this listing type.')}</div>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                    gap: 10,
                  }}
                >
                  {filteredSteps.map((step, idx) => {
                    const locked = idx > unlockedStep;
                    const active = idx === stepIndex;
                    const done = idx < unlockedStep;
                    return (
                      <button
                        key={step.id}
                        type="button"
                        className="panel pad"
                        disabled={locked}
                        onClick={() => {
                          if (locked) return;
                          setStepIndex(idx);
                        }}
                        style={{
                          aspectRatio: '1 / 1',
                          textAlign: 'left',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          borderColor: active ? 'var(--accent)' : done ? 'rgba(15, 23, 42, 0.25)' : 'rgba(15, 23, 42, 0.12)',
                          background: active ? 'var(--panel2)' : 'var(--panel)',
                          opacity: locked ? 0.5 : 1,
                          cursor: locked ? 'not-allowed' : 'pointer',
                        }}
                      >
                        <div style={{ fontWeight: 800 }}>{tx('Étape', 'Step')} {idx + 1}</div>
                        <div className="small" style={{ marginTop: 6 }}>{step.label}</div>
                        <div className="small" style={{ marginTop: 10 }}>
                          {locked ? tx('🔒 Verrouillée', '🔒 Locked') : done ? tx('✓ Terminée', '✓ Done') : tx('En cours', 'In progress')}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              <div style={{ height: 12 }} />
              <div className="h2">{tx('Étape', 'Step')} {filteredSteps.length ? Math.min(stepIndex + 1, filteredSteps.length) : 1}</div>
              <div className="small">{tx('Complétez les champs de l’étape en cours.', 'Fill in the fields for the current step.')}</div>
              <div style={{ height: 8 }} />
              {formLoading ? (
                <div className="panel pad">{tx('Chargement du formulaire…', 'Loading form…')}</div>
              ) : formError ? (
                <div className="panel pad">{formError}</div>
              ) : !activeStep ? (
                <div className="panel pad">{tx('Aucune étape pour ce type d’annonce.', 'No steps for this listing type.')}</div>
              ) : (
                <div className="panel pad">
                  <div className="h2">{activeStep.label}</div>
                  {Array.isArray(activeStep.info) && activeStep.info.length ? (
                    <div className="small" style={{ marginTop: 6 }}>{activeStep.info.join(' · ')}</div>
                  ) : null}
                  {(activeStep.fields || []).length === 0 ? (
                    <div className="small">{tx('Aucun champ pour cette étape.', 'No fields for this step.')}</div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                      {orderFields(activeStep.fields || []).map((field) => {
                        const type = String(field.type || 'text').toLowerCase();
                        const halfWidth = type === 'text' || type === 'select' || type === 'number';
                        return (
                          <div key={field.id} style={{ flex: halfWidth ? '0 1 calc(50% - 6px)' : '1 1 100%' }}>
                            {field.type !== 'checkbox' || (Array.isArray(field.values) && field.values.length) ? (
                              <div className="small">{field.label}</div>
                            ) : null}
                            {renderField(field)}
                            {field.unit ? <div className="small" style={{ marginTop: 6 }}>{field.unit}</div> : null}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {showLocationMap ? (
                    <div style={{ marginTop: 16 }}>
                      <MapboxPicker value={locationValue} onChange={handleLocationChange} />
                      <div className="small" style={{ marginTop: 6 }}>
                        {tx('Position', 'Position')}: {locationValue.lat.toFixed(5)}, {locationValue.lng.toFixed(5)}
                      </div>
                    </div>
                  ) : null}
                  {attemptedNext && !canProceed ? (
                    <div className="small" style={{ marginTop: 10, color: 'var(--red)' }}>
                      {tx('Champs obligatoires manquants.', 'Missing required fields.')}
                    </div>
                  ) : null}
                  <div style={{ height: 12 }} />
                  <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                    <button className="btn ghost" type="button" onClick={cancelSteps}>{tx('Annuler', 'Cancel')}</button>
                    <button className="btn primary" type="button" onClick={nextStep} disabled={!canProceed || isLastStep}>
                      {tx('Étape suivante', 'Next step')}
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </>
      ) : null}
      <div className="divider" />
      <div className="panel pad" style={{ display: 'grid', gap: 12 }}>
        <Checkbox
          checked={ageConfirmed}
          onChange={setAgeConfirmed}
          label={tx('Je confirme avoir 18+ pour publier cette annonce.', 'I confirm I am 18+ to publish this listing.')}
          required
        />
        {turnstileEnabled ? (
          <Turnstile
            onVerify={(token) => setCaptchaToken(token)}
            onExpire={() => setCaptchaToken('')}
            onError={() => setCaptchaToken('')}
          />
        ) : null}
        <div className="small">
          {tx('Après publication, votre annonce passe en validation.', 'After publishing, your listing goes to review.')}
        </div>
        <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <button className="btn primary" type="button" onClick={submit} disabled={!canSubmit}>
            {loading ? tx('Publication...', 'Publishing...') : tx(`Publier (${cost} crédits)`, `Publish (${cost} credits)`)}
          </button>
          <a className="btn ghost" href="/dashboard/ads/list">{tx('Voir mes annonces', 'View my listings')}</a>
        </div>
      </div>
    </div>
  )
}

export function D_AdsEdit() {
  const { tx } = useI18n();
  const { id } = useParams();
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [country, setCountry] = React.useState('CM');
  const [city, setCity] = React.useState('Douala');
  const [categorySlug, setCategorySlug] = React.useState('');
  const [media, setMedia] = React.useState<AdMediaItem[]>([]);
  const [coverUrl, setCoverUrl] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<any>(null);
  const [cats, setCats] = React.useState<CategoryTree[]>([]);
  const [parentSlug, setParentSlug] = React.useState('');
  const [childSlug, setChildSlug] = React.useState('');
  const [adTypes, setAdTypes] = React.useState<string[]>([]);
  const [stepIndex, setStepIndex] = React.useState(0);
  const [formSteps, setFormSteps] = React.useState<FormStep[]>([]);
  const [formLoading, setFormLoading] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [attemptedNext, setAttemptedNext] = React.useState(false);
  const [maxUnlockedStep, setMaxUnlockedStep] = React.useState(0);
  const [dynamic, setDynamic] = React.useState<Record<string, any>>({});
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<any>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const parentCats = React.useMemo(() => cats || [], [cats]);
  const selectedCategory = React.useMemo(
    () => (categorySlug ? findCategoryBySlug(parentCats, categorySlug) : null),
    [parentCats, categorySlug]
  );
  const selectedCategoryId = selectedCategory?.id || '';
  const selectedParent = React.useMemo(
    () => parentCats.find((c) => c.slug === parentSlug) || null,
    [parentCats, parentSlug]
  );
  const childCats = React.useMemo(
    () => selectedParent?.children || [],
    [selectedParent]
  );

  React.useEffect(() => {
    apiFetch<{ items: CategoryTree[] }>('/categories/tree').then((r) => setCats(r.items || [])).catch(() => null);
  }, []);

  React.useEffect(() => {
    if (!id) return;
    setLoading(true);
    apiFetch(`/ads/${id}`)
      .then((ad: any) => {
        const dyn = ad && typeof ad.dynamic === 'object' ? ad.dynamic : {};
        const rawAdTypes = dyn?.ad_type ?? dyn?.adTypes ?? dyn?.adType;
        const nextAdTypes = Array.isArray(rawAdTypes)
          ? rawAdTypes.map((t: any) => String(t))
          : (typeof rawAdTypes === 'string' ? [rawAdTypes] : []);
        setTitle(ad.title || '');
        setDescription(ad.description || '');
        setCountry(ad.country || 'CM');
        setCity(ad.city || 'Douala');
        setCategorySlug(ad.categorySlug || '');
        setMedia(ad.media || []);
        const coverCandidate =
          dyn?.coverUrl ??
          dyn?.cover ??
          dyn?.cover_url ??
          ad?.coverUrl ??
          (ad.media && ad.media[0] ? ad.media[0].url : null);
        setCoverUrl(coverCandidate || null);
        setDynamic(dyn);
        setAdTypes(nextAdTypes);
        setLoading(false);
      })
      .catch((e) => {
        setError(e);
        setLoading(false);
      });
  }, [id]);

  React.useEffect(() => {
    if (!categorySlug || parentCats.length === 0) return;
    const parentMatch = parentCats.find((c) => c.slug === categorySlug);
    if (parentMatch) {
      setParentSlug(parentMatch.slug);
      setChildSlug('');
      return;
    }
    for (const parent of parentCats) {
      const child = (parent.children || []).find((c) => c.slug === categorySlug);
      if (child) {
        setParentSlug(parent.slug);
        setChildSlug(child.slug);
        return;
      }
    }
  }, [categorySlug, parentCats]);

  React.useEffect(() => {
    if (!selectedCategoryId) {
      setFormSteps([]);
      setFormError(null);
      setFormLoading(false);
      return;
    }
    let cancelled = false;
    setFormLoading(true);
    setFormError(null);
    apiFetch<{ steps: FormStep[] }>(`/categories/${encodeURIComponent(selectedCategoryId)}/steps`)
      .then((res) => {
        const steps = (res.steps || []).map((step) => ({
          ...step,
          fields: Array.isArray(step.fields) ? step.fields : [],
        }));
        if (cancelled) return;
        setFormSteps(steps);
        setFormLoading(false);
        if (steps.length === 0) return;
        const fieldsByStep: Record<string, FormField[]> = {};
        Promise.all(steps.map(async (step) => {
          try {
            const stepFields = await apiFetch<{ items: FormField[] }>(`/step/${encodeURIComponent(step.id)}/fields`);
            fieldsByStep[step.id] = stepFields.items || [];
          } catch {
            fieldsByStep[step.id] = step.fields || [];
          }
        })).then(() => {
          if (cancelled) return;
          setFormSteps((prev) =>
            prev.map((step) => (Object.prototype.hasOwnProperty.call(fieldsByStep, step.id)
              ? { ...step, fields: fieldsByStep[step.id] }
              : step))
          );
        });
      })
      .catch(() => {
        setFormSteps([]);
        setFormError(tx('Erreur de chargement du formulaire.', 'Unable to load form.'));
      })
      .finally(() => {
        if (!cancelled) setFormLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedCategoryId]);

  React.useEffect(() => {
    setStepIndex(0);
    setAttemptedNext(false);
    setMaxUnlockedStep(0);
  }, [categorySlug, adTypes.join('|')]);

  const uploadFile = async (file: File) => {
    const token = getToken();
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${API_BASE}/media/upload`, {
      method: 'POST',
      body: form,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!res.ok) {
      let err: any = { status: res.status };
      try { err = { ...err, ...(await res.json()) }; } catch {}
      throw err;
    }
    return res.json();
  };

  const handleFiles = async (fieldName: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    setUploadError(null);
    try {
      const uploaded: { url: string; mime?: string; size?: number; type?: string; name?: string }[] = [];
      for (const file of files) {
        const item = await uploadFile(file);
        uploaded.push({
          url: item.url,
          mime: item.mime,
          size: item.size,
          type: item.mime && String(item.mime).startsWith('video/') ? 'VIDEO' : 'IMAGE',
          name: item.originalName || file.name,
        });
      }
      setMedia((prev) => {
        const next = [...prev, ...uploaded];
        if (!coverUrl && next.length > 0) setCoverUrl(next[0].url);
        setFieldValue(fieldName, next.map((m) => m.url));
        return next;
      });
    } catch (err) {
      setUploadError(err);
      notifyError(err, tx("Erreur lors de l'envoi des photos.", 'Unable to upload photos.'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeMedia = (idx: number, fieldName?: string) => {
    setMedia((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      if (coverUrl && !next.find((item) => item.url === coverUrl)) {
        setCoverUrl(next[0]?.url ?? null);
      }
      if (fieldName) setFieldValue(fieldName, next.map((m) => m.url));
      return next;
    });
  };

  const toggleAdType = (value: string) => {
    setAdTypes([value]);
  };

  const cancelSteps = () => {
    setAdTypes([]);
    setStepIndex(0);
    setAttemptedNext(false);
    setMaxUnlockedStep(0);
    setDynamic({});
  };

  const nextStep = () => {
    if (!canProceed) {
      setAttemptedNext(true);
      return;
    }
    setAttemptedNext(false);
    setMaxUnlockedStep((prev) => Math.max(prev, stepIndex + 1));
    setStepIndex((prev) => (prev < filteredSteps.length - 1 ? prev + 1 : prev));
  };

  const setFieldValue = (name: string, value: any) => {
    setDynamic((prev) => ({ ...prev, [name]: value }));
  };

  const toggleFieldOption = (name: string, value: string) => {
    const current = Array.isArray(dynamic[name]) ? dynamic[name] : [];
    const next = current.includes(value) ? current.filter((v: string) => v !== value) : [...current, value];
    setFieldValue(name, next);
  };

  const normalizeOptions = (raw: any): { value: string; label: string }[] => {
    const parsed = parseJsonValue(raw);
    if (!parsed) return [];
    if (Array.isArray(parsed)) {
      return parsed.map((item) => {
        if (item && typeof item === 'object') {
          const value = String(item.value ?? item.id ?? item.key ?? item.name ?? item.label ?? '');
          const label = String(item.label ?? item.name ?? item.title ?? formatOptionLabel(value));
          return { value, label };
        }
        const value = String(item);
        return { value, label: formatOptionLabel(value) };
      }).filter((opt) => opt.value);
    }
    if (typeof parsed === 'object') {
      return Object.entries(parsed).map(([key, val]) => {
        if (val && typeof val === 'object') {
          const value = String((val as any).value ?? key);
          const label = String((val as any).label ?? (val as any).name ?? (val as any).title ?? formatOptionLabel(key));
          return { value, label };
        }
        return {
          value: String(key),
          label: typeof val === 'string' ? String(val) : formatOptionLabel(key),
        };
      });
    }
    const value = String(parsed);
    return value ? [{ value, label: formatOptionLabel(value) }] : [];
  };

  const selectParent = (cat: CategoryTree) => {
    setParentSlug(cat.slug);
    if (!cat.children || cat.children.length === 0) {
      setChildSlug(cat.slug);
      setCategorySlug(cat.slug);
    } else {
      setChildSlug('');
      setCategorySlug('');
    }
    setAdTypes([]);
    setDynamic({});
    setFormSteps([]);
    setStepIndex(0);
    setAttemptedNext(false);
    setMaxUnlockedStep(0);
  };

  const clearParent = () => {
    setParentSlug('');
    setChildSlug('');
    setCategorySlug('');
    setAdTypes([]);
    setDynamic({});
    setFormSteps([]);
    setStepIndex(0);
    setAttemptedNext(false);
    setMaxUnlockedStep(0);
  };

  const selectChild = (cat: CategoryTree) => {
    setChildSlug(cat.slug);
    setCategorySlug(cat.slug);
    setAdTypes([]);
    setDynamic({});
    setStepIndex(0);
    setAttemptedNext(false);
    setMaxUnlockedStep(0);
  };

  const renderField = (field: FormField) => {
    const type = String(field.type || 'text').toLowerCase();
    const options = normalizeOptions(field.values);
    const value = dynamic[field.name];
    const disabled = Boolean(field.disabled);
    const required = isFieldRequired(field);
    if (isPhotoField(field)) {
      return (
        <div>
          <input
            ref={fileInputRef}
            className="input"
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => handleFiles(field.name, e)}
            disabled={disabled}
          />
          {uploading ? <div className="small" style={{ marginTop: 6 }}>{tx('Téléchargement…', 'Uploading…')}</div> : null}
          {uploadError ? <div className="small" style={{ marginTop: 6, color: 'var(--red)' }}>{tx('Erreur upload', 'Upload error')}: {String(uploadError?.error || uploadError?.message || uploadError)}</div> : null}
          {media.length ? (
            <div className="grid cols-3" style={{ marginTop: 10 }}>
              {media.map((m, idx) => {
                const preview = m.url.startsWith('http') ? m.url : `${API_BASE}${m.url}`;
                return (
                <div key={`${m.url}-${idx}`} className="panel pad" style={{ padding: 12, position: 'relative' }}>
                  <img src={preview} alt={m.name || tx('media', 'media')} style={{ width: '100%', height: 170, objectFit: 'cover', borderRadius: 12 }} />
                  <button
                    className="btn"
                    type="button"
                    onClick={() => setCoverUrl(m.url)}
                    disabled={coverUrl === m.url}
                    style={{
                      position: 'absolute',
                      top: 16,
                      right: 16,
                      padding: '6px 10px',
                      borderRadius: 999,
                      background: coverUrl === m.url ? 'var(--accent)' : 'rgba(15, 23, 42, 0.82)',
                      color: 'white',
                      fontSize: 12,
                      fontWeight: 700,
                      boxShadow: '0 8px 18px rgba(15, 23, 42, 0.25)',
                    }}
                  >
                    {coverUrl === m.url ? tx('Couverture', 'Cover') : tx('Définir couverture', 'Set cover')}
                  </button>
                  {coverUrl === m.url ? (
                    <div
                      className="small"
                      style={{
                        position: 'absolute',
                        top: 16,
                        left: 16,
                        background: 'rgba(255,255,255,0.9)',
                        padding: '4px 8px',
                        borderRadius: 999,
                        fontWeight: 700,
                      }}
                    >
                      ⭐ {tx('Couverture', 'Cover')}
                    </div>
                  ) : null}
                  <div className="small" style={{ marginTop: 6 }}>
                    {m.name || tx('Image', 'Image')}
                  </div>
                  <div className="row" style={{ gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                    <button className="btn ghost" type="button" onClick={() => removeMedia(idx, field.name)}>{tx('Supprimer', 'Remove')}</button>
                  </div>
                </div>
              );
            })}
            </div>
          ) : (
            <div className="small" style={{ marginTop: 6 }}>
              {required ? tx('Ajoutez au moins une photo.', 'Add at least one photo.') : tx('Aucune photo ajoutée.', 'No photos added.')}
            </div>
          )}
        </div>
      );
    }
    if (type === 'textarea') {
      return (
        <RichTextEditor
          value={value ?? ''}
          onChange={(next) => setFieldValue(field.name, next)}
          disabled={disabled}
          required={required}
        />
      );
    }
    if (type === 'text' && isCityField(field)) {
      return (
        <CitySearchInput
          value={value ?? city ?? ''}
          onChange={(next) => {
            setFieldValue(field.name, next);
            setCity(next);
          }}
          onSelect={(next) => {
            if (typeof next.lat === 'number' && typeof next.lng === 'number') {
              handleLocationChange({ lat: next.lat, lng: next.lng });
            }
          }}
          followInput
          disabled={disabled}
          required={required}
          placeholder={tx('Ville (Cameroun)', 'City (Cameroon)')}
        />
      );
    }
    if (type === 'number') {
      return (
        <input
          className="input"
          type="number"
          value={value ?? ''}
          onChange={(e) => setFieldValue(field.name, e.target.value === '' ? '' : Number(e.target.value))}
          disabled={disabled}
        />
      );
    }
    if (type === 'date') {
      return (
        <input
          className="input"
          type="date"
          value={value ?? ''}
          onChange={(e) => setFieldValue(field.name, e.target.value)}
          disabled={disabled}
        />
      );
    }
    if (type === 'select') {
      return (
        <Select
          className="input"
          value={value ?? ''}
          onChange={(next) => setFieldValue(field.name, next)}
          disabled={disabled}
          ariaLabel={field.label}
          options={[{ value: '', label: tx('Sélectionner', 'Select') }, ...options]}
        />
      );
    }
    if (type === 'radio') {
      return (
        <CustomRadioGroup
          name={field.name}
          options={options}
          value={value ?? ''}
          onChange={(next) => setFieldValue(field.name, next)}
          disabled={disabled}
          required={required}
        />
      );
    }
    if (type === 'multiselect' || (type === 'checkbox' && options.length)) {
      const selected = Array.isArray(value) ? value : [];
      return (
        <CustomCheckboxGroup
          name={field.name}
          options={options}
          values={selected.map((item) => String(item))}
          onToggle={(next) => toggleFieldOption(field.name, next)}
          disabled={disabled}
          required={required}
        />
      );
    }
    if (type === 'checkbox') {
      return (
        <CustomCheckbox
          label={field.label}
          checked={Boolean(value)}
          onChange={(next) => setFieldValue(field.name, next)}
          disabled={disabled}
          required={required}
        />
      );
    }
    return (
      <input
        className="input"
        value={value ?? ''}
        onChange={(e) => setFieldValue(field.name, e.target.value)}
        disabled={disabled}
      />
    );
  };

  async function save() {
    if (!id) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payloadDynamic = { ...dynamic, ad_type: adTypes };
      const orderedMedia = orderMediaByCover(media, coverUrl);
      await apiFetch(`/ads/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          title,
          description,
          country,
          city,
          categorySlug,
          dynamic: coverUrl ? { ...payloadDynamic, coverUrl } : payloadDynamic,
          media: orderedMedia.map((m) => ({ url: m.url, mime: m.mime, size: m.size, type: m.type })),
        }),
      });
      setSuccess(tx('Annonce mise à jour.', 'Listing updated.'));
      notifySuccess(tx('Annonce mise à jour.', 'Listing updated.'));
    } catch (e) {
      setError(e);
      notifyError(e, tx('Erreur lors de la mise à jour.', 'Unable to update listing.'));
    } finally {
      setSaving(false);
    }
  }

  const availableAdTypes = React.useMemo(() => {
    if (!categorySlug) return [];
    return extractAdTypes(selectedCategory?.extraFields, tx);
  }, [categorySlug, selectedCategory, tx]);
  const adTypesRequired = availableAdTypes.length > 0;
  const showAdTypes = Boolean(childSlug) || (Boolean(categorySlug) && childCats.length === 0);
  const canSubmit = !saving && !uploading && Boolean(title) && Boolean(categorySlug) && (!adTypesRequired || adTypes.length > 0);
  const activeFlows = React.useMemo(() => {
    const flows = adTypes.flatMap((t) => AD_TYPE_FLOW[String(t).toUpperCase()] || [String(t).toLowerCase()]);
    return flows.map((f) => f.toLowerCase());
  }, [adTypes]);
  const filteredSteps = React.useMemo(() => {
    if (!activeFlows.length) return formSteps;
    return formSteps.filter((s) => {
      const flow = String(s.flow || '').toLowerCase().trim();
      if (!flow) return false;
      const flowTokens = flow.split(/[\s,|/]+/).filter(Boolean);
      return flowTokens.some((token) => activeFlows.includes(token));
    });
  }, [formSteps, activeFlows]);
  const activeStep = React.useMemo(() => {
    if (filteredSteps.length === 0) return null;
    return filteredSteps[Math.min(stepIndex, filteredSteps.length - 1)];
  }, [filteredSteps, stepIndex]);
  const missingRequired = React.useMemo(() => {
    if (!activeStep?.fields) return [];
    return activeStep.fields.filter((field) => isFieldRequired(field) && !isFieldFilled(field, dynamic[field.name], media.length));
  }, [activeStep, dynamic, media.length]);
  const canProceed = missingRequired.length === 0;
  const autoMaxCompleted = React.useMemo(() => {
    if (filteredSteps.length === 0) return -1;
    let max = -1;
    for (const step of filteredSteps) {
      const fields = step.fields || [];
      const missing = fields.filter((field) => isFieldRequired(field) && !isFieldFilled(field, dynamic[field.name], media.length));
      if (missing.length > 0) break;
      max += 1;
    }
    return max;
  }, [filteredSteps, dynamic, media.length]);
  const unlockedStep = Math.max(maxUnlockedStep, autoMaxCompleted + 1, 0);
  const isLastStep = stepIndex >= filteredSteps.length - 1;

  const locationFields = React.useMemo(() => getLocationFieldKeys(activeStep?.fields), [activeStep]);
  const locationValue = React.useMemo(
    () => resolveLocationValue(dynamic, locationFields),
    [dynamic, locationFields]
  );
  const showLocationMap = isLocationStep(activeStep);

  const handleLocationChange = (next: { lat: number; lng: number }) => {
    if (locationFields.lat) setFieldValue(locationFields.lat, next.lat);
    if (locationFields.lng) setFieldValue(locationFields.lng, next.lng);
    if (!locationFields.lat && !locationFields.lng) {
      const key = locationFields.location || 'location';
      setFieldValue(key, { lat: next.lat, lng: next.lng });
    }
  };

  if (loading) {
    return (
      <div className="pageLoading">
        <div className="panel pad">{tx('Chargement…', 'Loading…')}</div>
      </div>
    );
  }

  return (
    <div className="panel pad">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <h1 className="h1">{tx('Modifier une annonce', 'Edit a listing')}</h1>
          <div className="small">{tx('Mettez à jour vos catégories, étapes et champs.', 'Update your categories, steps, and fields.')}</div>
        </div>
      </div>

      <div style={{ height: 12 }} />
      {success ? <div className="small" style={{ color: 'var(--green)' }}>{success}</div> : null}
      {error ? (
        <div className="small" style={{ color: 'var(--red)' }}>
          <b>{tx('Erreur', 'Error')}:</b> {String(error?.error || error?.message || error)}
        </div>
      ) : null}

      <div style={{ height: 12 }} />
      <div className="h2">{tx('Catégorie', 'Category')}</div>
      <div className="small">{tx('Choisissez la catégorie principale.', 'Choose the main category.')}</div>
      <div style={{ height: 8 }} />
      {parentCats.length === 0 ? (
        <div className="panel pad">{tx('Aucune catégorie.', 'No categories.')}</div>
      ) : !selectedParent ? (
        <div className="grid cols-4">
          {parentCats.map((c) => {
            const active = parentSlug === c.slug;
            return (
              <button
                key={c.slug}
                type="button"
                className="panel pad"
                style={{
                  aspectRatio: '1 / 1',
                  padding: 12,
                  textAlign: 'left',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  borderColor: active ? 'var(--accent)' : c.color || undefined,
                  background: c.gradient || (c.color ? `linear-gradient(135deg, ${c.color}1a, transparent)` : undefined),
                  cursor: 'pointer',
                }}
                onClick={() => selectParent(c)}
              >
                <div className="row" style={{ gap: 10, alignItems: 'center' }}>
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 12,
                      display: 'grid',
                      placeItems: 'center',
                      fontSize: 18,
                      fontWeight: 700,
                      color: c.color || 'var(--text)',
                      background: c.gradient || (c.color ? `${c.color}26` : 'var(--panel2)'),
                      border: `1px solid ${c.color || 'rgba(15, 23, 42, 0.12)'}`,
                    }}
                  >
                    {c.icon || '📌'}
                  </div>
                  <div>
                    <div style={{ fontWeight: 800 }}>{c.name}</div>
                    <div className="small">{c.children?.length || 0} {tx('sous-catégories', 'subcategories')}</div>
                  </div>
                </div>
                {c.description ? <div className="small" style={{ marginTop: 8 }}>{c.description}</div> : null}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="panel pad" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div className="row" style={{ gap: 10, alignItems: 'center' }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 14,
                display: 'grid',
                placeItems: 'center',
                fontSize: 20,
                fontWeight: 700,
                color: selectedParent.color || 'var(--text)',
                background: selectedParent.gradient || (selectedParent.color ? `${selectedParent.color}26` : 'var(--panel2)'),
                border: `1px solid ${selectedParent.color || 'rgba(15, 23, 42, 0.12)'}`,
              }}
            >
              {selectedParent.icon || '📌'}
            </div>
            <div>
              <div style={{ fontWeight: 800 }}>{selectedParent.name}</div>
              <div className="small">{selectedParent.children?.length || 0} {tx('sous-catégories', 'subcategories')}</div>
            </div>
          </div>
          <button className="btn ghost" type="button" onClick={clearParent}>{tx('Changer', 'Change')}</button>
        </div>
      )}

      {selectedParent ? (
        <>
          <div style={{ height: 12 }} />
          <div className="h2">{tx('Sous-catégorie', 'Subcategory')}</div>
          <div className="small">{tx('Sélectionnez une sous-catégorie.', 'Select a subcategory.')}</div>
          <div style={{ height: 8 }} />
          {childCats.length === 0 ? (
            <div className="panel pad">{tx('Aucune sous-catégorie. Cette catégorie sera utilisée.', 'No subcategories. This category will be used.')}</div>
          ) : (
            <div className="grid cols-4">
              {childCats.map((c) => {
                const active = childSlug === c.slug;
                return (
                  <button
                    key={c.slug}
                    type="button"
                    className="panel pad"
                    style={{
                      aspectRatio: '1 / 1',
                      padding: 12,
                      textAlign: 'left',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      borderColor: active ? 'var(--accent)' : c.color || undefined,
                      background: c.gradient || (c.color ? `linear-gradient(135deg, ${c.color}1a, transparent)` : undefined),
                      cursor: 'pointer',
                    }}
                    onClick={() => selectChild(c)}
                  >
                    <div className="row" style={{ gap: 10, alignItems: 'center' }}>
                      <div
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: 10,
                          display: 'grid',
                          placeItems: 'center',
                          fontSize: 16,
                          fontWeight: 700,
                          color: c.color || 'var(--text)',
                          background: c.gradient || (c.color ? `${c.color}26` : 'var(--panel2)'),
                          border: `1px solid ${c.color || 'rgba(15, 23, 42, 0.12)'}`,
                        }}
                      >
                        {c.icon || '📌'}
                      </div>
                      <div>
                        <div style={{ fontWeight: 800 }}>{c.name}</div>
                        <div className="small">{c.slug}</div>
                      </div>
                    </div>
                    {c.description ? <div className="small" style={{ marginTop: 8 }}>{c.description}</div> : null}
                  </button>
                );
              })}
            </div>
          )}
        </>
      ) : null}

      {showAdTypes ? (
        <>
          <div style={{ height: 12 }} />
          <div className="h2">{tx('Type d’annonce', 'Listing type')}</div>
          <div className="small">{tx('Choisissez le type d’annonce.', 'Choose the listing type.')}</div>
          <div style={{ height: 8 }} />
          {formLoading ? (
            <div className="panel pad">{tx('Chargement des types d’annonce…', 'Loading listing types…')}</div>
          ) : availableAdTypes.length === 0 ? (
            <div className="panel pad">{tx('Aucun type d’annonce défini pour cette catégorie.', 'No listing types defined for this category.')}</div>
          ) : (
            <CustomRadioGroup
              name="ad-type-edit"
              options={availableAdTypes.map((t) => ({
                value: t.value,
                label: t.label,
                description: t.description,
              }))}
              value={adTypes[0] ?? ''}
              onChange={toggleAdType}
              disabled={formLoading}
              required
            />
          )}

          {adTypes.length > 0 ? (
            <>
              <div className="divider" />
              <div className="h2">{tx('Étapes', 'Steps')}</div>
              <div className="small">{tx('Naviguez entre les étapes terminées.', 'Navigate through completed steps.')}</div>
              <div style={{ height: 8 }} />
              {filteredSteps.length === 0 ? (
                <div className="panel pad">{tx('Aucune étape pour ce type d’annonce.', 'No steps for this listing type.')}</div>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                    gap: 10,
                  }}
                >
                  {filteredSteps.map((step, idx) => {
                    const locked = idx > unlockedStep;
                    const active = idx === stepIndex;
                    const done = idx < unlockedStep;
                    return (
                      <button
                        key={step.id}
                        type="button"
                        className="panel pad"
                        disabled={locked}
                        onClick={() => {
                          if (locked) return;
                          setStepIndex(idx);
                        }}
                        style={{
                          aspectRatio: '1 / 1',
                          textAlign: 'left',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          borderColor: active ? 'var(--accent)' : done ? 'rgba(15, 23, 42, 0.25)' : 'rgba(15, 23, 42, 0.12)',
                          background: active ? 'var(--panel2)' : 'var(--panel)',
                          opacity: locked ? 0.5 : 1,
                          cursor: locked ? 'not-allowed' : 'pointer',
                        }}
                      >
                        <div style={{ fontWeight: 800 }}>{tx('Étape', 'Step')} {idx + 1}</div>
                        <div className="small" style={{ marginTop: 6 }}>{step.label}</div>
                        <div className="small" style={{ marginTop: 10 }}>
                          {locked ? tx('🔒 Verrouillée', '🔒 Locked') : done ? tx('✓ Terminée', '✓ Done') : tx('En cours', 'In progress')}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              <div style={{ height: 12 }} />
              <div className="h2">{tx('Étape', 'Step')} {filteredSteps.length ? Math.min(stepIndex + 1, filteredSteps.length) : 1}</div>
              <div className="small">{tx('Complétez les champs de l’étape en cours.', 'Fill in the fields for the current step.')}</div>
              <div style={{ height: 8 }} />
              {formLoading ? (
                <div className="panel pad">{tx('Chargement du formulaire…', 'Loading form…')}</div>
              ) : formError ? (
                <div className="panel pad">{formError}</div>
              ) : !activeStep ? (
                <div className="panel pad">{tx('Aucune étape pour ce type d’annonce.', 'No steps for this listing type.')}</div>
              ) : (
                <div className="panel pad">
              <div className="h2">{activeStep.label}</div>
              {Array.isArray(activeStep.info) && activeStep.info.length ? (
                <div className="small" style={{ marginTop: 6 }}>{activeStep.info.join(' · ')}</div>
              ) : null}
              {(activeStep.fields || []).length === 0 ? (
                <div className="small">{tx('Aucun champ pour cette étape.', 'No fields for this step.')}</div>
              ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                      {orderFields(activeStep.fields || []).map((field) => {
                        const type = String(field.type || 'text').toLowerCase();
                        const halfWidth = type === 'text' || type === 'select' || type === 'number';
                        return (
                          <div key={field.id} style={{ flex: halfWidth ? '0 1 calc(50% - 6px)' : '1 1 100%' }}>
                            {field.type !== 'checkbox' || (Array.isArray(field.values) && field.values.length) ? (
                              <div className="small">{field.label}</div>
                            ) : null}
                            {renderField(field)}
                            {field.unit ? <div className="small" style={{ marginTop: 6 }}>{field.unit}</div> : null}
                          </div>
                        );
                  })}
                </div>
              )}
              {showLocationMap ? (
                <div style={{ marginTop: 16 }}>
                  <MapboxPicker value={locationValue} onChange={handleLocationChange} />
                  <div className="small" style={{ marginTop: 6 }}>
                    {tx('Position', 'Position')}: {locationValue.lat.toFixed(5)}, {locationValue.lng.toFixed(5)}
                  </div>
                </div>
              ) : null}
              {attemptedNext && !canProceed ? (
                <div className="small" style={{ marginTop: 10, color: 'var(--red)' }}>
                  {tx('Champs obligatoires manquants.', 'Missing required fields.')}
                </div>
                  ) : null}
                  <div style={{ height: 12 }} />
                  <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                    <button className="btn ghost" type="button" onClick={cancelSteps}>{tx('Annuler', 'Cancel')}</button>
                    <button className="btn primary" type="button" onClick={nextStep} disabled={!canProceed || isLastStep}>
                      {tx('Étape suivante', 'Next step')}
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </>
      ) : null}

      <div style={{ height: 12 }} />
      <button className="btn primary" type="button" onClick={save} disabled={!canSubmit}>
        {saving ? tx('Mise à jour…', 'Updating…') : tx('Enregistrer', 'Save')}
      </button>
    </div>
  );
}

export function D_AdsPreview() {
  const { tx } = useI18n();
  return (
    <div className="panel pad">
      <h1 className="h1">{tx('Aperçu', 'Preview')}</h1>
      <div className="small">{tx('Sélectionnez une annonce pour l’aperçu.', 'Select a listing to preview.')}</div>
    </div>
  );
}

export function D_AdsStats() {
  const { tx } = useI18n();
  return (
    <div className="panel pad">
      <h1 className="h1">{tx('Statistiques', 'Stats')}</h1>
      <div className="small">{tx('Vues, clics WhatsApp, etc.', 'Views, WhatsApp clicks, etc.')}</div>
    </div>
  );
}

export function D_Favorites() {
  const { tx } = useI18n();
  return (
    <div className="panel pad">
      <h1 className="h1">{tx('Favoris', 'Favorites')}</h1>
      <div className="small">{tx('Aucune annonce en favori.', 'No favorite listings yet.')}</div>
    </div>
  );
}

export function D_BoostsActive(){
  const { tx } = useI18n();
  return (
    <div className="panel pad">
      <h1 className="h1">{tx('Boosts actifs', 'Active boosts')}</h1>
      <div className="small">{tx('Les boosts actifs sont visibles dans chaque annonce (badges) et sur la page annonce.', 'Active boosts are visible on each listing (badges) and on the listing page.')}</div>
      <div style={{ height: 10 }} />
      <a className="btn" href="/dashboard/ads/list">{tx('Voir mes annonces', 'View my listings')}</a>
    </div>
  );
}

export function D_BoostBuy(){
  const { tx, lang } = useI18n();
  const adId = (window.location.pathname.split('/').pop() || '').trim();
  const [type, setType] = React.useState<'VIP'|'URGENT'|'TOP'|'HOME'>('VIP');
  const [durationHours, setDurationHours] = React.useState(24);
  const [cfg, setCfg] = React.useState<any | null>(null);
  const [ad, setAd] = React.useState<any | null>(null);
  const [err, setErr] = React.useState<any>(null);
  const [ok, setOk] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(false);
  const locale = lang === 'fr' ? 'fr-FR' : 'en-US';

  React.useEffect(() => {
    apiFetch(`/ads/${adId}`).then(setAd).catch(setErr);
  }, [adId]);

  React.useEffect(() => {
    if (!ad) return;
    const qs = new URLSearchParams({
      country: String(ad.country || 'CM'),
      categorySlug: String(ad.categorySlug || ''),
      type,
      durationHours: String(durationHours),
    });
    apiFetch(`/monetization/boost-config?${qs.toString()}`).then(setCfg).catch(setErr);
  }, [ad, type, durationHours]);

  return (
    <div className="panel pad">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <h1 className="h1">{tx('Booster une annonce', 'Boost a listing')}</h1>
          <div className="small">{tx('Choisis un boost (VIP / URGENT / TOP / HOME) et une durée. Paiement via crédits.', 'Choose a boost (VIP / URGENT / TOP / HOME) and a duration. Payment with credits.')}</div>
        </div>
        <a className="btn" href="/dashboard/ads/list">← {tx('Retour', 'Back')}</a>
      </div>
      <div style={{ height: 12 }} />

      {err ? <div className="small" style={{ color: 'var(--red)' }}>{tx('Erreur', 'Error')}: {String(err?.error || err?.message || err)}</div> : null}
      {!ad ? <div className="small">{tx('Chargement annonce…', 'Loading listing…')}</div> : (
        <div className="panel pad">
          <div style={{ fontWeight: 900 }}>{ad.title}</div>
          <div className="small">{ad.city}, {ad.country} — {ad.categorySlug}</div>
        </div>
      )}

      <div style={{ height: 12 }} />
      <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 240 }}>
          <div className="small">{tx('Type de boost', 'Boost type')}</div>
          <Select
            className="input"
            value={type}
            onChange={(next) => setType(next as any)}
            ariaLabel={tx('Type de boost', 'Boost type')}
            options={[
              { value: 'VIP', label: tx('VIP', 'VIP') },
              { value: 'URGENT', label: tx('Urgent', 'Urgent') },
              { value: 'TOP', label: tx('Top', 'Top') },
              { value: 'HOME', label: tx('Accueil', 'Home') }
            ]}
          />
        </div>
        <div style={{ minWidth: 240 }}>
          <div className="small">{tx('Durée', 'Duration')}</div>
          <Select
            className="input"
            value={String(durationHours)}
            onChange={(next) => setDurationHours(parseInt(next, 10))}
            ariaLabel={tx('Durée', 'Duration')}
            options={[
              { value: '24', label: tx('24h', '24h') },
              { value: '72', label: tx('3 jours', '3 days') },
              { value: '168', label: tx('7 jours', '7 days') }
            ]}
          />
        </div>
      </div>

      <div style={{ height: 12 }} />
      {cfg ? (
        <div className="panel pad">
          <div className="small">{tx('Coût estimé', 'Estimated cost')}</div>
          <div style={{ fontSize: 32, fontWeight: 900, lineHeight: 1.05 }}>{cfg.costCredits} {tx('crédits', 'credits')}</div>
          <div className="small" style={{ opacity: 0.75 }}>{tx('Base', 'Base')}: {cfg.baseCreditsCost} {tx('crédits', 'credits')} / 24h · {tx('Action', 'Action')}: {cfg.action}</div>
        </div>
      ) : null}

      <div style={{ height: 12 }} />
      {ok ? <div className="small" style={{ color: 'var(--green)' }}>{tx('Boost activé jusqu’au', 'Boost active until')} {new Date(ok.endAt).toLocaleString(locale)} ✅</div> : null}
      <button
        className="btn primary"
        disabled={loading || !ad}
        onClick={async () => {
          setLoading(true);
          setErr(null);
          setOk(null);
          try {
            const r = await apiFetch(`/ads/${adId}/boost`, { method: 'POST', body: JSON.stringify({ type, durationHours }) });
            setOk(r);
          } catch (e: any) {
            setErr(e);
          } finally {
            setLoading(false);
          }
        }}
      >{loading ? tx('Activation…', 'Activating…') : tx('Activer le boost', 'Activate boost')}</button>
    </div>
  );
}
