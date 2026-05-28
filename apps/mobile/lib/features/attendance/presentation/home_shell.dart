import 'package:flutter/material.dart';

import '../../../core/localization/app_translations.dart';
import '../../../core/theme/app_theme.dart';
import '../../profile/presentation/profile_screen.dart';
import 'attendance_history_screen.dart';
import 'check_in_out_screen.dart';
import 'dashboard_screen.dart';

class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _index = 0;

  final _screens = const [
    DashboardScreen(),
    CheckInOutScreen(),
    AttendanceHistoryScreen(),
    ProfileScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(index: _index, children: _screens),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (index) => setState(() => _index = index),
        indicatorColor: AppTheme.mint,
        destinations: [
          NavigationDestination(
            icon: const Icon(Icons.space_dashboard_outlined),
            selectedIcon: const Icon(Icons.space_dashboard),
            label: context.tr('nav.home'),
          ),
          NavigationDestination(
            icon: const Icon(Icons.touch_app_outlined),
            selectedIcon: const Icon(Icons.touch_app),
            label: context.tr('nav.attendance'),
          ),
          NavigationDestination(
            icon: const Icon(Icons.history_outlined),
            selectedIcon: const Icon(Icons.history),
            label: context.tr('nav.history'),
          ),
          NavigationDestination(
            icon: const Icon(Icons.person_outline),
            selectedIcon: const Icon(Icons.person),
            label: context.tr('nav.profile'),
          ),
        ],
      ),
    );
  }
}
