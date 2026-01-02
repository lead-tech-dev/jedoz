export const rateLimitPresets = {
  AUTH_REGISTER: { windowSeconds: 60 * 10, max: 5 },
  AUTH_LOGIN: { windowSeconds: 60 * 5, max: 15 },
  ADS_CREATE: { windowSeconds: 60 * 10, max: 20 },
  PAYMENTS_INIT: { windowSeconds: 60 * 5, max: 15 },
  DEFAULT: { windowSeconds: 60, max: 60 },
};
