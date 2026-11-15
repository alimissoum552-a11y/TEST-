import { createContext, useContext, useEffect, useMemo, useState } from 'react'

export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'es', label: 'Español' },
  { code: 'de', label: 'Deutsch' },
  { code: 'ar', label: 'العربية' },
]

const RTL = new Set(['ar'])

const DICT = {
  en: {
    month: 'Month', week: 'Week', day: 'Day', events: 'Events',
    calendar: 'Calendar', newEvent: 'Event', signOut: 'Sign out',
    upcoming: 'Upcoming events', edit: 'Edit', delete: 'Delete', close: 'Close',
    cancel: 'Cancel', add: 'Add', title: 'Title', location: 'Location',
    newEventTitle: 'New event', repeat: 'Repeat', none: 'none', reminder: 'Reminder',
    minBefore: '10 min before', signIn: 'Sign in', createAccount: 'Create account',
    password: 'Password', name: 'Name', email: 'Email',
    haveAccount: 'Already have an account? Sign in', noAccount: 'No account? Create one',
    checkEmail: 'Check your email to confirm your account.', language: 'Language',
    sep: 'Sep', dayShort: 'Day', weekDays: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
    monthName: 'September', year: '2026',
  },
  fr: {
    month: 'Mois', week: 'Semaine', day: 'Jour', events: 'Événements',
    calendar: 'Calendrier', newEvent: 'Événement', signOut: 'Quitter',
    upcoming: 'Prochains événements', edit: 'Modifier', delete: 'Supprimer', close: 'Fermer',
    cancel: 'Annuler', add: 'Ajouter', title: 'Titre', location: 'Lieu',
    newEventTitle: 'Nouvel événement', repeat: 'Répétition', none: 'aucune', reminder: 'Rappel',
    minBefore: '10 min avant', signIn: 'Se connecter', createAccount: 'Créer le compte',
    password: 'Mot de passe', name: 'Nom', email: 'Email',
    haveAccount: 'Déjà un compte ? Se connecter', noAccount: 'Pas de compte ? Créer un compte',
    checkEmail: 'Vérifiez votre email pour confirmer le compte.', language: 'Langue',
    sep: 'sept.', dayShort: 'Jour', weekDays: ['L', 'M', 'M', 'J', 'V', 'S', 'D'],
    monthName: 'Septembre', year: '2026',
  },
  es: {
    month: 'Mes', week: 'Semana', day: 'Día', events: 'Eventos',
    calendar: 'Calendario', newEvent: 'Evento', signOut: 'Salir',
    upcoming: 'Próximos eventos', edit: 'Editar', delete: 'Eliminar', close: 'Cerrar',
    cancel: 'Cancelar', add: 'Añadir', title: 'Título', location: 'Lugar',
    newEventTitle: 'Nuevo evento', repeat: 'Repetición', none: 'ninguna', reminder: 'Recordatorio',
    minBefore: '10 min antes', signIn: 'Iniciar sesión', createAccount: 'Crear cuenta',
    password: 'Contraseña', name: 'Nombre', email: 'Email',
    haveAccount: '¿Ya tienes cuenta? Inicia sesión', noAccount: '¿No tienes cuenta? Crea una',
    checkEmail: 'Revisa tu email para confirmar la cuenta.', language: 'Idioma',
    sep: 'sep.', dayShort: 'Día', weekDays: ['L', 'M', 'X', 'J', 'V', 'S', 'D'],
    monthName: 'Septiembre', year: '2026',
  },
  de: {
    month: 'Monat', week: 'Woche', day: 'Tag', events: 'Termine',
    calendar: 'Kalender', newEvent: 'Termin', signOut: 'Abmelden',
    upcoming: 'Kommende Termine', edit: 'Bearbeiten', delete: 'Löschen', close: 'Schließen',
    cancel: 'Abbrechen', add: 'Hinzufügen', title: 'Titel', location: 'Ort',
    newEventTitle: 'Neuer Termin', repeat: 'Wiederholung', none: 'keine', reminder: 'Erinnerung',
    minBefore: '10 Min. vorher', signIn: 'Anmelden', createAccount: 'Konto erstellen',
    password: 'Passwort', name: 'Name', email: 'E-Mail',
    haveAccount: 'Schon ein Konto? Anmelden', noAccount: 'Kein Konto? Jetzt erstellen',
    checkEmail: 'Bitte prüfe deine E-Mails, um das Konto zu bestätigen.', language: 'Sprache',
    sep: 'Sep.', dayShort: 'Tag', weekDays: ['M', 'D', 'M', 'D', 'F', 'S', 'S'],
    monthName: 'September', year: '2026',
  },
  ar: {
    month: 'الشهر', week: 'الأسبوع', day: 'اليوم', events: 'الأحداث',
    calendar: 'التقويم', newEvent: 'حدث', signOut: 'خروج',
    upcoming: 'الأحداث القادمة', edit: 'تعديل', delete: 'حذف', close: 'إغلاق',
    cancel: 'إلغاء', add: 'إضافة', title: 'العنوان', location: 'المكان',
    newEventTitle: 'حدث جديد', repeat: 'التكرار', none: 'لا يوجد', reminder: 'التذكير',
    minBefore: 'قبل 10 دقائق', signIn: 'تسجيل الدخول', createAccount: 'إنشاء حساب',
    password: 'كلمة المرور', name: 'الاسم', email: 'البريد الإلكتروني',
    haveAccount: 'لديك حساب؟ سجّل الدخول', noAccount: 'ليس لديك حساب؟ أنشئ واحداً',
    checkEmail: 'تحقق من بريدك الإلكتروني لتأكيد الحساب.', language: 'اللغة',
    sep: 'سبت.', dayShort: 'يوم', weekDays: ['ن', 'ث', 'ر', 'خ', 'ج', 'س', 'ح'],
    monthName: 'سبتمبر', year: '2026',
  },
}

const STORAGE_KEY = 'calendar-app.lang'
const I18nContext = createContext(null)

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(() => {
    const saved = typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY)
    return saved && DICT[saved] ? saved : 'en'
  })

  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = RTL.has(lang) ? 'rtl' : 'ltr'
    localStorage.setItem(STORAGE_KEY, lang)
  }, [lang])

  const value = useMemo(() => {
    const dict = DICT[lang]
    const locale = { en: 'en-US', fr: 'fr-FR', es: 'es-ES', de: 'de-DE', ar: 'ar-EG' }[lang]
    return { lang, setLang, t: (k) => dict[k] ?? DICT.en[k] ?? k, locale }
  }, [lang])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider')
  return ctx
}

export function LanguageSelect({ onPick }) {
  const { lang, setLang, t } = useI18n()
  return (
    <ul role="listbox" aria-label={t('language')}
      className="absolute end-0 top-full z-20 mt-2 w-44 overflow-hidden rounded-2xl bg-white p-1 shadow-xl ring-1 ring-neutral-200">
      {LANGUAGES.map((l) => (
        <li key={l.code}>
          <button type="button" role="option" aria-selected={lang === l.code}
            onClick={() => { setLang(l.code); onPick?.() }}
            className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm text-start transition-colors ${
              lang === l.code ? 'bg-neutral-900 text-white' : 'text-neutral-700 hover:bg-neutral-100'
            }`}>
            <span>{l.label}</span>
            <span className="text-xs opacity-60 uppercase">{l.code}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}
