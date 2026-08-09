import i18nInstance, { AVAILABLE_LANGUAGES, FALLBACK_LANGUAGE } from './config';

export const i18n = i18nInstance;
export { AVAILABLE_LANGUAGES, FALLBACK_LANGUAGE };

export const changeLanguage = (lng) => {
  i18n.changeLanguage(lng);
  localStorage.setItem('neonpulse_lang', lng);
};

export const getCurrentLanguage = () => i18n.language;
