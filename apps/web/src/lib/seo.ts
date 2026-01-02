import { useEffect } from 'react';

function setMeta(name: string, content: string) {
  if (!content) return;
  let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('name', name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setOg(property: string, content: string) {
  if (!content) return;
  let el = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('property', property);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

export function useSeo(opts: {
  title?: string;
  description?: string;
  canonicalPath?: string;
  ogImage?: string;
}) {
  useEffect(() => {
    const base = 'JEDOZ - Marketplace';
    const title = opts.title ? `${opts.title} • ${base}` : base;
    document.title = title;

    if (opts.description) {
      setMeta('description', opts.description);
      setOg('og:description', opts.description);
    }

    setOg('og:title', title);
    setOg('og:type', 'website');

    // Canonical
    if (opts.canonicalPath) {
      const href = `${window.location.origin}${opts.canonicalPath}`;
      let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement('link');
        link.setAttribute('rel', 'canonical');
        document.head.appendChild(link);
      }
      link.setAttribute('href', href);
      setOg('og:url', href);
    }

    if (opts.ogImage) {
      setOg('og:image', opts.ogImage);
    }
  }, [opts.title, opts.description, opts.canonicalPath, opts.ogImage]);
}
