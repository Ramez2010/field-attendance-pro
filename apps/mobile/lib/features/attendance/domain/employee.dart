import '../../../core/utils/json_readers.dart';

class Employee {
  const Employee({
    required this.id,
    required this.companyId,
    required this.employeeCode,
    required this.fullName,
    required this.isActive,
    this.phone,
    this.email,
    this.department,
    this.assignedSiteId,
  });

  final String id;
  final String companyId;
  final String employeeCode;
  final String fullName;
  final bool isActive;
  final String? phone;
  final String? email;
  final String? department;
  final String? assignedSiteId;

  factory Employee.fromJson(Map<String, dynamic> json) {
    return Employee(
      id: readString(json['id']),
      companyId: readString(json['company_id']),
      employeeCode: readString(json['employee_code']),
      fullName: readString(json['full_name']),
      isActive: readBool(json['is_active'], fallback: true),
      phone: readNullableString(json['phone']),
      email: readNullableString(json['email']),
      department: readNullableString(json['department']),
      assignedSiteId: readNullableString(json['assigned_site_id']),
    );
  }
}
