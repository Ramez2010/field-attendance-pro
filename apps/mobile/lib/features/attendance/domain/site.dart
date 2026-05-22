import '../../../core/utils/json_readers.dart';

class Site {
  const Site({
    required this.id,
    required this.companyId,
    required this.name,
    required this.latitude,
    required this.longitude,
    required this.allowedRadiusMeters,
    required this.isActive,
    this.address,
  });

  final String id;
  final String companyId;
  final String name;
  final String? address;
  final double latitude;
  final double longitude;
  final double allowedRadiusMeters;
  final bool isActive;

  factory Site.fromJson(Map<String, dynamic> json) {
    return Site(
      id: readString(json['id']),
      companyId: readString(json['company_id']),
      name: readString(json['name']),
      address: readNullableString(json['address']),
      latitude: readDouble(json['latitude']),
      longitude: readDouble(json['longitude']),
      allowedRadiusMeters: readDouble(json['allowed_radius_meters']),
      isActive: readBool(json['is_active'], fallback: true),
    );
  }
}
