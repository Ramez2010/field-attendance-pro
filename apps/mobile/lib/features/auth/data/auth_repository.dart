import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/services/device_info_service.dart';
import '../../../core/services/supabase_provider.dart';

class AuthRepository {
  AuthRepository(this._client, this._deviceInfoService);

  final SupabaseClient _client;
  final DeviceInfoService _deviceInfoService;

  Future<void> signIn({required String email, required String password}) async {
    await _client.auth.signInWithPassword(email: email.trim(), password: password);

    try {
      final device = await _deviceInfoService.currentDevice();
      await _client.rpc(
        'register_device_session',
        params: {
          'p_device_id': device.id,
          'p_device_name': device.name,
        },
      );
    } catch (_) {
      await _client.auth.signOut();
      rethrow;
    }
  }

  Future<void> signOut() => _client.auth.signOut();
}

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepository(
    ref.watch(supabaseProvider),
    ref.watch(deviceInfoServiceProvider),
  );
});
