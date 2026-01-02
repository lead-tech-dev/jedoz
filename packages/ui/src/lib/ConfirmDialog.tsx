import React from 'react';
import '../styles/index.scss';

export function ConfirmDialog(props: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!props.open) return null;

  return (
    <div
      className="modalOverlay"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) props.onCancel();
      }}
    >
      <div className="modalCard" role="dialog" aria-modal="true" aria-label={props.title}>
        <div className="modalTitle">{props.title}</div>
        {props.description ? <div className="modalBody">{props.description}</div> : null}
        <div className="modalActions">
          <button className="btn ghost" type="button" onClick={props.onCancel}>
            {props.cancelLabel ?? 'Annuler'}
          </button>
          <button className="btn primary" type="button" onClick={props.onConfirm} disabled={props.confirmDisabled}>
            {props.confirmLabel ?? 'Confirmer'}
          </button>
        </div>
      </div>
    </div>
  );
}
