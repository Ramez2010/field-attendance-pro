import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/async_state_view.dart';
import '../data/attendance_repository.dart';
import '../domain/attendance_record.dart';
import 'screen_scaffold.dart';

class AttendanceHistoryScreen extends ConsumerStatefulWidget {
  const AttendanceHistoryScreen({super.key});

  @override
  ConsumerState<AttendanceHistoryScreen> createState() => _AttendanceHistoryScreenState();
}

class _AttendanceHistoryScreenState extends ConsumerState<AttendanceHistoryScreen> {
  late Future<List<AttendanceRecord>> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<List<AttendanceRecord>> _load() => ref.read(attendanceRepositoryProvider).listHistory();

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
      title: 'History',
      action: IconButton(onPressed: _refresh, icon: const Icon(Icons.refresh_rounded)),
      child: FutureBuilder<List<AttendanceRecord>>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return AsyncStateView(message: snapshot.error.toString(), onRetry: _refresh);
          }

          final records = snapshot.requireData;
          if (records.isEmpty) {
            return RefreshIndicator(
              onRefresh: _refresh,
              child: ListView(
                padding: const EdgeInsets.all(24),
                children: const [
                  SizedBox(height: 120),
                  Icon(Icons.history_rounded, size: 52, color: Colors.black38),
                  SizedBox(height: 16),
                  Text('No attendance history yet.', textAlign: TextAlign.center),
                ],
              ),
            );
          }

          return RefreshIndicator(
            onRefresh: _refresh,
            child: ListView.separated(
              padding: const EdgeInsets.all(18),
              itemBuilder: (context, index) => _HistoryTile(record: records[index]),
              separatorBuilder: (_, _) => const SizedBox(height: 8),
              itemCount: records.length,
            ),
          );
        },
      ),
    );
  }
}

class _HistoryTile extends StatelessWidget {
  const _HistoryTile({required this.record});

  final AttendanceRecord record;

  @override
  Widget build(BuildContext context) {
    final isIn = record.checkType == AttendanceCheckType.checkIn;
    return Card(
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 8),
        leading: CircleAvatar(
          backgroundColor: isIn ? AppTheme.mint : const Color(0xFFFFF4DB),
          child: Icon(isIn ? Icons.login_rounded : Icons.logout_rounded, color: isIn ? AppTheme.forest : AppTheme.amber),
        ),
        title: Text(record.label, style: const TextStyle(fontWeight: FontWeight.w900)),
        subtitle: Text('${record.formattedTime}\nAccuracy ${record.gpsAccuracy.toStringAsFixed(0)}m - Distance ${record.distanceFromSite.toStringAsFixed(0)}m'),
        isThreeLine: true,
      ),
    );
  }
}
