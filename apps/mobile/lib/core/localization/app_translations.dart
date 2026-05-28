import 'package:flutter/widgets.dart';

class AppTranslations {
  static const supportedLocales = [Locale('en'), Locale('ar')];

  static const Map<String, Map<String, String>> _values = {
    'en': {
      'common.retry': 'Retry',
      'common.refresh': 'Refresh',
      'common.pleaseWait': 'Please wait...',
      'common.notSet': 'Not set',
      'common.notAssigned': 'Not assigned',
      'nav.home': 'Home',
      'nav.attendance': 'Attendance',
      'nav.history': 'History',
      'nav.profile': 'Profile',
      'login.subtitle': 'Secure field attendance with live GPS validation.',
      'login.email': 'Email',
      'login.password': 'Password',
      'login.signIn': 'Sign in',
      'login.signingIn': 'Signing in...',
      'login.validEmail': 'Enter a valid email',
      'login.passwordMin': 'Password must be at least 8 characters',
      'splash.configTitle': 'Field Attendance Pro is not configured',
      'splash.configHint':
          'Set SUPABASE_URL and SUPABASE_ANON_KEY in apps/mobile/.env or pass them using --dart-define.',
      'dashboard.title': 'Dashboard',
      'dashboard.assignedSite': 'Assigned site',
      'dashboard.geofenceRadius': 'Geofence radius',
      'dashboard.gpsRequired': 'GPS accuracy required',
      'dashboard.today': 'Today',
      'dashboard.noToday': 'No attendance records for today.',
      'dashboard.hello': 'Hello',
      'dashboard.checkedInStatus': 'You are currently checked in.',
      'dashboard.notCheckedInStatus': 'You are not checked in yet.',
      'dashboard.activeShift': 'ACTIVE SHIFT',
      'dashboard.readyToCheckIn': 'READY TO CHECK IN',
      'dashboard.fromSite': 'from site',
      'history.title': 'History',
      'history.empty': 'No attendance history yet.',
      'history.accuracy': 'Accuracy',
      'history.distance': 'Distance',
      'attendance.title': 'Attendance',
      'attendance.checkedIn': 'Checked in',
      'attendance.ready': 'Ready to check in',
      'attendance.noSelectedSite': 'No selected site',
      'attendance.allowedRadius': 'Allowed radius',
      'attendance.gpsAccuracy': 'GPS accuracy',
      'attendance.outsideGeofence': 'Outside geofence',
      'attendance.outsideAllowed': 'Allowed',
      'attendance.outsideBlocked': 'Blocked',
      'attendance.notRequired': 'Not required',
      'attendance.site': 'Attendance site',
      'attendance.siteLocked': 'Locked to active check-in site',
      'attendance.notesRequired': 'Notes required',
      'attendance.notesOptional': 'Notes optional',
      'attendance.noSiteMessage':
          'No active site is available for attendance. Contact your admin.',
      'attendance.hint':
          'The app validates GPS permission, accuracy, device session, and attendance sequence before saving. Geofence checks are applied only when enabled.',
      'attendance.checkIn': 'Check in',
      'attendance.checkOut': 'Check out',
      'attendance.selectSiteError':
          'Select a site before recording attendance.',
      'attendance.checkoutSiteLockedError':
          'Check-out site is locked to your current check-in site. Refresh and try again.',
      'attendance.notesRequiredError':
          'Notes are required by your company attendance rules.',
      'attendance.savedAt': 'saved at',
      'profile.title': 'Profile',
      'profile.email': 'Email',
      'profile.phone': 'Phone',
      'profile.department': 'Department',
      'profile.assignedSite': 'Assigned site',
      'profile.signOut': 'Sign out',
      'profile.language': 'Language',
      'profile.languageEnglish': 'English',
      'profile.languageArabic': 'Arabic',
    },
    'ar': {
      'common.retry': 'إعادة المحاولة',
      'common.refresh': 'تحديث',
      'common.pleaseWait': 'يرجى الانتظار...',
      'common.notSet': 'غير محدد',
      'common.notAssigned': 'غير مخصص',
      'nav.home': 'الرئيسية',
      'nav.attendance': 'الحضور',
      'nav.history': 'السجل',
      'nav.profile': 'الملف الشخصي',
      'login.subtitle': 'حضور ميداني آمن مع التحقق المباشر من GPS.',
      'login.email': 'البريد الإلكتروني',
      'login.password': 'كلمة المرور',
      'login.signIn': 'تسجيل الدخول',
      'login.signingIn': 'جارٍ تسجيل الدخول...',
      'login.validEmail': 'أدخل بريدًا إلكترونيًا صحيحًا',
      'login.passwordMin': 'كلمة المرور يجب أن تكون 8 أحرف على الأقل',
      'splash.configTitle': 'تطبيق الحضور غير مُعد',
      'splash.configHint':
          'قم بضبط SUPABASE_URL و SUPABASE_ANON_KEY في apps/mobile/.env أو مرّرهم باستخدام --dart-define.',
      'dashboard.title': 'لوحة التحكم',
      'dashboard.assignedSite': 'الموقع المخصص',
      'dashboard.geofenceRadius': 'نطاق الجيوفنس',
      'dashboard.gpsRequired': 'دقة GPS المطلوبة',
      'dashboard.today': 'اليوم',
      'dashboard.noToday': 'لا توجد سجلات حضور لليوم.',
      'dashboard.hello': 'مرحبًا',
      'dashboard.checkedInStatus': 'أنت مسجل حضور الآن.',
      'dashboard.notCheckedInStatus': 'لم تسجل الحضور بعد.',
      'dashboard.activeShift': 'دوام نشط',
      'dashboard.readyToCheckIn': 'جاهز لتسجيل الحضور',
      'dashboard.fromSite': 'من الموقع',
      'history.title': 'السجل',
      'history.empty': 'لا يوجد سجل حضور حتى الآن.',
      'history.accuracy': 'الدقة',
      'history.distance': 'المسافة',
      'attendance.title': 'الحضور',
      'attendance.checkedIn': 'تم تسجيل الحضور',
      'attendance.ready': 'جاهز لتسجيل الحضور',
      'attendance.noSelectedSite': 'لا يوجد موقع محدد',
      'attendance.allowedRadius': 'النطاق المسموح',
      'attendance.gpsAccuracy': 'دقة GPS',
      'attendance.outsideGeofence': 'خارج الجيوفنس',
      'attendance.outsideAllowed': 'مسموح',
      'attendance.outsideBlocked': 'ممنوع',
      'attendance.notRequired': 'غير مطلوب',
      'attendance.site': 'موقع الحضور',
      'attendance.siteLocked': 'مقفل على موقع تسجيل الحضور الحالي',
      'attendance.notesRequired': 'ملاحظات مطلوبة',
      'attendance.notesOptional': 'ملاحظات اختيارية',
      'attendance.noSiteMessage':
          'لا يوجد موقع نشط متاح للحضور. تواصل مع المسؤول.',
      'attendance.hint':
          'يقوم التطبيق بالتحقق من إذن GPS والدقة وجلسة الجهاز وتسلسل الحضور قبل الحفظ. يتم تطبيق فحوصات الجيوفنس فقط عند التفعيل.',
      'attendance.checkIn': 'تسجيل حضور',
      'attendance.checkOut': 'تسجيل انصراف',
      'attendance.selectSiteError': 'اختر موقعًا قبل تسجيل الحضور.',
      'attendance.checkoutSiteLockedError':
          'موقع الانصراف مقفل على موقع الحضور الحالي. حدّث الصفحة وحاول مرة أخرى.',
      'attendance.notesRequiredError':
          'الملاحظات مطلوبة حسب قواعد الحضور الخاصة بشركتك.',
      'attendance.savedAt': 'تم الحفظ في',
      'profile.title': 'الملف الشخصي',
      'profile.email': 'البريد الإلكتروني',
      'profile.phone': 'الهاتف',
      'profile.department': 'القسم',
      'profile.assignedSite': 'الموقع المخصص',
      'profile.signOut': 'تسجيل الخروج',
      'profile.language': 'اللغة',
      'profile.languageEnglish': 'الإنجليزية',
      'profile.languageArabic': 'العربية',
    },
  };

  static String text(BuildContext context, String key) {
    final languageCode = Localizations.localeOf(context).languageCode;
    final localized = _values[languageCode]?[key];
    if (localized != null) return localized;
    return _values['en']?[key] ?? key;
  }
}

extension AppTranslationContext on BuildContext {
  String tr(String key) => AppTranslations.text(this, key);
}
