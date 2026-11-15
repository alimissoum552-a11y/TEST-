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
    menu: "Menu",
    views: "Views",
    actions: "Actions",
    profile: "Profile",
    changePhoto: "Change photo",
    removePhoto: "Remove photo",
    avatarUpdated: "Photo updated.",
    avatarRemoved: "Photo removed.",
    notImage: "Please choose an image file.",
    tooBig: "Image must be under 2 MB.",
    owner: "Owner",
    team: "Team",
    invitedNoMail: "Member added, but the invitation email could not be sent.",
    share: "Share calendar",
    invite: "Invite",
    invited: "Member added.",
    noUser: "No account with this email.",
    administrator: "Administrator",
    contributor: "Contributor",
    reader: "Reader",
    remove: "Remove",
    noMembers: "No members yet.",
    activity: "Activity",
    restore: "Restore this version",
    restored: "Version restored.",
    noHistory: "No activity yet.",
    created: "created",
    updated: "updated",
    deleted: "deleted",
    sharing: "Share",
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
    monthName: 'September', year: '2026', save: 'Save', description: 'Description',
  },
  fr: {
    menu: "Menu",
    views: "Affichages",
    actions: "Actions",
    profile: "Profil",
    changePhoto: "Changer la photo",
    removePhoto: "Supprimer la photo",
    avatarUpdated: "Photo mise à jour.",
    avatarRemoved: "Photo supprimée.",
    notImage: "Choisissez un fichier image.",
    tooBig: "L'image doit faire moins de 2 Mo.",
    owner: "Propriétaire",
    team: "Équipe",
    invitedNoMail: "Membre ajouté, mais l'email d'invitation n'a pas pu être envoyé.",
    share: "Partager le calendrier",
    invite: "Inviter",
    invited: "Membre ajouté.",
    noUser: "Aucun compte avec cet email.",
    administrator: "Administrateur",
    contributor: "Contributeur",
    reader: "Lecteur",
    remove: "Retirer",
    noMembers: "Aucun membre pour le moment.",
    activity: "Activité",
    restore: "Restaurer cette version",
    restored: "Version restaurée.",
    noHistory: "Aucune activité.",
    created: "créé",
    updated: "modifié",
    deleted: "supprimé",
    sharing: "Partager",
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
    monthName: 'Septembre', year: '2026', save: 'Enregistrer', description: 'Description',
  },
  es: {
    menu: "Menú",
    views: "Vistas",
    actions: "Acciones",
    profile: "Perfil",
    changePhoto: "Cambiar foto",
    removePhoto: "Quitar foto",
    avatarUpdated: "Foto actualizada.",
    avatarRemoved: "Foto eliminada.",
    notImage: "Elige un archivo de imagen.",
    tooBig: "La imagen debe pesar menos de 2 MB.",
    owner: "Propietario",
    team: "Equipo",
    invitedNoMail: "Miembro añadido, pero no se pudo enviar el email de invitación.",
    share: "Compartir calendario",
    invite: "Invitar",
    invited: "Miembro añadido.",
    noUser: "No hay cuenta con este email.",
    administrator: "Administrador",
    contributor: "Colaborador",
    reader: "Lector",
    remove: "Quitar",
    noMembers: "Aún no hay miembros.",
    activity: "Actividad",
    restore: "Restaurar esta versión",
    restored: "Versión restaurada.",
    noHistory: "Sin actividad.",
    created: "creado",
    updated: "modificado",
    deleted: "eliminado",
    sharing: "Compartir",
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
    monthName: 'Septiembre', year: '2026', save: 'Guardar', description: 'Descripción',
  },
  de: {
    menu: "Menü",
    views: "Ansichten",
    actions: "Aktionen",
    profile: "Profil",
    changePhoto: "Foto ändern",
    removePhoto: "Foto entfernen",
    avatarUpdated: "Foto aktualisiert.",
    avatarRemoved: "Foto entfernt.",
    notImage: "Bitte wähle eine Bilddatei.",
    tooBig: "Das Bild muss kleiner als 2 MB sein.",
    owner: "Eigentümer",
    team: "Team",
    invitedNoMail: "Mitglied hinzugefügt, aber die Einladungs-E-Mail konnte nicht gesendet werden.",
    share: "Kalender teilen",
    invite: "Einladen",
    invited: "Mitglied hinzugefügt.",
    noUser: "Kein Konto mit dieser E-Mail.",
    administrator: "Administrator",
    contributor: "Mitwirkender",
    reader: "Leser",
    remove: "Entfernen",
    noMembers: "Noch keine Mitglieder.",
    activity: "Aktivität",
    restore: "Diese Version wiederherstellen",
    restored: "Version wiederhergestellt.",
    noHistory: "Keine Aktivität.",
    created: "erstellt",
    updated: "geändert",
    deleted: "gelöscht",
    sharing: "Teilen",
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
    monthName: 'September', year: '2026', save: 'Speichern', description: 'Beschreibung',
  },
  ar: {
    menu: "القائمة",
    views: "العروض",
    actions: "الإجراءات",
    profile: "الملف الشخصي",
    changePhoto: "تغيير الصورة",
    removePhoto: "حذف الصورة",
    avatarUpdated: "تم تحديث الصورة.",
    avatarRemoved: "تم حذف الصورة.",
    notImage: "يرجى اختيار ملف صورة.",
    tooBig: "يجب أن تكون الصورة أقل من 2 ميغابايت.",
    owner: "المالك",
    team: "الفريق",
    invitedNoMail: "تمت إضافة العضو، لكن تعذّر إرسال بريد الدعوة.",
    share: "مشاركة التقويم",
    invite: "دعوة",
    invited: "تمت إضافة العضو.",
    noUser: "لا يوجد حساب بهذا البريد.",
    administrator: "مدير",
    contributor: "مساهم",
    reader: "قارئ",
    remove: "إزالة",
    noMembers: "لا يوجد أعضاء بعد.",
    activity: "النشاط",
    restore: "استعادة هذه النسخة",
    restored: "تمت استعادة النسخة.",
    noHistory: "لا يوجد نشاط.",
    created: "أُنشئ",
    updated: "عُدّل",
    deleted: "حُذف",
    sharing: "مشاركة",
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
    monthName: 'سبتمبر', year: '2026', save: 'حفظ', description: 'الوصف',
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

export function LanguageSelect({ onPick, placement = 'down' }) {
  const { lang, setLang, t } = useI18n()
  const pos = placement === 'up' ? 'bottom-full mb-2 left-1/2 -translate-x-1/2' : 'end-0 top-full mt-2'
  return (
    <ul role="listbox" aria-label={t('language')}
      className={`absolute z-20 w-44 ${pos} overflow-hidden rounded-2xl bg-white p-1 shadow-xl ring-1 ring-neutral-200`}>
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

export function LanguageButton({ open, onToggle }) {
  const { lang, t } = useI18n()
  return (
    <button type="button" onClick={onToggle} aria-label={t('language')} aria-expanded={open}
      className={`inline-flex items-center gap-2 px-2 py-1.5 text-sm transition-colors ${
        open ? 'text-neutral-900 font-semibold' : 'text-neutral-400 hover:text-neutral-800'}`}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
        <circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 3 2.5 15 0 18M12 3c-2.5 3-2.5 15 0 18" />
      </svg>
      <span>{lang.toUpperCase()}</span>
    </button>
  )
}
