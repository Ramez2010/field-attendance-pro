import 'app_user_profile.dart';
import 'attendance_record.dart';
import 'attendance_settings.dart';
import 'employee.dart';
import 'site.dart';

class AttendanceContext {
  const AttendanceContext({
    required this.profile,
    required this.employee,
    required this.site,
    required this.settings,
    required this.todayRecords,
  });

  final AppUserProfile profile;
  final Employee employee;
  final Site? site;
  final AttendanceSettings settings;
  final List<AttendanceRecord> todayRecords;

  AttendanceRecord? get latestRecord =>
      todayRecords.isEmpty ? null : todayRecords.first;

  bool get isCheckedIn =>
      latestRecord?.checkType == AttendanceCheckType.checkIn;
}
