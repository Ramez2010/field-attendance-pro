import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/localization/app_translations.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/async_state_view.dart';
import '../../../shared/widgets/info_card.dart';
import '../data/attendance_repository.dart';
import '../domain/attendance_context.dart';
import '../domain/attendance_record.dart';
import 'screen_scaffold.dart';

class DashboardScreen extends ConsumerStatefulWidget {
  const DashboardScreen({super.key});

  @override
  ConsumerState<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends ConsumerState<DashboardScreen> {
  late Future<AttendanceContext> _future;

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

  @override
  Widget build(BuildContext context) {
    return ScreenScaffold(
      title: context.tr('dashboard.title'),
      action: IconButton(
        onPressed: _refresh,
        icon: const Icon(Icons.refresh_rounded),
      ),
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
                _HeroCard(data: data),
                const SizedBox(height: 14),
                InfoCard(
                  title: context.tr('dashboard.assignedSite'),
                  value: data.site?.name ?? context.tr('common.notAssigned'),
                  icon: Icons.apartment_rounded,
                ),
                InfoCard(
                  title: context.tr('dashboard.geofenceRadius'),
                  value: data.site == null
                      ? context.tr('common.notSet')
                      : '${data.site!.allowedRadiusMeters.toStringAsFixed(0)} m',
                  icon: Icons.radio_button_checked_rounded,
                ),
                InfoCard(
                  title: context.tr('dashboard.gpsRequired'),
                  value:
                      '<= ${data.settings.minimumGpsAccuracy.toStringAsFixed(0)} m',
                  icon: Icons.gps_fixed_rounded,
                ),
                const SizedBox(height: 12),
                Text(
                  context.tr('dashboard.today'),
                  style: Theme.of(
                    context,
                  ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
                ),
                const SizedBox(height: 10),
                if (data.todayRecords.isEmpty)
                  const _EmptyTodayCard()
                else
                  ...data.todayRecords.map(
                    (record) => _RecordTile(record: record),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _HeroCard extends StatelessWidget {
  const _HeroCard({required this.data});

  final AttendanceContext data;

  @override
  Widget build(BuildContext context) {
    final checkedIn = data.isCheckedIn;
    return Container(
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(28),
        gradient: const LinearGradient(
          colors: [AppTheme.forest, Color(0xFF153D36)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '${context.tr('dashboard.hello')}, ${data.employee.fullName}',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 22,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            checkedIn
                ? context.tr('dashboard.checkedInStatus')
                : context.tr('dashboard.notCheckedInStatus'),
            style: const TextStyle(color: Colors.white70, fontSize: 16),
          ),
          const SizedBox(height: 18),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.14),
              borderRadius: BorderRadius.circular(999),
            ),
            child: Text(
              checkedIn
                  ? context.tr('dashboard.activeShift')
                  : context.tr('dashboard.readyToCheckIn'),
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w900,
                letterSpacing: 0.8,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _EmptyTodayCard extends StatelessWidget {
  const _EmptyTodayCard();

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Text(context.tr('dashboard.noToday')),
      ),
    );
  }
}

class _RecordTile extends StatelessWidget {
  const _RecordTile({required this.record});

  final AttendanceRecord record;

  @override
  Widget build(BuildContext context) {
    final isIn = record.checkType == AttendanceCheckType.checkIn;
    return Card(
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: isIn ? AppTheme.mint : const Color(0xFFFFF4DB),
          child: Icon(
            isIn ? Icons.login_rounded : Icons.logout_rounded,
            color: isIn ? AppTheme.forest : AppTheme.amber,
          ),
        ),
        title: Text(
          isIn
              ? context.tr('attendance.checkIn')
              : context.tr('attendance.checkOut'),
          style: const TextStyle(fontWeight: FontWeight.w800),
        ),
        subtitle: Text(
          '${record.formattedTime} - ${record.distanceFromSite.toStringAsFixed(0)}m ${context.tr('dashboard.fromSite')}',
        ),
      ),
    );
  }
}
