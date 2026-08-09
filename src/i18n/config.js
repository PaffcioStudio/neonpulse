import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import Backend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';

// Języki dostępne w aplikacji
const AVAILABLE_LANGUAGES = ['en', 'pl'];

// Domyślny język
const FALLBACK_LANGUAGE = 'pl';

const LOCALES_LOAD_PATH = import.meta.env.DEV
  ? '/locales/{{lng}}/{{ns}}.json'
  : './locales/{{lng}}/{{ns}}.json';

// Konfiguracja detektora języka
const languageDetectorOptions = {
  order: ['localStorage', 'navigator'],
  caches: ['localStorage'],
  lookupLocalStorage: 'neonpulse_lang',
  lookupFromPathIndex: 0,
};

i18n
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: FALLBACK_LANGUAGE,
    supportedLngs: AVAILABLE_LANGUAGES,
    defaultNS: 'common',
    ns: ['common', 'settings', 'player', 'library', 'modals', 'radio'],
    interpolation: {
      escapeValue: false, // React sam się zajmuje eskapowaniem
    },
    detection: languageDetectorOptions,
    backend: {
      loadPath: LOCALES_LOAD_PATH,
    },
    // W production ładujemy z public/locales
    // W dev Vite serwuje pliki statyczne
    saveMissing: false,
    debug: false,
  });

export default i18n;
export { AVAILABLE_LANGUAGES, FALLBACK_LANGUAGE };
