import '../../../core/utils/json_readers.dart';

class AttendanceSettings {
  const AttendanceSettings({
    required this.requireGeofence,
    required this.minimumGpsAccuracy,
    required this.allowCheckInOutsideGeofence,
    required this.allowMultipleCheckinsPerDay,
    required this.requireNotes,
  });

  final bool requireGeofence;
  final double minimumGpsAccuracy;
  final bool allowCheckInOutsideGeofence;
  final bool allowMultipleCheckinsPerDay;
  final bool requireNotes;

  static const defaults = AttendanceSettings(
    requireGeofence: true,
    minimumGpsAccuracy: 50,
    allowCheckInOutsideGeofence: false,
    allowMultipleCheckinsPerDay: false,
    requireNotes: false,
  );

  factory AttendanceSettings.fromJson(Map<String, dynamic> json) {
    return AttendanceSettings(
      requireGeofence: readBool(json['require_geofence'], fallback: true),
      minimumGpsAccuracy: readDouble(json['minimum_gps_accuracy'], fallback: 50),
      allowCheckInOutsideGeofence: readBool(json['allow_check_in_outside_geofence']),
      allowMultipleCheckinsPerDay: readBool(json['allow_multiple_checkins_per_day']),
      requireNotes: readBool(json['require_notes']),
    );
  }
}
