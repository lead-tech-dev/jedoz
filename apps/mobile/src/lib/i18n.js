import React from 'react';
import { getItem, setItem, STORAGE_KEYS } from './storage';

const translations = {
  fr: {
    tabs: {
      home: 'Accueil',
      search: 'Recherche',
      map: 'Carte',
      messages: 'Messages',
      wallet: 'Portefeuille',
      profile: 'Profil'
    },
    auth: {
      loginTitle: 'Bon retour',
      loginSubtitle: 'Connecte-toi pour accéder au dashboard.',
      loginLabel: 'Email, téléphone ou pseudo',
      password: 'Mot de passe',
      loginLoading: 'Connexion...',
      loginButton: 'Se connecter',
      loginSuccess: 'Connexion réussie.',
      loginFailed: 'Connexion impossible.',
      noAccount: "Vous n'avez pas encore de compte ?",
      createAccount: 'Créer un compte',
      forgotPassword: 'Mot de passe oublié',
      registerTitle: 'Créer ton profil',
      registerSubtitle: 'Rejoins la communauté et publie des annonces.',
      username: 'Pseudo',
      email: 'Email',
      phone: 'Téléphone',
      city: 'Ville',
      country: 'Pays',
      registerLoading: 'Création...',
      registerButton: 'Créer un compte',
      registerSuccess: 'Compte créé.',
      registerFailed: 'Inscription impossible.',
      haveAccount: 'Déjà un compte ?',
      loginLink: 'Se connecter',
      resetTitle: 'Réinitialiser l’accès',
      resetSubtitle: 'Nous allons envoyer un code de vérification.',
      resetLabel: 'Email ou téléphone',
      resetSent: 'Code envoyé. Continue pour vérifier.',
      resetFailed: 'Réinitialisation impossible.',
      resetMismatch: 'Les mots de passe ne correspondent pas.',
      resetDesc: 'Saisis le code reçu et choisis un nouveau mot de passe.',
      sendOtp: 'Envoyer le code',
      verifyCode: 'Vérifier le code',
      verifyTitle: 'Vérifier le code',
      verifySubtitle: 'Saisis le code reçu pour continuer.',
      otpCode: 'Code OTP',
      otpVerified: 'Code vérifié. Retour à la connexion.',
      newPassword: 'Nouveau mot de passe',
      confirmPassword: 'Confirmer le mot de passe',
      resetButton: 'Réinitialiser',
      resetSuccess: 'Mot de passe mis à jour.',
      verify: 'Vérifier',
      backToLogin: 'Retour à la connexion'
    },
    settings: {
      title: 'Paramètres',
      notifications: 'Notifications',
      push: 'Notifications push',
      privacy: 'Confidentialité',
      hideStatus: 'Masquer mon statut en ligne',
      language: 'Langue',
      french: 'Français',
      english: 'Anglais'
    }
  },
  en: {
    tabs: {
      home: 'Home',
      search: 'Search',
      map: 'Map',
      messages: 'Messages',
      wallet: 'Wallet',
      profile: 'Profile'
    },
    auth: {
      loginTitle: 'Welcome back',
      loginSubtitle: 'Login to access your dashboard.',
      loginLabel: 'Email, phone, or username',
      password: 'Password',
      loginLoading: 'Logging in...',
      loginButton: 'Log in',
      loginSuccess: 'Login successful.',
      loginFailed: 'Login failed.',
      noAccount: "Don't have an account?",
      createAccount: 'Create account',
      forgotPassword: 'Forgot password',
      registerTitle: 'Create your profile',
      registerSubtitle: 'Join the community and publish ads.',
      username: 'Username',
      email: 'Email',
      phone: 'Phone',
      city: 'City',
      country: 'Country',
      registerLoading: 'Creating...',
      registerButton: 'Create account',
      registerSuccess: 'Account created.',
      registerFailed: 'Registration failed.',
      haveAccount: 'Already have an account?',
      loginLink: 'Log in',
      resetTitle: 'Reset access',
      resetSubtitle: 'We will send a verification code.',
      resetLabel: 'Email or phone',
      resetSent: 'OTP sent. Continue to verify.',
      resetFailed: 'Reset failed.',
      resetMismatch: 'Passwords do not match.',
      resetDesc: 'Enter the code and choose a new password.',
      sendOtp: 'Send code',
      verifyCode: 'Verify code',
      verifyTitle: 'Verify code',
      verifySubtitle: 'Enter the code you received to continue.',
      otpCode: 'OTP Code',
      otpVerified: 'OTP verified. Back to login.',
      newPassword: 'New password',
      confirmPassword: 'Confirm password',
      resetButton: 'Reset password',
      resetSuccess: 'Password updated.',
      verify: 'Verify',
      backToLogin: 'Back to login'
    },
    settings: {
      title: 'Settings',
      notifications: 'Notifications',
      push: 'Push notifications',
      privacy: 'Privacy',
      hideStatus: 'Hide online status',
      language: 'Language',
      french: 'French',
      english: 'English'
    }
  }
};

function lookup(dict, key) {
  return key.split('.').reduce((acc, part) => (acc && typeof acc === 'object' ? acc[part] : undefined), dict);
}

const I18nContext = React.createContext({
  lang: 'fr',
  setLang: () => {},
  t: (key) => key,
  tx: (fr) => fr
});

export function I18nProvider({ children }) {
  const [lang, setLangState] = React.useState('fr');

  React.useEffect(() => {
    getItem(STORAGE_KEYS.lang).then((stored) => {
      if (stored === 'fr' || stored === 'en') setLangState(stored);
    });
  }, []);

  const setLang = React.useCallback((next) => {
    setLangState(next);
    setItem(STORAGE_KEYS.lang, next);
  }, []);

  const t = React.useCallback(
    (key) => {
      const raw = lookup(translations[lang] || translations.fr, key);
      if (!raw || typeof raw !== 'string') return key;
      return raw;
    },
    [lang]
  );

  const tx = React.useCallback((fr, en) => (lang === 'fr' ? fr : en), [lang]);
  const value = React.useMemo(() => ({ lang, setLang, t, tx }), [lang, setLang, t, tx]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return React.useContext(I18nContext);
}
