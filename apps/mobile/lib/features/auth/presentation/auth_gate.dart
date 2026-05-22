import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/services/supabase_provider.dart';
import '../../attendance/presentation/home_shell.dart';
import 'login_screen.dart';
import 'splash_screen.dart';

class AuthGate extends ConsumerWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final client = ref.watch(supabaseProvider);
    final authState = ref.watch(authStateProvider);

    return authState.when(
      data: (_) => client.auth.currentSession == null ? const LoginScreen() : const HomeShell(),
      loading: () => client.auth.currentSession == null ? const SplashScreen() : const HomeShell(),
      error: (error, _) => LoginScreen(initialError: error.toString()),
    );
  }
}
