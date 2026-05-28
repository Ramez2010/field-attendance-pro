import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';

type AppLanguage = 'en' | 'ar';

type LanguageContextValue = {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
  t: (key: string) => string;
  isArabic: boolean;
};

const defaultLanguage: AppLanguage = 'en';
const storageKey = 'admin_dashboard_language';

const values: Record<AppLanguage, Record<string, string>> = {
  en: {
    'layout.brandSubtitle': 'Admin Dashboard',
    'layout.activeCompany': 'Active company',
    'layout.signOut': 'Sign out',
    'layout.overview': 'Overview',
    'layout.company': 'Company',
    'layout.employeesUsers': 'Employees & Users',
    'layout.sitesGeofence': 'Sites & Geofence',
    'layout.rules': 'Rules',
    'layout.monitoring': 'Monitoring',
    'layout.history': 'History',
    'layout.reports': 'Reports',
    'layout.language': 'Language',
    'language.english': 'English',
    'language.arabic': 'Arabic',
    'auth.adminAccess': 'Admin access',
    'auth.tagline': 'Control attendance without touching the database.',
    'auth.description':
      'Manage companies, employees, geofences, rules, monitoring, and reports from one secure dashboard.',
    'auth.email': 'Email',
    'auth.password': 'Password',
    'auth.signIn': 'Sign in',
    'auth.signingIn': 'Signing in...',
    'auth.failedSignIn': 'Failed to sign in',
    'app.profileSetupRequired': 'Profile setup required',
    'app.adminAccessRequired': 'Admin access required',
    'app.adminAccessOnly':
      'This dashboard is only available to super admins and company admins.',
    'app.selectCompanyFirst':
      'Create or select a company before using the dashboard.',
    'common.refresh': 'Refresh',
    'common.exportExcel': 'Export Excel',
    'common.exportCsv': 'Export CSV',
    'common.applyFilters': 'Apply filters',
    'common.loading': 'Loading...',
    'common.employee': 'Employee',
    'common.site': 'Site',
    'common.dateFrom': 'Date from',
    'common.dateTo': 'Date to',
    'common.type': 'Type',
    'common.runReport': 'Run report',
    'monitoring.title': 'Attendance Monitoring',
    'historyPage.title': 'Attendance History',
    'reportsPage.title': 'Reports',
  },
  ar: {
    'layout.brandSubtitle': 'لوحة تحكم الإدارة',
    'layout.activeCompany': 'الشركة الحالية',
    'layout.signOut': 'تسجيل الخروج',
    'layout.overview': 'نظرة عامة',
    'layout.company': 'الشركة',
    'layout.employeesUsers': 'الموظفون والمستخدمون',
    'layout.sitesGeofence': 'المواقع والجيوفنس',
    'layout.rules': 'القواعد',
    'layout.monitoring': 'المتابعة',
    'layout.history': 'السجل',
    'layout.reports': 'التقارير',
    'layout.language': 'اللغة',
    'language.english': 'English',
    'language.arabic': 'العربية',
    'auth.adminAccess': 'دخول الإدارة',
    'auth.tagline': 'تحكم في الحضور بدون التعامل مع قاعدة البيانات.',
    'auth.description':
      'قم بإدارة الشركات والموظفين والجيوفنس والقواعد والمتابعة والتقارير من لوحة تحكم واحدة آمنة.',
    'auth.email': 'البريد الإلكتروني',
    'auth.password': 'كلمة المرور',
    'auth.signIn': 'تسجيل الدخول',
    'auth.signingIn': 'جارٍ تسجيل الدخول...',
    'auth.failedSignIn': 'فشل تسجيل الدخول',
    'app.profileSetupRequired': 'يلزم إعداد الملف الشخصي',
    'app.adminAccessRequired': 'مطلوب صلاحية الإدارة',
    'app.adminAccessOnly':
      'هذه اللوحة متاحة فقط للمشرف العام ومدير الشركة.',
    'app.selectCompanyFirst': 'أنشئ أو اختر شركة قبل استخدام لوحة التحكم.',
    'common.refresh': 'تحديث',
    'common.exportExcel': 'تصدير إكسل',
    'common.exportCsv': 'تصدير CSV',
    'common.applyFilters': 'تطبيق الفلاتر',
    'common.loading': 'جارٍ التحميل...',
    'common.employee': 'الموظف',
    'common.site': 'الموقع',
    'common.dateFrom': 'من تاريخ',
    'common.dateTo': 'إلى تاريخ',
    'common.type': 'النوع',
    'common.runReport': 'تشغيل التقرير',
    'monitoring.title': 'متابعة الحضور',
    'historyPage.title': 'سجل الحضور',
    'reportsPage.title': 'التقارير',
  },
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function readSavedLanguage(): AppLanguage {
  const saved = localStorage.getItem(storageKey);
  return saved === 'ar' ? 'ar' : defaultLanguage;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>(readSavedLanguage);

  useEffect(() => {
    localStorage.setItem(storageKey, language);
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  }, [language]);

  const value = useMemo<LanguageContextValue>(() => {
    const t = (key: string) => values[language][key] ?? values.en[key] ?? key;
    const setLanguage = (next: AppLanguage) => setLanguageState(next);
    return { language, setLanguage, t, isArabic: language === 'ar' };
  }, [language]);

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used inside LanguageProvider');
  }
  return context;
}
