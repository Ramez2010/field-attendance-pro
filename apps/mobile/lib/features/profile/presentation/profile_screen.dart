import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/localization/app_language_controller.dart';
import '../../../core/localization/app_translations.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/async_state_view.dart';
import '../../../shared/widgets/info_card.dart';
import '../../attendance/data/attendance_repository.dart';
import '../../attendance/domain/attendance_context.dart';
import '../../attendance/presentation/screen_scaffold.dart';
import '../../auth/data/auth_repository.dart';

class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  late Future<AttendanceContext> _future;
  bool _isSigningOut = false;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<AttendanceContext> _load() =>
      ref.read(attendanceRepositoryProvider).loadContext();

  Future<void> _refresh() async {
    final next = _load();
    setState(() {
      _future = next;
    });
    await next;
  }

  Future<void> _signOut() async {
    setState(() => _isSigningOut = true);
    await ref.read(authRepositoryProvider).signOut();
    if (mounted) setState(() => _isSigningOut = false);
  }

  @override
  Widget build(BuildContext context) {
    final locale = ref.watch(appLocaleProvider);

    return ScreenScaffold(
      title: context.tr('profile.title'),
      child: FutureBuilder<AttendanceContext>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return AsyncStateView(
              message: snapshot.error.toString(),
              onRetry: _refresh,
            );
          }

          final data = snapshot.requireData;
          return RefreshIndicator(
            onRefresh: _refresh,
            child: ListView(
              padding: const EdgeInsets.all(18),
              children: [
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(22),
                    child: Row(
                      children: [
                        const CircleAvatar(
                          radius: 32,
                          backgroundColor: AppTheme.mint,
                          child: Icon(
                            Icons.person_rounded,
                            color: AppTheme.forest,
                            size: 34,
                          ),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                data.employee.fullName,
                                style: Theme.of(context).textTheme.titleLarge
                                    ?.copyWith(fontWeight: FontWeight.w900),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                data.employee.employeeCode,
                                style: const TextStyle(color: Colors.black54),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                InfoCard(
                  title: context.tr('profile.email'),
                  value: data.employee.email ?? data.profile.email,
                  icon: Icons.mail_outline_rounded,
                ),
                InfoCard(
                  title: context.tr('profile.phone'),
                  value: data.employee.phone ?? context.tr('common.notSet'),
                  icon: Icons.phone_outlined,
                ),
                InfoCard(
                  title: context.tr('profile.department'),
                  value:
                      data.employee.department ?? context.tr('common.notSet'),
                  icon: Icons.badge_outlined,
                ),
                InfoCard(
                  title: context.tr('profile.assignedSite'),
                  value: data.site?.name ?? context.tr('common.notAssigned'),
                  icon: Icons.place_outlined,
                ),
                Card(
                  child: ListTile(
                    title: Text(context.tr('profile.language')),
                    trailing: DropdownButton<Locale>(
                      value: locale,
                      onChanged: (value) {
                        if (value == null) return;
                        ref.read(appLocaleProvider.notifier).setLocale(value);
                      },
                      items: [
                        DropdownMenuItem(
                          value: const Locale('en'),
                          child: Text(context.tr('profile.languageEnglish')),
                        ),
                        DropdownMenuItem(
                          value: const Locale('ar'),
                          child: Text(context.tr('profile.languageArabic')),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 18),
                OutlinedButton.icon(
                  onPressed: _isSigningOut ? null : _signOut,
                  icon: _isSigningOut
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.logout_rounded),
                  label: Text(context.tr('profile.signOut')),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
