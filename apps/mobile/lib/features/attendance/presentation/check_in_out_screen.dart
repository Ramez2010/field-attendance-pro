import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/errors/app_exception.dart';
import '../../../core/services/device_info_service.dart';
import '../../../core/services/location_service.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/geofence_calculator.dart';
import '../../../shared/widgets/async_state_view.dart';
import '../../../shared/widgets/primary_button.dart';
import '../data/attendance_repository.dart';
import '../domain/attendance_context.dart';
import '../domain/attendance_record.dart';
import 'screen_scaffold.dart';

class CheckInOutScreen extends ConsumerStatefulWidget {
  const CheckInOutScreen({super.key});

  @override
  ConsumerState<CheckInOutScreen> createState() => _CheckInOutScreenState();
}

class _CheckInOutScreenState extends ConsumerState<CheckInOutScreen> {
  final _notesController = TextEditingController();
  late Future<AttendanceContext> _future;
  bool _isSubmitting = false;
  String? _error;
  String? _success;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  @override
  void dispose() {
    _notesController.dispose();
    super.dispose();
  }

  Future<AttendanceContext> _load() => ref.read(attendanceRepositoryProvider).loadContext();

  Future<void> _refresh() async {
    final next = _load();
    setState(() => _future = next);
    await next;
  }

  Future<void> _submit(AttendanceContext contextData) async {
    final checkType = contextData.isCheckedIn ? AttendanceCheckType.checkOut : AttendanceCheckType.checkIn;
    final notes = _notesController.text.trim();

    if (contextData.settings.requireNotes && notes.isEmpty) {
      setState(() {
        _error = 'Notes are required by your company attendance rules.';
        _success = null;
      });
      return;
    }

    setState(() {
      _isSubmitting = true;
      _error = null;
      _success = null;
    });

    try {
      final position = await ref.read(locationServiceProvider).currentPosition();
      if (position.accuracy > contextData.settings.minimumGpsAccuracy) {
        throw AppException(
          'GPS accuracy is ${position.accuracy.toStringAsFixed(0)}m. Required accuracy is ${contextData.settings.minimumGpsAccuracy.toStringAsFixed(0)}m or better.',
        );
      }

      final geofence = GeofenceCalculator.validate(
        currentLatitude: position.latitude,
        currentLongitude: position.longitude,
        siteLatitude: contextData.site.latitude,
        siteLongitude: contextData.site.longitude,
        allowedRadiusMeters: contextData.site.allowedRadiusMeters,
      );

      if (contextData.settings.requireGeofence &&
          !contextData.settings.allowCheckInOutsideGeofence &&
          !geofence.isInside) {
        throw AppException(
          'You are ${geofence.distanceMeters.toStringAsFixed(0)}m from ${contextData.site.name}. Allowed radius is ${contextData.site.allowedRadiusMeters.toStringAsFixed(0)}m.',
        );
      }

      final device = await ref.read(deviceInfoServiceProvider).currentDevice();
      final record = await ref.read(attendanceRepositoryProvider).recordAttendance(
            checkType: checkType,
            latitude: position.latitude,
            longitude: position.longitude,
            gpsAccuracy: position.accuracy,
            deviceId: device.id,
            deviceName: device.name,
            notes: notes.isEmpty ? null : notes,
          );

      _notesController.clear();
      setState(() => _success = '${record.label} saved at ${record.formattedTime}.');
      await _refresh();
    } catch (error) {
      setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return ScreenScaffold(
      title: 'Attendance',
      action: IconButton(onPressed: _refresh, icon: const Icon(Icons.refresh_rounded)),
      child: FutureBuilder<AttendanceContext>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return AsyncStateView(message: snapshot.error.toString(), onRetry: _refresh);
          }

          final data = snapshot.requireData;
          return RefreshIndicator(
            onRefresh: _refresh,
            child: ListView(
              padding: const EdgeInsets.all(18),
              children: [
                _StatusPanel(data: data),
                const SizedBox(height: 18),
                TextField(
                  controller: _notesController,
                  minLines: 2,
                  maxLines: 4,
                  decoration: InputDecoration(
                    labelText: data.settings.requireNotes ? 'Notes required' : 'Notes optional',
                    alignLabelWithHint: true,
                  ),
                ),
                const SizedBox(height: 18),
                if (_error != null) _MessageCard(message: _error!, isError: true),
                if (_success != null) _MessageCard(message: _success!, isError: false),
                const SizedBox(height: 18),
                SizedBox(
                  height: 92,
                  child: PrimaryButton(
                    label: data.isCheckedIn ? 'Check out' : 'Check in',
                    icon: data.isCheckedIn ? Icons.logout_rounded : Icons.login_rounded,
                    isLoading: _isSubmitting,
                    backgroundColor: data.isCheckedIn ? AppTheme.amber : AppTheme.forest,
                    onPressed: () => _submit(data),
                  ),
                ),
                const SizedBox(height: 14),
                Text(
                  'The app validates GPS permission, accuracy, geofence distance, device session, and attendance sequence before saving.',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Colors.black54),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _StatusPanel extends StatelessWidget {
  const _StatusPanel({required this.data});

  final AttendanceContext data;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(22),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                CircleAvatar(
                  radius: 26,
                  backgroundColor: data.isCheckedIn ? AppTheme.mint : const Color(0xFFFFF4DB),
                  child: Icon(
                    data.isCheckedIn ? Icons.verified_rounded : Icons.pending_actions_rounded,
                    color: data.isCheckedIn ? AppTheme.forest : AppTheme.amber,
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        data.isCheckedIn ? 'Checked in' : 'Ready to check in',
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
                      ),
                      Text(data.site.name, style: const TextStyle(color: Colors.black54)),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 18),
            _RuleLine(label: 'Allowed radius', value: '${data.site.allowedRadiusMeters.toStringAsFixed(0)}m'),
            _RuleLine(label: 'GPS accuracy', value: '<= ${data.settings.minimumGpsAccuracy.toStringAsFixed(0)}m'),
            _RuleLine(label: 'Outside geofence', value: data.settings.allowCheckInOutsideGeofence ? 'Allowed' : 'Blocked'),
          ],
        ),
      ),
    );
  }
}

class _RuleLine extends StatelessWidget {
  const _RuleLine({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: Colors.black54)),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w800)),
        ],
      ),
    );
  }
}

class _MessageCard extends StatelessWidget {
  const _MessageCard({required this.message, required this.isError});

  final String message;
  final bool isError;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isError ? const Color(0xFFFFEDEB) : AppTheme.mint,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Text(message, style: TextStyle(color: isError ? AppTheme.danger : AppTheme.forest)),
    );
  }
}
