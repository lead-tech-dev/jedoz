import React from 'react';
import '../styles/index.scss';

export type SelectOption = { value: string | number; label: string; disabled?: boolean };

function normalizeOptions(options: SelectOption[]) {
  return options.map((opt) => ({
    value: String(opt.value ?? ''),
    label: String(opt.label ?? ''),
    disabled: Boolean(opt.disabled),
  }));
}

function extractOptions(children: React.ReactNode): SelectOption[] {
  const out: SelectOption[] = [];
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    if (child.type === React.Fragment) {
      out.push(...extractOptions(child.props.children));
      return;
    }
    if (child.type === 'option') {
      const value = child.props.value ?? '';
      const label =
        typeof child.props.children === 'string'
          ? child.props.children
          : String(child.props.children ?? value ?? '');
      out.push({ value: String(value), label, disabled: Boolean(child.props.disabled) });
    }
  });
  return out;
}

export function Select(props: {
  value: string | number;
  onChange: (value: string) => void;
  options?: SelectOption[];
  children?: React.ReactNode;
  className?: string;
  wrapClassName?: string;
  style?: React.CSSProperties;
  placeholder?: string;
  ariaLabel?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const wrapRef = React.useRef<HTMLDivElement | null>(null);
  const options = React.useMemo(() => {
    if (props.options) return normalizeOptions(props.options);
    return extractOptions(props.children);
  }, [props.options, props.children]);
  const value = String(props.value ?? '');
  const current = options.find((opt) => opt.value === value);
  const label = current?.label ?? props.placeholder ?? options[0]?.label ?? '';

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (!wrapRef.current || !event.target) return;
      if (!wrapRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener('mousedown', onDoc);
    return () => window.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div
      ref={wrapRef}
      className={`selectWrap${open ? ' open' : ''}${props.wrapClassName ? ` ${props.wrapClassName}` : ''}`}
      style={props.style}
    >
      <button
        type="button"
        className={`${props.className ?? ''} selectInput`.trim()}
        aria-label={props.ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={props.disabled}
        onClick={() => {
          if (props.disabled) return;
          setOpen((prev) => !prev);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false);
          if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span className={current ? '' : 'muted'}>{label}</span>
      </button>
      {open ? (
        <div className="selectMenu" role="listbox">
          {options.map((opt) => (
            <button
              key={`${opt.value}-${opt.label}`}
              type="button"
              role="option"
              aria-selected={opt.value === value}
              className={`selectOption${opt.value === value ? ' active' : ''}`}
              disabled={opt.disabled}
              onClick={() => {
                if (opt.disabled) return;
                props.onChange(opt.value);
                setOpen(false);
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
