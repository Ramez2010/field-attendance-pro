import 'dart:math' as math;

class GeofenceResult {
  const GeofenceResult({required this.distanceMeters, required this.isInside});

  final double distanceMeters;
  final bool isInside;
}

class GeofenceCalculator {
  static GeofenceResult validate({
    required double currentLatitude,
    required double currentLongitude,
    required double siteLatitude,
    required double siteLongitude,
    required double allowedRadiusMeters,
  }) {
    final distance = distanceMeters(
      currentLatitude,
      currentLongitude,
      siteLatitude,
      siteLongitude,
    );

    return GeofenceResult(
      distanceMeters: distance,
      isInside: distance <= allowedRadiusMeters,
    );
  }

  static double distanceMeters(double lat1, double lon1, double lat2, double lon2) {
    const earthRadiusMeters = 6371000.0;
    final dLat = _toRadians(lat2 - lat1);
    final dLon = _toRadians(lon2 - lon1);
    final a = math.pow(math.sin(dLat / 2), 2) +
        math.cos(_toRadians(lat1)) * math.cos(_toRadians(lat2)) * math.pow(math.sin(dLon / 2), 2);
    return earthRadiusMeters * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a));
  }

  static double _toRadians(double degrees) => degrees * math.pi / 180;
}
