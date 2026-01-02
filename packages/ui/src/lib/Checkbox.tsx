import React from 'react';
import '../styles/index.scss';

export function Checkbox(props: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
  children?: React.ReactNode;
  className?: string;
  labelClassName?: string;
  disabled?: boolean;
  required?: boolean;
  ariaLabel?: string;
}) {
  const label = props.label ?? props.children;
  const className = `checkbox${props.checked ? ' checked' : ''}${props.className ? ` ${props.className}` : ''}`;
  const ariaLabel =
    props.ariaLabel || (typeof label === 'string' && label.length ? label : undefined);

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={props.checked}
      aria-required={props.required}
      aria-label={ariaLabel}
      className={className}
      disabled={props.disabled}
      onClick={() => {
        if (props.disabled) return;
        props.onChange(!props.checked);
      }}
    >
      <span className={`checkboxLabel${props.labelClassName ? ` ${props.labelClassName}` : ''}`}>
        {label}
      </span>
      <span className="checkboxBox" aria-hidden="true" />
    </button>
  );
}
