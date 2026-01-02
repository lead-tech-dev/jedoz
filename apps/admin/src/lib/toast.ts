import toast from 'react-hot-toast';

export function formatError(err: any, fallback = 'Une erreur est survenue.') {
  if (!err) return fallback;
  if (typeof err === 'string') return err;
  return err.error || err.message || fallback;
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
