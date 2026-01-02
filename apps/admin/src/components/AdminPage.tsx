import React from 'react';

export function AdminPage(props: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="adminPage">
      <div className="panel pad adminPageHeader">
        <div className="adminPageHeaderRow">
          <div>
            <h1 className="h1">{props.title}</h1>
            {props.subtitle ? <div className="small">{props.subtitle}</div> : null}
          </div>
          {props.actions ? <div className="row" style={{ flexWrap: 'wrap' }}>{props.actions}</div> : null}
        </div>
      </div>
      {props.children}
    </div>
  );
}

export function AdminSection(props: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="panel pad adminSection">
      <div className="section-title adminSectionHeader">
        <div>
          <div className="h2">{props.title}</div>
          {props.subtitle ? <div className="small">{props.subtitle}</div> : null}
        </div>
        {props.actions ? <div className="row" style={{ flexWrap: 'wrap' }}>{props.actions}</div> : null}
      </div>
      {props.children ? <div style={{ height: 12 }} /> : null}
      {props.children}
    </div>
  );
}
