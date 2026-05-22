import 'dart:io';

import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class DeviceDetails {
  const DeviceDetails({required this.id, required this.name});

  final String id;
  final String name;
}

class DeviceInfoService {
  DeviceInfoService(this._plugin);

  final DeviceInfoPlugin _plugin;

  Future<DeviceDetails> currentDevice() async {
    if (Platform.isAndroid) {
      final info = await _plugin.androidInfo;
      return DeviceDetails(
        id: info.id,
        name: '${info.manufacturer} ${info.model}'.trim(),
      );
    }

    if (Platform.isIOS) {
      final info = await _plugin.iosInfo;
      return DeviceDetails(
        id: info.identifierForVendor ?? info.name,
        name: '${info.name} ${info.systemVersion}'.trim(),
      );
    }

    return const DeviceDetails(id: 'unsupported-device', name: 'Unsupported device');
  }
}

final deviceInfoServiceProvider = Provider<DeviceInfoService>((ref) {
  return DeviceInfoService(DeviceInfoPlugin());
});
