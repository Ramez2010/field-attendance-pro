import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/errors/app_exception.dart';
import '../../../core/services/supabase_provider.dart';
import '../domain/app_user_profile.dart';
import '../domain/attendance_context.dart';
import '../domain/attendance_record.dart';
import '../domain/attendance_settings.dart';
import '../domain/employee.dart';
import '../domain/site.dart';

class AttendanceRepository {
  AttendanceRepository(this._client);

  final SupabaseClient _client;

  Future<AttendanceContext> loadContext() async {
    final userId = _client.auth.currentUser?.id;
    if (userId == null) throw const AppException('You are not signed in.');

    final profileJson = await _client
        .from('users')
        .select()
        .eq('id', userId)
        .single();
    final profile = AppUserProfile.fromJson(
      Map<String, dynamic>.from(profileJson),
    );

    if (profile.employeeId == null) {
      throw const AppException(
        'This mobile app is for employee accounts only.',
      );
    }

    final employeeJson = await _client
        .from('employees')
        .select()
        .eq('id', profile.employeeId!)
        .single();
    final employee = Employee.fromJson(Map<String, dynamic>.from(employeeJson));

    final settingsJson = await _client
        .from('attendance_settings')
        .select()
        .eq('company_id', profile.companyId)
        .maybeSingle();
    final settings = settingsJson == null
        ? AttendanceSettings.defaults
        : AttendanceSettings.fromJson(Map<String, dynamic>.from(settingsJson));

    final assignmentData = await _client
        .from('employee_site_assignments')
        .select('site_id,is_primary,created_at')
        .eq('employee_id', employee.id)
        .order('is_primary', ascending: false)
        .order('created_at', ascending: true);

    final assignedSiteIds = <String>[];
    String? primarySiteId;
    for (final rawRow in assignmentData) {
      final row = Map<String, dynamic>.from(rawRow as Map);
      final siteId = row['site_id']?.toString();
      if (siteId == null || siteId.isEmpty) continue;
      if (!assignedSiteIds.contains(siteId)) {
        assignedSiteIds.add(siteId);
      }
      final isPrimary = row['is_primary'] == true;
      if (isPrimary && primarySiteId == null) {
        primarySiteId = siteId;
      }
    }

    final employeeAssignedSiteId = employee.assignedSiteId;
    if (employeeAssignedSiteId != null &&
        employeeAssignedSiteId.isNotEmpty &&
        !assignedSiteIds.contains(employeeAssignedSiteId)) {
      assignedSiteIds.insert(0, employeeAssignedSiteId);
    }

    primarySiteId ??=
        employeeAssignedSiteId ??
        (assignedSiteIds.isNotEmpty ? assignedSiteIds.first : null);

    final allowedSites = <Site>[];
    if (assignedSiteIds.isNotEmpty) {
      final siteData = await _client
          .from('sites')
          .select()
          .eq('company_id', profile.companyId)
          .eq('is_active', true)
          .inFilter('id', assignedSiteIds);

      final siteById = <String, Site>{};
      for (final rawRow in siteData) {
        final site = Site.fromJson(Map<String, dynamic>.from(rawRow as Map));
        siteById[site.id] = site;
      }

      for (final siteId in assignedSiteIds) {
        final site = siteById[siteId];
        if (site != null) {
          allowedSites.add(site);
        }
      }
    }

    Site? site;
    if (primarySiteId != null && primarySiteId.isNotEmpty) {
      for (final candidate in allowedSites) {
        if (candidate.id == primarySiteId) {
          site = candidate;
          break;
        }
      }
    }
    site ??= allowedSites.isEmpty ? null : allowedSites.first;

    if (settings.requireGeofence && site == null) {
      throw const AppException(
        'Geofence is enabled, but no active work site is assigned to your profile.',
      );
    }

    final records = await listTodayRecords(employee.id);

    return AttendanceContext(
      profile: profile,
      employee: employee,
      site: site,
      allowedSites: allowedSites,
      settings: settings,
      todayRecords: records,
    );
  }

  Future<List<AttendanceRecord>> listTodayRecords(String employeeId) async {
    final now = DateTime.now();
    final start = DateTime(now.year, now.month, now.day).toUtc();
    final end = start.add(const Duration(days: 1));

    final data = await _client
        .from('attendance_records')
        .select()
        .eq('employee_id', employeeId)
        .gte('attendance_time', start.toIso8601String())
        .lt('attendance_time', end.toIso8601String())
        .order('attendance_time', ascending: false);

    return data
        .map<AttendanceRecord>(
          (json) => AttendanceRecord.fromJson(Map<String, dynamic>.from(json)),
        )
        .toList();
  }

  Future<List<AttendanceRecord>> listHistory({int limit = 60}) async {
    final userId = _client.auth.currentUser?.id;
    if (userId == null) throw const AppException('You are not signed in.');

    final profileJson = await _client
        .from('users')
        .select('employee_id')
        .eq('id', userId)
        .single();
    final employeeId = profileJson['employee_id']?.toString();
    if (employeeId == null) {
      throw const AppException('Employee profile was not found.');
    }

    final data = await _client
        .from('attendance_records')
        .select()
        .eq('employee_id', employeeId)
        .order('attendance_time', ascending: false)
        .limit(limit);

    return data
        .map<AttendanceRecord>(
          (json) => AttendanceRecord.fromJson(Map<String, dynamic>.from(json)),
        )
        .toList();
  }

  Future<AttendanceRecord> recordAttendance({
    required AttendanceCheckType checkType,
    required String? siteId,
    required double latitude,
    required double longitude,
    required double gpsAccuracy,
    required String deviceId,
    required String deviceName,
    String? notes,
  }) async {
    final response = await _client.rpc(
      'record_attendance',
      params: {
        'p_check_type': checkTypeToDb(checkType),
        'p_latitude': latitude,
        'p_longitude': longitude,
        'p_gps_accuracy': gpsAccuracy,
        'p_device_id': deviceId,
        'p_device_name': deviceName,
        'p_notes': notes,
        'p_site_id': siteId,
      },
    );

    final json = response is List ? response.first : response;
    return AttendanceRecord.fromJson(Map<String, dynamic>.from(json));
  }
}

final attendanceRepositoryProvider = Provider<AttendanceRepository>((ref) {
  return AttendanceRepository(ref.watch(supabaseProvider));
});
