import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

final appLocaleProvider = StateNotifierProvider<AppLocaleController, Locale>(
  (ref) => AppLocaleController()..load(),
);

class AppLocaleController extends StateNotifier<Locale> {
  AppLocaleController() : super(const Locale('en'));

  static const _storageKey = 'app_locale';

  Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString(_storageKey);
    if (saved == 'ar') {
      state = const Locale('ar');
      return;
    }
    state = const Locale('en');
  }

  Future<void> setLocale(Locale locale) async {
    state = locale;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_storageKey, locale.languageCode);
  }
}
