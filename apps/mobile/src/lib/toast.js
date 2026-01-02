import Toast from 'react-native-toast-message';

export function notifySuccess(message) {
  Toast.show({ type: 'success', text1: message });
}

export function notifyError(error, fallback = 'Une erreur est survenue.') {
  const message = typeof error === 'string' ? error : (error?.error || error?.message || fallback);
  Toast.show({ type: 'error', text1: message });
}

export function notifyInfo(message) {
  Toast.show({ type: 'info', text1: message });
}
