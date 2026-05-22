import '../../../core/utils/json_readers.dart';

enum AppRole { superAdmin, companyAdmin, employee }

AppRole parseAppRole(String value) {
  switch (value) {
    case 'super_admin':
      return AppRole.superAdmin;
    case 'company_admin':
      return AppRole.companyAdmin;
    default:
      return AppRole.employee;
  }
}

class AppUserProfile {
  const AppUserProfile({
    required this.id,
    required this.companyId,
    required this.role,
    required this.email,
    required this.isActive,
    this.employeeId,
  });

  final String id;
  final String companyId;
  final String? employeeId;
  final AppRole role;
  final String email;
  final bool isActive;

  factory AppUserProfile.fromJson(Map<String, dynamic> json) {
    return AppUserProfile(
      id: readString(json['id']),
      companyId: readString(json['company_id']),
      employeeId: readNullableString(json['employee_id']),
      role: parseAppRole(readString(json['role'])),
      email: readString(json['email']),
      isActive: readBool(json['is_active'], fallback: true),
    );
  }
}
