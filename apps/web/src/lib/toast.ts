import toast from 'react-hot-toast';

function resolveLang() {
  try {
    const stored = localStorage.getItem('lodix_lang');
    return stored === 'en' || stored === 'fr' ? stored : 'fr';
  } catch {
    return 'fr';
  }
}

export function formatError(err: any, fallback?: string) {
  const lang = resolveLang();
  const defaultFallback = lang === 'fr' ? 'Une erreur est survenue.' : 'An error occurred.';
  const finalFallback = fallback || defaultFallback;
  if (!err) return finalFallback;
  if (typeof err === 'string') return err;
  return err.error || err.message || finalFallback;
}

export function notifySuccess(message: string) {
  toast.success(message);
}

export function notifyError(err: any, fallback?: string) {
  toast.error(formatError(err, fallback));
}

export function notifyInfo(message: string) {
  toast(message);
}

export { toast };
