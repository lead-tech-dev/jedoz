import React from 'react';

type Lang = 'fr' | 'en';
type Dictionary = Record<string, string | Dictionary>;
type TFunc = (key: string, vars?: Record<string, string | number>) => string;

type I18nContextValue = {
  lang: Lang;
  setLang: (next: Lang) => void;
  t: TFunc;
  tx: (fr: string, en: string) => string;
};

const LANG_STORAGE_KEY = 'lodix_lang';

const translations: Record<Lang, Dictionary> = {
  fr: {
    nav: {
      categories: 'Catégories',
      packs: 'Packs',
      becomePro: 'Devenir PRO',
      help: 'Aide',
      dashboard: 'Dashboard',
      profile: 'Mon profil',
      ads: 'Mes annonces',
      messages: 'Messages',
      support: 'Support',
      credits: 'Crédits',
      pro: 'PRO'
    },
    header: {
      account: 'Mon compte',
      login: 'Connexion',
      deposit: 'Déposer',
      logout: 'Déconnexion'
    },
    footer: {
      brandDesc: 'Plateforme 18+ d’annonces & rencontres. Publiez, boostez, gérez vos annonces depuis votre dashboard.',
      product: 'Produit',
      categories: 'Catégories',
      search: 'Recherche',
      postAd: 'Déposer une annonce',
      becomePro: 'Devenir PRO',
      security: 'Sécurité',
      tips: 'Conseils & aide',
      report: 'Signaler',
      moderation: 'Charte modération',
      legal: 'Légal',
      terms: 'CGU',
      privacy: 'Confidentialité',
      cookies: 'Cookies',
      rights: '© {year} — 18+',
      packs: 'Packs',
      boost: 'Boost',
      pro: 'PRO'
    },
    auth: {
      errorTitle: 'Impossible',
      loginTitle: 'Connexion',
      loginSubtitle: 'Connecte-toi pour accéder au dashboard, acheter des crédits et publier des annonces.',
      emailOrPhone: 'Email, téléphone ou pseudo',
      password: 'Mot de passe',
      loginLoading: 'Connexion...',
      loginButton: 'Se connecter',
      forgotPassword: 'Mot de passe oublié',
      noAccount: "Vous n'avez pas encore de compte ?",
      createAccount: 'Créer un compte',
      loginSuccess: 'Connexion réussie.',
      loginFailed: 'Connexion impossible.',
      registerTitle: 'Inscription',
      registerSubtitle: 'Crée ton compte et achète des crédits pour booster tes annonces.',
      username: 'Pseudo',
      city: 'Ville',
      emailOptional: 'Email (optionnel)',
      phoneOptional: 'Téléphone (optionnel)',
      country: 'Pays (ex: CM)',
      registerLoading: 'Création...',
      registerButton: 'Créer un compte',
      haveAccount: 'Déjà un compte ?',
      loginLink: 'Se connecter',
      registerSuccess: 'Compte créé avec succès.',
      registerFailed: 'Inscription impossible.',
      forgotTitle: 'Mot de passe oublié',
      forgotDesc: 'Entrez votre email, téléphone ou pseudo pour recevoir un lien de réinitialisation.',
      forgotLabel: 'Email, téléphone ou pseudo',
      forgotButton: 'Envoyer le lien',
      forgotHint: "Si un compte existe, un lien de réinitialisation sera généré.",
      forgotSuccess: 'Lien de réinitialisation généré.',
      resetTitle: 'Nouveau mot de passe',
      resetToken: 'Token: {token}',
      resetDesc: 'Choisissez un nouveau mot de passe pour votre compte.',
      resetNewPassword: 'Nouveau mot de passe',
      resetConfirmPassword: 'Confirmer le mot de passe',
      resetButton: 'Réinitialiser',
      resetSuccess: 'Mot de passe mis à jour.',
      resetFailed: 'Réinitialisation impossible.',
      resetMismatch: 'Les mots de passe ne correspondent pas.',
      verifyEmailTitle: 'Vérification email',
      verifyPhoneTitle: 'Vérification téléphone',
      verifyPhoneDesc: 'Un code de vérification sera envoyé.',
      completeProfileTitle: 'Compléter profil',
      completeProfileDesc: 'Finalise ton profil pour activer toutes les fonctionnalités.'
    },
    lang: {
      label: 'Langue',
      fr: 'FR',
      en: 'EN'
    },
    theme: {
      light: 'Mode clair',
      dark: 'Mode sombre'
    }
  },
  en: {
    nav: {
      categories: 'Categories',
      packs: 'Packs',
      becomePro: 'Go PRO',
      help: 'Help',
      dashboard: 'Dashboard',
      profile: 'My profile',
      ads: 'My ads',
      messages: 'Messages',
      support: 'Support',
      credits: 'Credits',
      pro: 'PRO'
    },
    header: {
      account: 'My account',
      login: 'Log in',
      deposit: 'Post ad',
      logout: 'Log out'
    },
    footer: {
      brandDesc: '18+ classifieds & meetings platform. Publish, boost, and manage your ads from your dashboard.',
      product: 'Product',
      categories: 'Categories',
      search: 'Search',
      postAd: 'Post an ad',
      becomePro: 'Go PRO',
      security: 'Security',
      tips: 'Tips & help',
      report: 'Report',
      moderation: 'Moderation charter',
      legal: 'Legal',
      terms: 'Terms',
      privacy: 'Privacy',
      cookies: 'Cookies',
      rights: '© {year} — 18+',
      packs: 'Packs',
      boost: 'Boost',
      pro: 'PRO'
    },
    auth: {
      errorTitle: 'Error',
      loginTitle: 'Log in',
      loginSubtitle: 'Log in to access your dashboard, buy credits, and publish ads.',
      emailOrPhone: 'Email, phone, or username',
      password: 'Password',
      loginLoading: 'Logging in...',
      loginButton: 'Log in',
      forgotPassword: 'Forgot password',
      noAccount: "Don't have an account?",
      createAccount: 'Create account',
      loginSuccess: 'Login successful.',
      loginFailed: 'Login failed.',
      registerTitle: 'Sign up',
      registerSubtitle: 'Create your account and buy credits to boost your ads.',
      username: 'Username',
      city: 'City',
      emailOptional: 'Email (optional)',
      phoneOptional: 'Phone (optional)',
      country: 'Country (e.g. CM)',
      registerLoading: 'Creating...',
      registerButton: 'Create account',
      haveAccount: 'Already have an account?',
      loginLink: 'Log in',
      registerSuccess: 'Account created successfully.',
      registerFailed: 'Registration failed.',
      forgotTitle: 'Forgot password',
      forgotDesc: 'Enter your email, phone, or username to receive a reset link.',
      forgotLabel: 'Email, phone, or username',
      forgotButton: 'Send reset link',
      forgotHint: 'If an account exists, a reset link will be generated.',
      forgotSuccess: 'Reset link generated.',
      resetTitle: 'New password',
      resetToken: 'Token: {token}',
      resetDesc: 'Choose a new password for your account.',
      resetNewPassword: 'New password',
      resetConfirmPassword: 'Confirm password',
      resetButton: 'Reset password',
      resetSuccess: 'Password updated.',
      resetFailed: 'Reset failed.',
      resetMismatch: 'Passwords do not match.',
      verifyEmailTitle: 'Email verification',
      verifyPhoneTitle: 'Phone verification',
      verifyPhoneDesc: 'A verification code will be sent.',
      completeProfileTitle: 'Complete profile',
      completeProfileDesc: 'Complete your profile to unlock all features.'
    },
    lang: {
      label: 'Language',
      fr: 'FR',
      en: 'EN'
    },
    theme: {
      light: 'Light mode',
      dark: 'Dark mode'
    }
  }
};

function lookup(dict: Dictionary, key: string): string | Dictionary | undefined {
  return key.split('.').reduce<any>((acc, part) => (acc && typeof acc === 'object' ? acc[part] : undefined), dict);
}

function interpolate(value: string, vars?: Record<string, string | number>) {
  if (!vars) return value;
  return value.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? `{${key}}`));
}

const I18nContext = React.createContext<I18nContextValue>({
  lang: 'fr',
  setLang: () => {},
  t: (key) => key,
  tx: (fr) => fr
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = React.useState<Lang>(() => {
    try {
      const stored = localStorage.getItem(LANG_STORAGE_KEY);
      if (stored === 'en' || stored === 'fr') return stored;
    } catch {}
    return 'fr';
  });

  const setLang = React.useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(LANG_STORAGE_KEY, next);
    } catch {}
  }, []);

  const t = React.useCallback<TFunc>(
    (key, vars) => {
      const raw = lookup(translations[lang], key);
      if (!raw || typeof raw !== 'string') return key;
      return interpolate(raw, vars);
    },
    [lang]
  );

  const tx = React.useCallback((fr: string, en: string) => (lang === 'fr' ? fr : en), [lang]);
  const value = React.useMemo(() => ({ lang, setLang, t, tx }), [lang, setLang, t, tx]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return React.useContext(I18nContext);
}
