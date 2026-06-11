import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

const String apiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://10.0.2.2:4000',
);

const Duration pollInterval = Duration(seconds: 5);

void main() {
  debugPrint('API base URL: $apiBaseUrl');
  runApp(const SensorDashboardApp());
}

class SensorDashboardApp extends StatelessWidget {
  const SensorDashboardApp({super.key});

  @override
  Widget build(BuildContext context) {
    const seedColor = Color(0xFF2563EB);

    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'ESP32 Monitor',
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(seedColor: seedColor),
        scaffoldBackgroundColor: const Color(0xFFF5F7FB),
        fontFamily: 'Roboto',
      ),
      home: const MonitorHomePage(),
    );
  }
}

enum HistoryRange {
  day('day', 'Day'),
  week('week', 'Week'),
  month('month', 'Month');

  const HistoryRange(this.value, this.label);

  final String value;
  final String label;
}

class Reading {
  Reading({
    required this.temperature,
    required this.humidity,
    required this.status,
    required this.createdAt,
  });

  final double temperature;
  final double humidity;
  final String status;
  final DateTime createdAt;

  bool get isOnline => status.toLowerCase() == 'online';

  factory Reading.fromJson(Map<String, dynamic> json) {
    return Reading(
      temperature: (json['temperature'] as num).toDouble(),
      humidity: (json['humidity'] as num).toDouble(),
      status: json['status'] as String? ?? 'offline',
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }
}

class BulbState {
  BulbState({required this.enabled, required this.updatedAt});

  final bool enabled;
  final DateTime updatedAt;

  factory BulbState.fromJson(Map<String, dynamic> json) {
    return BulbState(
      enabled: json['enabled'] == true,
      updatedAt: DateTime.parse(json['updatedAt'] as String),
    );
  }
}

class ApiClient {
  const ApiClient();

  Future<Reading?> fetchLatestReading() async {
    final payload = await _getJson('/readings/latest');

    if (payload['success'] != true || payload['data'] == null) {
      return null;
    }

    return Reading.fromJson(payload['data'] as Map<String, dynamic>);
  }

  Future<List<Reading>> fetchHistory(HistoryRange range) async {
    final payload = await _getJson('/readings/history?range=${range.value}');

    if (payload['success'] != true) {
      return const [];
    }

    final rows = payload['data'] as List<dynamic>;
    return rows
        .map((row) => Reading.fromJson(row as Map<String, dynamic>))
        .toList();
  }

  Future<BulbState> fetchBulbState() async {
    final payload = await _getJson('/bulb');
    return BulbState.fromJson(payload['data'] as Map<String, dynamic>);
  }

  Future<BulbState> setBulbState(bool enabled) async {
    final response = await http.post(
      Uri.parse('$apiBaseUrl/bulb'),
      headers: const {'Content-Type': 'application/json'},
      body: jsonEncode({'enabled': enabled}),
    );

    if (response.statusCode != 200) {
      throw Exception('Backend responded with ${response.statusCode}');
    }

    final payload = jsonDecode(response.body) as Map<String, dynamic>;
    return BulbState.fromJson(payload['data'] as Map<String, dynamic>);
  }

  Future<Map<String, dynamic>> _getJson(String path) async {
    final response = await http.get(Uri.parse('$apiBaseUrl$path'));

    if (response.statusCode != 200) {
      throw Exception('Backend responded with ${response.statusCode}');
    }

    return jsonDecode(response.body) as Map<String, dynamic>;
  }
}

class MonitorHomePage extends StatefulWidget {
  const MonitorHomePage({super.key});

  @override
  State<MonitorHomePage> createState() => _MonitorHomePageState();
}

class _MonitorHomePageState extends State<MonitorHomePage> {
  final ApiClient _api = const ApiClient();
  int _tabIndex = 0;
  HistoryRange _historyRange = HistoryRange.day;
  Reading? _latest;
  List<Reading> _history = const [];
  BulbState? _bulb;
  String? _errorMessage;
  bool _isLoading = true;
  bool _isUpdatingBulb = false;
  Timer? _pollTimer;

  @override
  void initState() {
    super.initState();
    _refresh();
    _pollTimer = Timer.periodic(pollInterval, (_) => _refresh(silent: true));
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }

  Future<void> _refresh({bool silent = false}) async {
    if (!silent) {
      setState(() => _isLoading = true);
    }

    try {
      final latest = await _api.fetchLatestReading();
      final history = await _api.fetchHistory(_historyRange);
      final bulb = await _api.fetchBulbState();

      if (!mounted) {
        return;
      }

      setState(() {
        _latest = latest;
        _history = history;
        _bulb = bulb;
        _errorMessage = null;
        _isLoading = false;
      });
    } catch (_) {
      if (!mounted) {
        return;
      }

      setState(() {
        _errorMessage = 'Unable to reach the backend.';
        _isLoading = false;
      });
    }
  }

  Future<void> _setHistoryRange(HistoryRange range) async {
    setState(() => _historyRange = range);
    await _refresh();
  }

  Future<void> _setBulbState(bool enabled) async {
    setState(() => _isUpdatingBulb = true);

    try {
      final bulb = await _api.setBulbState(enabled);

      if (!mounted) {
        return;
      }

      setState(() {
        _bulb = bulb;
        _errorMessage = null;
      });
    } catch (_) {
      if (!mounted) {
        return;
      }

      setState(() => _errorMessage = 'Unable to update the bulb.');
    } finally {
      if (mounted) {
        setState(() => _isUpdatingBulb = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final pages = [
      _DashboardView(
        latest: _latest,
          history: _history,
          bulb: _bulb,
          historyRange: _historyRange,
        onHistoryRangeChanged: _setHistoryRange,
      ),
      _LabOneView(
        latest: _latest,
        history: _history,
        historyRange: _historyRange,
        onHistoryRangeChanged: _setHistoryRange,
      ),
      _LabTwoView(
        bulb: _bulb,
        isUpdating: _isUpdatingBulb,
        onSetBulbState: _setBulbState,
      ),
    ];

    return Scaffold(
      appBar: AppBar(
        title: const Text('ESP32 Monitor'),
        actions: [
          IconButton(
            onPressed: _isLoading ? null : () => _refresh(),
            icon: _isLoading
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () => _refresh(),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(18, 10, 18, 24),
            children: [
              if (_errorMessage != null) ...[
                _ErrorBanner(message: _errorMessage!),
                const SizedBox(height: 14),
              ],
              pages[_tabIndex],
            ],
          ),
        ),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tabIndex,
        onDestinationSelected: (index) => setState(() => _tabIndex = index),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.dashboard_rounded),
            label: 'Dashboard',
          ),
          NavigationDestination(
            icon: Icon(Icons.thermostat_rounded),
            label: 'Lab 1',
          ),
          NavigationDestination(
            icon: Icon(Icons.lightbulb_rounded),
            label: 'Lab 2',
          ),
        ],
      ),
    );
  }
}

class _DashboardView extends StatelessWidget {
  const _DashboardView({
    required this.latest,
    required this.history,
    required this.bulb,
    required this.historyRange,
    required this.onHistoryRangeChanged,
  });

  final Reading? latest;
  final List<Reading> history;
  final BulbState? bulb;
  final HistoryRange historyRange;
  final ValueChanged<HistoryRange> onHistoryRangeChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _PageTitle(
          eyebrow: 'Course Lab Dashboard',
          title: 'ESP32 Monitoring Workspace',
          status: latest?.isOnline == true ? 'Sensor online' : 'Sensor offline',
          isPositive: latest?.isOnline == true,
        ),
        const SizedBox(height: 16),
        _MetricGrid(latest: latest, bulb: bulb, historyCount: history.length),
        const SizedBox(height: 16),
        _HistoryChartCard(
          history: history,
          historyRange: historyRange,
          onHistoryRangeChanged: onHistoryRangeChanged,
        ),
        const SizedBox(height: 16),
        _SectionCard(
          title: 'Labs',
          icon: Icons.school_rounded,
          children: const [
            _InfoTile(
              label: 'Lab Exercise 1',
              value: 'Temperature, humidity, physical LCD',
            ),
            _InfoTile(label: 'Lab Exercise 2', value: 'Physical bulb control'),
          ],
        ),
      ],
    );
  }
}

class _LabOneView extends StatelessWidget {
  const _LabOneView({
    required this.latest,
    required this.history,
    required this.historyRange,
    required this.onHistoryRangeChanged,
  });

  final Reading? latest;
  final List<Reading> history;
  final HistoryRange historyRange;
  final ValueChanged<HistoryRange> onHistoryRangeChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _PageTitle(
          eyebrow: 'Lab Exercise 1',
          title: 'Temperature & Humidity',
          status: latest?.isOnline == true ? 'Sensor online' : 'Sensor offline',
          isPositive: latest?.isOnline == true,
        ),
        const SizedBox(height: 16),
        _MetricGrid(
          latest: latest,
          bulb: null,
          historyCount: history.length,
          showBulb: false,
        ),
        const SizedBox(height: 16),
        _SectionCard(
          title: 'Physical LCD',
          icon: Icons.monitor_rounded,
          children: const [
            _InfoTile(
              label: 'Connection',
              value: 'LCD is attached to the ESP32 circuit',
            ),
            _InfoTile(
              label: 'Display',
              value: 'ESP32 writes latest sensor values locally',
            ),
          ],
        ),
        const SizedBox(height: 16),
        _HistoryChartCard(
          history: history,
          historyRange: historyRange,
          onHistoryRangeChanged: onHistoryRangeChanged,
        ),
      ],
    );
  }
}

class _LabTwoView extends StatelessWidget {
  const _LabTwoView({
    required this.bulb,
    required this.isUpdating,
    required this.onSetBulbState,
  });

  final BulbState? bulb;
  final bool isUpdating;
  final ValueChanged<bool> onSetBulbState;

  @override
  Widget build(BuildContext context) {
    final enabled = bulb?.enabled ?? false;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _PageTitle(
          eyebrow: 'Lab Exercise 2',
          title: 'Bulb Output',
          status: enabled ? 'Bulb on' : 'Bulb off',
          isPositive: enabled,
        ),
        const SizedBox(height: 16),
        _BulbControlCard(
          enabled: enabled,
          updatedAt: bulb?.updatedAt,
          isUpdating: isUpdating,
          onSetBulbState: onSetBulbState,
        ),
        const SizedBox(height: 16),
        _SectionCard(
          title: 'Backend Control',
          icon: Icons.cloud_sync_rounded,
          children: const [
            _InfoTile(label: 'Route', value: 'GET /bulb, POST /bulb'),
            _InfoTile(
              label: 'ESP32',
              value: 'Polls backend and drives the bulb pin',
            ),
          ],
        ),
      ],
    );
  }
}

class _PageTitle extends StatelessWidget {
  const _PageTitle({
    required this.eyebrow,
    required this.title,
    required this.status,
    required this.isPositive,
  });

  final String eyebrow;
  final String title;
  final String status;
  final bool isPositive;

  @override
  Widget build(BuildContext context) {
    final color = isPositive ? const Color(0xFF16A34A) : const Color(0xFFDC2626);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          eyebrow,
          style: const TextStyle(
            color: Color(0xFF64748B),
            fontSize: 12,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.8,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          title,
          style: const TextStyle(
            color: Color(0xFF0F172A),
            fontSize: 24,
            fontWeight: FontWeight.w900,
          ),
        ),
        const SizedBox(height: 10),
        _StatusPill(label: status, color: color),
      ],
    );
  }
}

class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: TextStyle(color: color, fontWeight: FontWeight.w800),
      ),
    );
  }
}

class _MetricGrid extends StatelessWidget {
  const _MetricGrid({
    required this.latest,
    required this.bulb,
    required this.historyCount,
    this.showBulb = true,
  });

  final Reading? latest;
  final BulbState? bulb;
  final int historyCount;
  final bool showBulb;

  @override
  Widget build(BuildContext context) {
    final cards = [
      _MetricCard(
        icon: Icons.thermostat_rounded,
        title: 'Temperature',
        value: latest != null ? latest!.temperature.toStringAsFixed(1) : '--',
        unit: 'C',
        helper: 'Comfort range: 18 C - 26 C',
      ),
      _MetricCard(
        icon: Icons.water_drop_rounded,
        title: 'Humidity',
        value: latest != null ? latest!.humidity.toStringAsFixed(0) : '--',
        unit: '%',
        helper: 'Target range: 40% - 60%',
      ),
      if (showBulb)
        _MetricCard(
          icon: Icons.lightbulb_rounded,
          title: 'Bulb',
          value: bulb == null ? '--' : (bulb!.enabled ? 'On' : 'Off'),
          unit: '',
          helper: '$historyCount readings in selected range',
        ),
    ];

    return LayoutBuilder(
      builder: (context, constraints) {
        if (constraints.maxWidth >= 700) {
          return Row(
            children: [
              for (final card in cards) ...[
                Expanded(child: card),
                if (card != cards.last) const SizedBox(width: 12),
              ],
            ],
          );
        }

        return Column(
          children: [
            for (final card in cards) ...[
              card,
              if (card != cards.last) const SizedBox(height: 12),
            ],
          ],
        );
      },
    );
  }
}

class _MetricCard extends StatelessWidget {
  const _MetricCard({
    required this.icon,
    required this.title,
    required this.value,
    required this.unit,
    required this.helper,
  });

  final IconData icon;
  final String title;
  final String value;
  final String unit;
  final String helper;

  @override
  Widget build(BuildContext context) {
    return _Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: const Color(0xFF2563EB)),
              const Spacer(),
              Text(
                title,
                style: const TextStyle(
                  color: Color(0xFF64748B),
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Flexible(
                child: Text(
                  value,
                  style: const TextStyle(
                    color: Color(0xFF0F172A),
                    fontSize: 38,
                    fontWeight: FontWeight.w900,
                    height: 1,
                  ),
                ),
              ),
              if (unit.isNotEmpty) ...[
                const SizedBox(width: 5),
                Padding(
                  padding: const EdgeInsets.only(bottom: 4),
                  child: Text(
                    unit,
                    style: const TextStyle(fontWeight: FontWeight.w800),
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 10),
          Text(
            helper,
            style: const TextStyle(
              color: Color(0xFF64748B),
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}

class _HistoryChartCard extends StatelessWidget {
  const _HistoryChartCard({
    required this.history,
    required this.historyRange,
    required this.onHistoryRangeChanged,
  });

  final List<Reading> history;
  final HistoryRange historyRange;
  final ValueChanged<HistoryRange> onHistoryRangeChanged;

  @override
  Widget build(BuildContext context) {
    return _SectionCard(
      title: 'Previous Sensor Data',
      icon: Icons.area_chart_rounded,
      children: [
        SegmentedButton<HistoryRange>(
          segments: const [
            ButtonSegment(value: HistoryRange.day, label: Text('Day')),
            ButtonSegment(value: HistoryRange.week, label: Text('Week')),
            ButtonSegment(value: HistoryRange.month, label: Text('Month')),
          ],
          selected: {historyRange},
          onSelectionChanged: (selection) =>
              onHistoryRangeChanged(selection.first),
        ),
        const SizedBox(height: 14),
        SizedBox(
          height: 220,
          child: history.isEmpty
              ? const Center(child: Text('Waiting for previous readings.'))
              : CustomPaint(
                  painter: _ReadingChartPainter(history),
                  child: const SizedBox.expand(),
                ),
        ),
      ],
    );
  }
}

class _ReadingChartPainter extends CustomPainter {
  _ReadingChartPainter(this.readings);

  final List<Reading> readings;

  @override
  void paint(Canvas canvas, Size size) {
    final padding = const EdgeInsets.fromLTRB(10, 10, 10, 24);
    final chart = Rect.fromLTWH(
      padding.left,
      padding.top,
      size.width - padding.horizontal,
      size.height - padding.vertical,
    );
    final gridPaint = Paint()
      ..color = const Color(0xFFE2E8F0)
      ..strokeWidth = 1;
    final temperaturePaint = Paint()
      ..color = const Color(0xFF2563EB)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3;
    final humidityPaint = Paint()
      ..color = const Color(0xFF14B8A6)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3;

    for (var i = 0; i <= 4; i += 1) {
      final y = chart.top + (chart.height * i / 4);
      canvas.drawLine(Offset(chart.left, y), Offset(chart.right, y), gridPaint);
    }

    final values = [
      ...readings.map((reading) => reading.temperature),
      ...readings.map((reading) => reading.humidity),
    ];
    final minValue = values.reduce(math.min);
    final maxValue = values.reduce(math.max);
    final span = math.max(maxValue - minValue, 1);

    Path buildPath(double Function(Reading reading) valueOf) {
      final path = Path();

      for (var i = 0; i < readings.length; i += 1) {
        final x = readings.length == 1
            ? chart.center.dx
            : chart.left + (chart.width * i / (readings.length - 1));
        final normalized = (valueOf(readings[i]) - minValue) / span;
        final y = chart.bottom - (chart.height * normalized);

        if (i == 0) {
          path.moveTo(x, y);
        } else {
          path.lineTo(x, y);
        }
      }

      return path;
    }

    canvas.drawPath(buildPath((reading) => reading.humidity), humidityPaint);
    canvas.drawPath(
      buildPath((reading) => reading.temperature),
      temperaturePaint,
    );

    final textPainter = TextPainter(
      text: const TextSpan(
        text: 'Blue: temperature   Teal: humidity',
        style: TextStyle(color: Color(0xFF64748B), fontSize: 11),
      ),
      textDirection: TextDirection.ltr,
    )..layout(maxWidth: size.width);
    textPainter.paint(canvas, Offset(chart.left, chart.bottom + 8));
  }

  @override
  bool shouldRepaint(covariant _ReadingChartPainter oldDelegate) {
    return oldDelegate.readings != readings;
  }
}

class _BulbControlCard extends StatelessWidget {
  const _BulbControlCard({
    required this.enabled,
    required this.updatedAt,
    required this.isUpdating,
    required this.onSetBulbState,
  });

  final bool enabled;
  final DateTime? updatedAt;
  final bool isUpdating;
  final ValueChanged<bool> onSetBulbState;

  @override
  Widget build(BuildContext context) {
    final color = enabled ? const Color(0xFFF59E0B) : const Color(0xFF64748B);

    return _Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 84,
                height: 84,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: enabled ? 0.2 : 0.1),
                  shape: BoxShape.circle,
                ),
                child: Icon(Icons.lightbulb_rounded, color: color, size: 42),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      enabled ? 'Bulb on' : 'Bulb off',
                      style: const TextStyle(
                        color: Color(0xFF0F172A),
                        fontSize: 24,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      updatedAt != null
                          ? 'Updated ${_formatDateTime(updatedAt!.toLocal())}'
                          : 'Waiting for backend state',
                      style: const TextStyle(color: Color(0xFF64748B)),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          Row(
            children: [
              Expanded(
                child: FilledButton.icon(
                  onPressed:
                      isUpdating || enabled ? null : () => onSetBulbState(true),
                  icon: const Icon(Icons.power_settings_new_rounded),
                  label: const Text('Switch On'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed:
                      isUpdating || !enabled ? null : () => onSetBulbState(false),
                  icon: const Icon(Icons.power_off_rounded),
                  label: const Text('Switch Off'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFFEF2F2),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFFECACA)),
      ),
      child: Row(
        children: [
          const Icon(Icons.error_outline_rounded, color: Color(0xFFDC2626)),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message,
              style: const TextStyle(
                color: Color(0xFF991B1B),
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({
    required this.title,
    required this.icon,
    required this.children,
  });

  final String title;
  final IconData icon;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return _Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: const Color(0xFF2563EB), size: 20),
              const SizedBox(width: 8),
              Text(
                title,
                style: const TextStyle(
                  color: Color(0xFF0F172A),
                  fontSize: 16,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          ...children,
        ],
      ),
    );
  }
}

class _InfoTile extends StatelessWidget {
  const _InfoTile({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Text(
              label,
              style: const TextStyle(
                color: Color(0xFF64748B),
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          const SizedBox(width: 16),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: const TextStyle(
                color: Color(0xFF0F172A),
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Panel extends StatelessWidget {
  const _Panel({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 18,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: child,
    );
  }
}

String _formatDateTime(DateTime time) {
  final day = time.day.toString().padLeft(2, '0');
  final month = time.month.toString().padLeft(2, '0');
  final year = time.year.toString();
  final hours = time.hour.toString().padLeft(2, '0');
  final minutes = time.minute.toString().padLeft(2, '0');
  return '$day/$month/$year $hours:$minutes';
}
