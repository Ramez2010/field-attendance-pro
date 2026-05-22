import 'package:intl/intl.dart';

import '../../../core/utils/json_readers.dart';

enum AttendanceCheckType { checkIn, checkOut }

AttendanceCheckType parseCheckType(String value) {
  return value == 'check_out' ? AttendanceCheckType.checkOut : AttendanceCheckType.checkIn;
}

String checkTypeToDb(AttendanceCheckType type) {
  return type == AttendanceCheckType.checkIn ? 'check_in' : 'check_out';
}

class AttendanceRecord {
  const AttendanceRecord({
    required this.id,
    required this.companyId,
    required this.employeeId,
    required this.siteId,
    required this.checkType,
    required this.attendanceTime,
    required this.latitude,
    required this.longitude,
    required this.gpsAccuracy,
    required this.distanceFromSite,
    required this.deviceId,
    this.deviceName,
    this.notes,
  });

  final String id;
  final String companyId;
  final String employeeId;
  final String siteId;
  final AttendanceCheckType checkType;
  final DateTime attendanceTime;
  final double latitude;
  final double longitude;
  final double gpsAccuracy;
  final double distanceFromSite;
  final String deviceId;
  final String? deviceName;
  final String? notes;

  String get label => checkType == AttendanceCheckType.checkIn ? 'Check-in' : 'Check-out';

  String get formattedTime => DateFormat('EEE, MMM d - HH:mm').format(attendanceTime.toLocal());

  factory AttendanceRecord.fromJson(Map<String, dynamic> json) {
    return AttendanceRecord(
      id: readString(json['id']),
      companyId: readString(json['company_id']),
      employeeId: readString(json['employee_id']),
      siteId: readString(json['site_id']),
      checkType: parseCheckType(readString(json['check_type'])),
      attendanceTime: DateTime.parse(readString(json['attendance_time'])).toLocal(),
      latitude: readDouble(json['latitude']),
      longitude: readDouble(json['longitude']),
      gpsAccuracy: readDouble(json['gps_accuracy']),
      distanceFromSite: readDouble(json['distance_from_site']),
      deviceId: readString(json['device_id']),
      deviceName: readNullableString(json['device_name']),
      notes: readNullableString(json['notes']),
    );
  }
}
