import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import bn from './locales/bn.json';

// Only use saved language if it's a valid option, default to English
const savedLanguage = localStorage.getItem('app-language');
const validLanguages = ['en', 'bn'];
const initialLanguage = savedLanguage && validLanguages.includes(savedLanguage) ? savedLanguage : 'en';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      bn: { translation: bn },
    },
    lng: initialLanguage,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
