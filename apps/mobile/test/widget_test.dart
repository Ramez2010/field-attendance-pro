import 'package:field_attendance_pro/main.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('shows configuration error without Supabase env', (tester) async {
    await tester.pumpWidget(const ConfigErrorApp());
    expect(find.text('Field Attendance Pro is not configured'), findsOneWidget);
    expect(find.byType(MaterialApp), findsOneWidget);
  });
}
