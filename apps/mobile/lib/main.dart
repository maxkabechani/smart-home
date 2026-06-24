import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;

import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:web_socket_channel/web_socket_channel.dart';

const String apiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://10.0.2.2:4000',
);

const Duration pollInterval = Duration(seconds: 5);
const Color _midnight = Color(0xFF0F172A);
const Color _surface = Color(0xFFF8FAFC);
const Color _panel = Colors.white;
const Color _border = Color(0xFFE2E8F0);
const Color _textPrimary = Color(0xFF0F172A);
const Color _textSecondary = Color(0xFF64748B);
const Color _cobalt = Color(0xFF0F172A);
const Color _aqua = Color(0xFF475569);
const Color _mint = Color(0xFF0F172A);
const Color _amber = Color(0xFF334155);
const Color _rose = Color(0xFF0F172A);

void main() {
  debugPrint('API base URL: $apiBaseUrl');
  runApp(const SensorDashboardApp());
}

class SensorDashboardApp extends StatelessWidget {
  const SensorDashboardApp({super.key});

  @override
  Widget build(BuildContext context) {
    final baseTheme = ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(
        seedColor: _cobalt,
        brightness: Brightness.light,
      ),
    );

    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'ESP32 Monitor',
      theme: baseTheme.copyWith(
        scaffoldBackgroundColor: _surface,
        textTheme: baseTheme.textTheme.apply(
          bodyColor: _textPrimary,
          displayColor: _textPrimary,
        ),
        cardTheme: const CardThemeData(
          color: _panel,
          elevation: 0,
          margin: EdgeInsets.zero,
        ),
        filledButtonTheme: FilledButtonThemeData(
          style: FilledButton.styleFrom(
            backgroundColor: _midnight,
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(18),
            ),
            textStyle: const TextStyle(fontWeight: FontWeight.w700),
          ),
        ),
        outlinedButtonTheme: OutlinedButtonThemeData(
          style: OutlinedButton.styleFrom(
            foregroundColor: _midnight,
            side: BorderSide(color: _border.withValues(alpha: 0.9)),
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(18),
            ),
            textStyle: const TextStyle(fontWeight: FontWeight.w700),
          ),
        ),
        segmentedButtonTheme: SegmentedButtonThemeData(
          style: ButtonStyle(
            visualDensity: VisualDensity.compact,
            side: WidgetStatePropertyAll(
              BorderSide(color: _border.withValues(alpha: 0.95)),
            ),
            padding: const WidgetStatePropertyAll(
              EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            ),
          ),
        ),
        navigationBarTheme: NavigationBarThemeData(
          height: 72,
          backgroundColor: Colors.white,
          elevation: 0,
          labelTextStyle: WidgetStateProperty.resolveWith((states) {
            return TextStyle(
              fontWeight: states.contains(WidgetState.selected)
                  ? FontWeight.w800
                  : FontWeight.w600,
              color: states.contains(WidgetState.selected)
                  ? _midnight
                  : _textSecondary,
            );
          }),
          indicatorColor: const Color(0xFFF1F5F9),
        ),
        dividerTheme: DividerThemeData(
          color: _border.withValues(alpha: 0.8),
          thickness: 1,
        ),
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

enum MonitorTab {
  dashboard(
    label: 'Dashboard',
    icon: Icons.space_dashboard_rounded,
    headline: 'Temperature & Humidity Dashboard',
  ),
  labOne(
    label: 'Lab 1',
    icon: Icons.device_thermostat_rounded,
    headline: 'Temperature & Humidity',
  ),
  labTwo(
    label: 'Lab 2',
    icon: Icons.lightbulb_circle_rounded,
    headline: 'Bulb Output',
  );

  const MonitorTab({
    required this.label,
    required this.icon,
    required this.headline,
  });

  final String label;
  final IconData icon;
  final String headline;
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
  BulbState({
    required this.enabled,
    required this.pendingRfid,
    required this.requestedAt,
    required this.authorizedAt,
    required this.lastRfidUid,
    required this.lastRfidStatus,
    required this.lastRfidAt,
    required this.updatedAt,
  });

  final bool enabled;
  final bool pendingRfid;
  final DateTime? requestedAt;
  final DateTime? authorizedAt;
  final String? lastRfidUid;
  final String? lastRfidStatus;
  final DateTime? lastRfidAt;
  final DateTime updatedAt;

  factory BulbState.fromJson(Map<String, dynamic> json) {
    return BulbState(
      enabled: json['enabled'] == true,
      pendingRfid: json['pendingRfid'] == true,
      requestedAt: _parseOptionalDate(json['requestedAt']),
      authorizedAt: _parseOptionalDate(json['authorizedAt']),
      lastRfidUid: json['lastRfidUid'] as String?,
      lastRfidStatus: json['lastRfidStatus'] as String?,
      lastRfidAt: _parseOptionalDate(json['lastRfidAt']),
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
  MonitorTab _tab = MonitorTab.dashboard;
  HistoryRange _historyRange = HistoryRange.day;
  Reading? _latest;
  List<Reading> _history = const [];
  BulbState? _bulb;
  String? _errorMessage;
  bool _isLoading = true;
  bool _isRefreshing = false;
  bool _isUpdatingBulb = false;
  bool _isFetching = false;
  DateTime? _lastSyncedAt;
  Timer? _pollTimer;
  Timer? _bulbSocketReconnectTimer;
  StreamSubscription<dynamic>? _bulbSocketSubscription;
  WebSocketChannel? _bulbSocket;

  @override
  void initState() {
    super.initState();
    _refresh(showLoading: true);
    _connectBulbSocket();
    _pollTimer = Timer.periodic(pollInterval, (_) => _refresh());
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _bulbSocketReconnectTimer?.cancel();
    _bulbSocketSubscription?.cancel();
    _bulbSocket?.sink.close();
    super.dispose();
  }

  void _connectBulbSocket() {
    _bulbSocketReconnectTimer?.cancel();
    _bulbSocketSubscription?.cancel();
    _bulbSocket?.sink.close();

    final socket = WebSocketChannel.connect(_buildBulbSocketUri());
    _bulbSocket = socket;

    _bulbSocketSubscription = socket.stream.listen(
      _handleBulbSocketMessage,
      onError: (_) => _scheduleBulbSocketReconnect(),
      onDone: _scheduleBulbSocketReconnect,
      cancelOnError: true,
    );
  }

  void _scheduleBulbSocketReconnect() {
    _bulbSocketReconnectTimer?.cancel();
    _bulbSocketReconnectTimer = Timer(
      const Duration(seconds: 2),
      _connectBulbSocket,
    );
  }

  void _handleBulbSocketMessage(dynamic message) {
    try {
      final payload = jsonDecode(message as String) as Map<String, dynamic>;
      if (payload['type'] != 'bulb.state') {
        return;
      }

      final bulb = BulbState.fromJson(payload['data'] as Map<String, dynamic>);
      if (!mounted) {
        return;
      }

      setState(() {
        _bulb = bulb;
        _lastSyncedAt = DateTime.now();
      });
    } catch (_) {
      // Ignore malformed realtime messages and let polling remain the fallback.
    }
  }

  Future<void> _refresh({
    bool showLoading = false,
    bool showRefreshing = false,
  }) async {
    if (_isFetching) {
      return;
    }

    _isFetching = true;

    if (mounted) {
      setState(() {
        if (showLoading) {
          _isLoading = true;
        }
        if (showRefreshing) {
          _isRefreshing = true;
        }
      });
    }

    try {
      final results = await Future.wait<Object?>([
        _api.fetchLatestReading(),
        _api.fetchHistory(_historyRange),
        _api.fetchBulbState(),
      ]);
      final latest = results[0] as Reading?;
      final history = results[1] as List<Reading>;
      final bulb = results[2] as BulbState;

      if (!mounted) {
        return;
      }

      setState(() {
        _latest = latest;
        _history = history;
        _bulb = bulb;
        _errorMessage = null;
        _isLoading = false;
        _lastSyncedAt = DateTime.now();
      });
    } catch (_) {
      if (!mounted) {
        return;
      }

      setState(() {
        _errorMessage = 'Unable to reach the backend.';
        _isLoading = false;
      });
    } finally {
      _isFetching = false;

      if (mounted) {
        setState(() => _isRefreshing = false);
      }
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
    final reading = _latest ?? (_history.isNotEmpty ? _history.last : null);
    final statusMessage = _buildStatusMessage(reading);
    final insight = SensorInsight.fromReadings(
      latest: reading,
      history: _history,
      bulb: _bulb,
    );
    final pages = <Widget>[
      _DashboardView(
        latest: reading,
        history: _history,
        bulb: _bulb,
        historyRange: _historyRange,
        insight: insight,
        onHistoryRangeChanged: _setHistoryRange,
        onOpenTab: (tab) => setState(() => _tab = tab),
      ),
      _LabOneView(
        latest: reading,
        history: _history,
        historyRange: _historyRange,
        insight: insight,
        onHistoryRangeChanged: _setHistoryRange,
      ),
      _LabTwoView(
        bulb: _bulb,
        isUpdating: _isUpdatingBulb,
        insight: insight,
        onSetBulbState: _setBulbState,
      ),
    ];

    return Scaffold(
      extendBody: true,
      body: SafeArea(
        bottom: false,
        child: RefreshIndicator(
          onRefresh: () => _refresh(showRefreshing: true),
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(18, 18, 18, 120),
            children: [
              _HeroCard(
                tab: _tab,
                latest: reading,
                statusMessage: statusMessage,
                lastSyncedAt: _lastSyncedAt,
                isRefreshing: _isRefreshing,
                isLoading: _isLoading && reading == null,
                onRefresh: () => _refresh(showRefreshing: true),
              ),
              const SizedBox(height: 18),
              if (_errorMessage != null) ...[
                _ErrorBanner(message: _errorMessage!),
                const SizedBox(height: 18),
              ],
              AnimatedSwitcher(
                duration: const Duration(milliseconds: 250),
                child: pages[_tab.index],
              ),
              if (_isLoading && reading == null) ...[
                const SizedBox(height: 18),
                const Center(child: CircularProgressIndicator()),
              ],
            ],
          ),
        ),
      ),
      bottomNavigationBar: Padding(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(28),
          child: NavigationBar(
            selectedIndex: _tab.index,
            onDestinationSelected: (index) =>
                setState(() => _tab = MonitorTab.values[index]),
            destinations: [
              for (final tab in MonitorTab.values)
                NavigationDestination(icon: Icon(tab.icon), label: tab.label),
            ],
          ),
        ),
      ),
    );
  }

  String _buildStatusMessage(Reading? reading) {
    if (_isLoading && reading == null) {
      return 'Loading sensor data...';
    }

    if (reading != null) {
      return reading.isOnline ? 'Sensor online' : 'Sensor offline (stale)';
    }

    return 'Awaiting sensor data.';
  }
}

class SensorInsight {
  const SensorInsight({
    required this.summary,
    required this.statusLabel,
    required this.statusColor,
    required this.temperatureDelta,
    required this.humidityDelta,
    required this.readingCount,
    required this.comfortScore,
    required this.bulbLabel,
  });

  final String summary;
  final String statusLabel;
  final Color statusColor;
  final double? temperatureDelta;
  final double? humidityDelta;
  final int readingCount;
  final int comfortScore;
  final String bulbLabel;

  factory SensorInsight.fromReadings({
    required Reading? latest,
    required List<Reading> history,
    required BulbState? bulb,
  }) {
    final previous = history.length >= 2 ? history[history.length - 2] : null;
    final tempOk =
        latest != null && latest.temperature >= 18 && latest.temperature <= 26;
    final humidityOk =
        latest != null && latest.humidity >= 40 && latest.humidity <= 60;
    final comfortScore = [tempOk, humidityOk].where((it) => it).length;

    if (latest == null) {
      return SensorInsight(
        summary: 'Waiting for the first sensor packet to land from the ESP32.',
        statusLabel: 'Awaiting readings',
        statusColor: _textSecondary,
        temperatureDelta: null,
        humidityDelta: null,
        readingCount: history.length,
        comfortScore: 0,
        bulbLabel: _formatBulbStateLabel(bulb),
      );
    }

    final summary = switch ((tempOk, humidityOk, latest.isOnline)) {
      (_, _, false) => 'The dashboard is reachable, but the sensor is stale.',
      (true, true, true) =>
        'Both temperature and humidity are in the target comfort zone.',
      (false, true, true) =>
        latest.temperature > 26
            ? 'Temperature is trending warm while humidity still looks healthy.'
            : 'Temperature is running cool even though humidity is in range.',
      (true, false, true) =>
        latest.humidity > 60
            ? 'Humidity is elevated, so the room may feel muggy.'
            : 'Humidity is low, so the air may feel dry.',
      (false, false, true) =>
        'Multiple conditions are outside the target range right now.',
    };

    return SensorInsight(
      summary: summary,
      statusLabel: latest.isOnline ? 'Sensor online' : 'Sensor offline',
      statusColor: latest.isOnline ? _mint : _rose,
      temperatureDelta: previous == null
          ? null
          : latest.temperature - previous.temperature,
      humidityDelta: previous == null
          ? null
          : latest.humidity - previous.humidity,
      readingCount: history.length,
      comfortScore: comfortScore,
      bulbLabel: _formatBulbStateLabel(bulb),
    );
  }
}

class _DashboardView extends StatelessWidget {
  const _DashboardView({
    required this.latest,
    required this.history,
    required this.bulb,
    required this.historyRange,
    required this.insight,
    required this.onHistoryRangeChanged,
    required this.onOpenTab,
  });

  final Reading? latest;
  final List<Reading> history;
  final BulbState? bulb;
  final HistoryRange historyRange;
  final SensorInsight insight;
  final ValueChanged<HistoryRange> onHistoryRangeChanged;
  final ValueChanged<MonitorTab> onOpenTab;

  @override
  Widget build(BuildContext context) {
    return Column(
      key: const ValueKey('dashboard'),
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _SectionHeader(
          eyebrow: 'Course Lab Dashboard',
          title: 'ESP32 Monitoring Workspace',
          description: '',
        ),
        const SizedBox(height: 16),
        _MetricGrid(
          latest: latest,
          bulb: bulb,
          insight: insight,
          historyCount: history.length,
        ),
        const SizedBox(height: 16),
        _SectionCard(
          title: 'System pulse',
          icon: Icons.auto_graph_rounded,
          trailing: _PillTag(
            label: '${insight.comfortScore}/2 comfort checks passed',
            color: insight.comfortScore == 2 ? _mint : _amber,
          ),
          child: _SystemPulse(latest: latest, bulb: bulb, insight: insight),
        ),
        const SizedBox(height: 16),
        _HistoryChartCard(
          history: history,
          historyRange: historyRange,
          onHistoryRangeChanged: onHistoryRangeChanged,
        ),
        const SizedBox(height: 16),
        _SectionCard(
          title: 'Lab shortcuts',
          icon: Icons.school_rounded,
          child: Column(
            children: [
              _LabShortcutTile(
                label: 'Lab Exercise 1',
                title: 'Temperature, humidity, and LCD status',
                accent: _cobalt,
                icon: Icons.thermostat_rounded,
                onTap: () => onOpenTab(MonitorTab.labOne),
              ),
              const SizedBox(height: 12),
              _LabShortcutTile(
                label: 'Lab Exercise 2',
                title: 'Bulb output and backend control',
                accent: _amber,
                icon: Icons.lightbulb_rounded,
                onTap: () => onOpenTab(MonitorTab.labTwo),
              ),
            ],
          ),
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
    required this.insight,
    required this.onHistoryRangeChanged,
  });

  final Reading? latest;
  final List<Reading> history;
  final HistoryRange historyRange;
  final SensorInsight insight;
  final ValueChanged<HistoryRange> onHistoryRangeChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      key: const ValueKey('lab-one'),
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _SectionHeader(
          eyebrow: 'Lab Exercise 1',
          title: 'Temperature and humidity telemetry',
          description:
              'Focused on the DHT11 stream, physical LCD output, and recent environmental changes.',
        ),
        const SizedBox(height: 16),
        _MetricGrid(
          latest: latest,
          bulb: null,
          insight: insight,
          historyCount: history.length,
          showBulb: false,
        ),
        const SizedBox(height: 16),
        _SectionCard(
          title: 'Sensor and display path',
          icon: Icons.memory_rounded,
          child: const Column(
            children: [
              _InfoRow(
                label: 'Sensor source',
                value:
                    'DHT11 captures the latest room temperature and humidity.',
              ),
              SizedBox(height: 14),
              _InfoRow(
                label: 'Physical LCD',
                value:
                    'The ESP32 mirrors the freshest values directly on the attached display.',
              ),
              SizedBox(height: 14),
              _InfoRow(
                label: 'Sampling model',
                value:
                    'Mobile polls the backend every 5 seconds for a live classroom view.',
              ),
            ],
          ),
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
    required this.insight,
    required this.onSetBulbState,
  });

  final BulbState? bulb;
  final bool isUpdating;
  final SensorInsight insight;
  final ValueChanged<bool> onSetBulbState;

  @override
  Widget build(BuildContext context) {
    final enabled = bulb?.enabled ?? false;
    final pendingRfid = bulb?.pendingRfid ?? false;

    return Column(
      key: const ValueKey('lab-two'),
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _SectionHeader(
          eyebrow: 'Lab Exercise 2',
          title: 'RFID bulb control',
          description:
              'Request the light here, then scan RFID at the ESP32 to turn it on.',
        ),
        const SizedBox(height: 16),
        _BulbControlCard(
          enabled: enabled,
          pendingRfid: pendingRfid,
          updatedAt: bulb?.updatedAt,
          lastRfidUid: bulb?.lastRfidUid,
          lastRfidStatus: bulb?.lastRfidStatus,
          lastRfidAt: bulb?.lastRfidAt,
          isUpdating: isUpdating,
          onSetBulbState: onSetBulbState,
        ),
        const SizedBox(height: 16),
        _SectionCard(
          title: 'Control path',
          icon: Icons.route_rounded,
          trailing: _PillTag(
            label: insight.bulbLabel,
            color: enabled ? _amber : _textSecondary,
          ),
          child: const Column(
            children: [
              _InfoRow(
                label: 'API routes',
                value:
                    'The app reads GET /bulb, requests ON with POST /bulb, and RFID scans POST /bulb/rfid-scan.',
              ),
              SizedBox(height: 14),
              _InfoRow(
                label: 'ESP32 behavior',
                value:
                    'The board sends RFID scans and only energizes the output after backend authorization.',
              ),
              SizedBox(height: 14),
              _InfoRow(
                label: 'UX intent',
                value:
                    'Off stays available from the apps so the lab can be reset quickly.',
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _HeroCard extends StatelessWidget {
  const _HeroCard({
    required this.tab,
    required this.latest,
    required this.statusMessage,
    required this.lastSyncedAt,
    required this.isRefreshing,
    required this.isLoading,
    required this.onRefresh,
  });

  final MonitorTab tab;
  final Reading? latest;
  final String statusMessage;
  final DateTime? lastSyncedAt;
  final bool isRefreshing;
  final bool isLoading;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(30),
        color: Colors.white,
        border: Border.all(color: _border),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 18,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(22),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'ESP32 Lab Exercise 1',
                        style: const TextStyle(
                          color: _textSecondary,
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 1.1,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        tab.headline,
                        style: const TextStyle(
                          color: _textPrimary,
                          fontSize: 24,
                          fontWeight: FontWeight.w900,
                          height: 1.05,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                OutlinedButton.icon(
                  onPressed: isRefreshing || isLoading ? null : onRefresh,
                  icon: isRefreshing
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.refresh_rounded),
                  label: Text(isRefreshing ? 'Refreshing...' : 'Refresh'),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: [
                _HeroChip(label: isLoading ? 'Status' : statusMessage),
                _HeroChip(
                  label: 'Last updated: ${_formatLastUpdated(lastSyncedAt)}',
                ),
                _HeroChip(
                  label: latest?.createdAt != null
                      ? 'Recorded at ${_formatDateTime(latest!.createdAt.toLocal())}'
                      : 'Recorded at -',
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({
    required this.eyebrow,
    required this.title,
    required this.description,
  });

  final String eyebrow;
  final String title;
  final String description;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          eyebrow,
          style: const TextStyle(
            color: _textSecondary,
            fontSize: 12,
            fontWeight: FontWeight.w800,
            letterSpacing: 0.9,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          title,
          style: const TextStyle(
            color: _textPrimary,
            fontSize: 24,
            fontWeight: FontWeight.w900,
          ),
        ),
        if (description.isNotEmpty) ...[
          const SizedBox(height: 8),
          Text(
            description,
            style: const TextStyle(
              color: _textSecondary,
              fontSize: 14,
              height: 1.45,
            ),
          ),
        ],
      ],
    );
  }
}

class _MetricGrid extends StatelessWidget {
  const _MetricGrid({
    required this.latest,
    required this.bulb,
    required this.insight,
    required this.historyCount,
    this.showBulb = true,
  });

  final Reading? latest;
  final BulbState? bulb;
  final SensorInsight insight;
  final int historyCount;
  final bool showBulb;

  @override
  Widget build(BuildContext context) {
    final cards = [
      _MetricCard(
        icon: Icons.thermostat_rounded,
        accent: _cobalt,
        title: 'Temperature',
        value: latest != null ? latest!.temperature.toStringAsFixed(1) : '--',
        unit: 'C',
        helper: 'Comfort band: 18 C to 26 C',
        trend: _formatDelta(insight.temperatureDelta, ' C'),
      ),
      _MetricCard(
        icon: Icons.water_drop_rounded,
        accent: _aqua,
        title: 'Humidity',
        value: latest != null ? latest!.humidity.toStringAsFixed(0) : '--',
        unit: '%',
        helper: 'Target band: 40% to 60%',
        trend: _formatDelta(insight.humidityDelta, '%'),
      ),
      if (showBulb)
        _MetricCard(
          icon: Icons.lightbulb_rounded,
          accent: _amber,
          title: 'Bulb state',
          value: bulb == null
              ? '--'
              : (bulb!.enabled ? 'On' : (bulb!.pendingRfid ? 'RFID' : 'Off')),
          unit: '',
          helper: '$historyCount telemetry points in this range',
          trend: bulb?.updatedAt != null
              ? 'Updated ${_formatRelativeTime(bulb!.updatedAt)}'
              : 'Waiting for backend state',
        ),
    ];

    return LayoutBuilder(
      builder: (context, constraints) {
        final cardWidth = constraints.maxWidth >= 900
            ? (constraints.maxWidth - 24) / 3
            : constraints.maxWidth >= 600
            ? (constraints.maxWidth - 12) / 2
            : constraints.maxWidth;

        return Wrap(
          spacing: 12,
          runSpacing: 12,
          children: [
            for (final card in cards) SizedBox(width: cardWidth, child: card),
          ],
        );
      },
    );
  }
}

class _MetricCard extends StatelessWidget {
  const _MetricCard({
    required this.icon,
    required this.accent,
    required this.title,
    required this.value,
    required this.unit,
    required this.helper,
    required this.trend,
  });

  final IconData icon;
  final Color accent;
  final String title;
  final String value;
  final String unit;
  final String helper;
  final String trend;

  @override
  Widget build(BuildContext context) {
    return _FrostedPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: _border),
                ),
                child: Icon(icon, color: _textPrimary),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(
                    color: _textPrimary,
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              const Icon(
                Icons.trending_up_rounded,
                size: 18,
                color: _textSecondary,
              ),
            ],
          ),
          const SizedBox(height: 20),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Flexible(
                child: AnimatedSwitcher(
                  duration: const Duration(milliseconds: 220),
                  child: Text(
                    value,
                    key: ValueKey(value),
                    style: const TextStyle(
                      color: _textPrimary,
                      fontSize: 38,
                      fontWeight: FontWeight.w900,
                      height: 1,
                    ),
                  ),
                ),
              ),
              if (unit.isNotEmpty) ...[
                const SizedBox(width: 6),
                Padding(
                  padding: const EdgeInsets.only(bottom: 5),
                  child: Text(
                    unit,
                    style: const TextStyle(
                      color: _textSecondary,
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 10),
          Text(
            helper,
            style: const TextStyle(
              color: _textSecondary,
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 16),
          _PillTag(label: trend, color: accent),
        ],
      ),
    );
  }
}

class _SystemPulse extends StatelessWidget {
  const _SystemPulse({
    required this.latest,
    required this.bulb,
    required this.insight,
  });

  final Reading? latest;
  final BulbState? bulb;
  final SensorInsight insight;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _InfoRow(
          label: 'Latest packet time',
          value: latest != null
              ? _formatDateTime(latest!.createdAt.toLocal())
              : 'No readings yet',
        ),
        const SizedBox(height: 14),
        _InfoRow(
          label: 'Data quality',
          value: latest?.isOnline == true
              ? 'Live sensor stream'
              : 'Using stale data',
        ),
        const SizedBox(height: 14),
        _InfoRow(
          label: 'Bulb control',
          value: bulb?.enabled == true
              ? 'Physical bulb should currently be on'
              : bulb?.pendingRfid == true
              ? 'Waiting for RFID scan'
              : 'Physical bulb is currently off',
        ),
        const SizedBox(height: 14),
        _InfoRow(
          label: 'History coverage',
          value: '${insight.readingCount} readings in the selected window',
        ),
      ],
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
      title: 'History trends',
      icon: Icons.show_chart_rounded,
      trailing: Text(
        '${history.length} points',
        style: const TextStyle(
          color: _textSecondary,
          fontSize: 13,
          fontWeight: FontWeight.w700,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
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
          const SizedBox(height: 18),
          if (history.isEmpty)
            Container(
              height: 240,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: _border.withValues(alpha: 0.8)),
              ),
              child: const Text(
                'Waiting for previous readings.',
                style: TextStyle(
                  color: _textSecondary,
                  fontWeight: FontWeight.w700,
                ),
              ),
            )
          else ...[
            SizedBox(
              height: 240,
              child: _ReadingsLineChart(
                history: history,
                historyRange: historyRange,
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: _MiniStat(
                    label: 'Average temp',
                    value:
                        '${_average(history.map((item) => item.temperature)).toStringAsFixed(1)} C',
                    accent: _cobalt,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _MiniStat(
                    label: 'Average humidity',
                    value:
                        '${_average(history.map((item) => item.humidity)).toStringAsFixed(0)}%',
                    accent: _aqua,
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _ReadingsLineChart extends StatelessWidget {
  const _ReadingsLineChart({required this.history, required this.historyRange});

  final List<Reading> history;
  final HistoryRange historyRange;

  @override
  Widget build(BuildContext context) {
    final temperatureSpots = <FlSpot>[];
    final humiditySpots = <FlSpot>[];

    for (var i = 0; i < history.length; i += 1) {
      temperatureSpots.add(FlSpot(i.toDouble(), history[i].temperature));
      humiditySpots.add(FlSpot(i.toDouble(), history[i].humidity));
    }

    final values = [
      ...history.map((reading) => reading.temperature),
      ...history.map((reading) => reading.humidity),
    ];
    final minValue = values.reduce(math.min);
    final maxValue = values.reduce(math.max);
    final padding = math.max((maxValue - minValue) * 0.16, 4);
    final minY = math.max(0, minValue - padding).toDouble();
    final maxY = (maxValue + padding).toDouble();
    final yInterval = math.max((maxY - minY) / 4, 1).toDouble();
    final interval = history.length <= 6
        ? 1.0
        : history.length <= 12
        ? 2.0
        : (history.length / 4).ceilToDouble();

    return LineChart(
      LineChartData(
        minX: 0,
        maxX: (history.length - 1).toDouble(),
        minY: minY,
        maxY: maxY,
        clipData: const FlClipData.all(),
        borderData: FlBorderData(show: false),
        gridData: FlGridData(
          drawVerticalLine: false,
          horizontalInterval: yInterval,
          getDrawingHorizontalLine: (_) =>
              FlLine(color: _border.withValues(alpha: 0.7), strokeWidth: 1),
        ),
        titlesData: FlTitlesData(
          topTitles: const AxisTitles(
            sideTitles: SideTitles(showTitles: false),
          ),
          rightTitles: const AxisTitles(
            sideTitles: SideTitles(showTitles: false),
          ),
          leftTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              reservedSize: 42,
              interval: yInterval,
              getTitlesWidget: (value, meta) {
                return Text(
                  value.toStringAsFixed(0),
                  style: const TextStyle(
                    color: _textSecondary,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                  ),
                );
              },
            ),
          ),
          bottomTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              interval: interval,
              reservedSize: 30,
              getTitlesWidget: (value, meta) {
                final index = value.round();

                if (index < 0 || index >= history.length) {
                  return const SizedBox.shrink();
                }

                return Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(
                    _formatChartLabel(history[index].createdAt, historyRange),
                    style: const TextStyle(
                      color: _textSecondary,
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                );
              },
            ),
          ),
        ),
        extraLinesData: ExtraLinesData(
          horizontalLines: [
            HorizontalLine(
              y: 24,
              strokeWidth: 1,
              dashArray: [6, 4],
              color: Color(0x330F172A),
            ),
            HorizontalLine(
              y: 50,
              strokeWidth: 1,
              dashArray: [6, 4],
              color: Color(0x335B6472),
            ),
          ],
        ),
        lineTouchData: LineTouchData(
          handleBuiltInTouches: true,
          touchTooltipData: LineTouchTooltipData(
            tooltipBorderRadius: BorderRadius.circular(18),
            tooltipPadding: const EdgeInsets.symmetric(
              horizontal: 14,
              vertical: 10,
            ),
            getTooltipColor: (_) => _midnight.withValues(alpha: 0.94),
            getTooltipItems: (spots) {
              return spots.map((spot) {
                final reading = history[spot.x.round()];
                final isTemperature = spot.barIndex == 0;
                final value = isTemperature
                    ? '${reading.temperature.toStringAsFixed(1)} C'
                    : '${reading.humidity.toStringAsFixed(0)}%';
                final label = isTemperature ? 'Temperature' : 'Humidity';

                return LineTooltipItem(
                  '$label\n',
                  const TextStyle(
                    color: Colors.white70,
                    fontWeight: FontWeight.w700,
                    fontSize: 11,
                  ),
                  children: [
                    TextSpan(
                      text: '$value\n',
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w900,
                        fontSize: 14,
                      ),
                    ),
                    TextSpan(
                      text: _formatDateTime(reading.createdAt.toLocal()),
                      style: const TextStyle(
                        color: Colors.white70,
                        fontWeight: FontWeight.w600,
                        fontSize: 11,
                      ),
                    ),
                  ],
                );
              }).toList();
            },
          ),
        ),
        lineBarsData: [
          LineChartBarData(
            spots: temperatureSpots,
            isCurved: true,
            barWidth: 3.5,
            color: _cobalt,
            curveSmoothness: 0.25,
            isStrokeCapRound: true,
            dotData: FlDotData(show: history.length <= 10),
            belowBarData: BarAreaData(
              show: true,
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  _cobalt.withValues(alpha: 0.12),
                  _cobalt.withValues(alpha: 0),
                ],
              ),
            ),
          ),
          LineChartBarData(
            spots: humiditySpots,
            isCurved: true,
            barWidth: 3.5,
            color: _aqua,
            curveSmoothness: 0.22,
            isStrokeCapRound: true,
            dotData: FlDotData(show: history.length <= 10),
            belowBarData: BarAreaData(
              show: true,
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  _aqua.withValues(alpha: 0.12),
                  _aqua.withValues(alpha: 0),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _BulbControlCard extends StatelessWidget {
  const _BulbControlCard({
    required this.enabled,
    required this.pendingRfid,
    required this.updatedAt,
    required this.lastRfidUid,
    required this.lastRfidStatus,
    required this.lastRfidAt,
    required this.isUpdating,
    required this.onSetBulbState,
  });

  final bool enabled;
  final bool pendingRfid;
  final DateTime? updatedAt;
  final String? lastRfidUid;
  final String? lastRfidStatus;
  final DateTime? lastRfidAt;
  final bool isUpdating;
  final ValueChanged<bool> onSetBulbState;

  @override
  Widget build(BuildContext context) {
    final accent = enabled || pendingRfid ? _amber : _textSecondary;
    final title = enabled
        ? 'Bulb is on'
        : pendingRfid
        ? 'Scan RFID'
        : 'Bulb is off';
    final helper = updatedAt != null
        ? 'Last command ${_formatRelativeTime(updatedAt)}'
        : 'Waiting for the first backend state.';

    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(30),
        color: Colors.white,
        border: Border.all(color: _border.withValues(alpha: 0.9)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(22),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                AnimatedContainer(
                  duration: const Duration(milliseconds: 250),
                  width: 88,
                  height: 88,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: accent.withValues(
                      alpha: enabled || pendingRfid ? 0.22 : 0.12,
                    ),
                    boxShadow: enabled
                        ? [
                            BoxShadow(
                              color: _amber.withValues(alpha: 0.28),
                              blurRadius: 26,
                              spreadRadius: 4,
                            ),
                          ]
                        : null,
                  ),
                  child: Icon(Icons.lightbulb_rounded, color: accent, size: 42),
                ),
                const SizedBox(width: 18),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: const TextStyle(
                          color: _textPrimary,
                          fontSize: 28,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        helper,
                        style: const TextStyle(
                          color: _textSecondary,
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            Text(
              enabled
                  ? 'The output should currently be energizing the physical bulb.'
                  : pendingRfid
                  ? 'The backend is waiting for a valid RFID scan before turning the bulb on.'
                  : 'Request the light here, then scan the RFID tag at the board.',
              style: const TextStyle(
                color: _textSecondary,
                fontSize: 14,
                height: 1.45,
              ),
            ),
            const SizedBox(height: 20),
            _InfoRow(
              label: 'Last RFID',
              value: lastRfidUid == null
                  ? 'No scan yet'
                  : '${lastRfidStatus ?? 'seen'} $lastRfidUid'
                      '${lastRfidAt == null ? '' : ' (${_formatRelativeTime(lastRfidAt)})'}',
            ),
            const SizedBox(height: 20),
            Row(
              children: [
                Expanded(
                  child: FilledButton.icon(
                    onPressed: isUpdating || enabled || pendingRfid
                        ? null
                        : () => onSetBulbState(true),
                    style: FilledButton.styleFrom(
                      backgroundColor: _midnight,
                      disabledBackgroundColor: _midnight.withValues(
                        alpha: 0.35,
                      ),
                    ),
                    icon: isUpdating && !enabled
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.flash_on_rounded),
                    label: const Text('Request On'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: isUpdating || (!enabled && !pendingRfid)
                        ? null
                        : () => onSetBulbState(false),
                    icon: isUpdating && enabled
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.power_settings_new_rounded),
                    label: const Text('Switch Off'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({
    required this.title,
    required this.icon,
    required this.child,
    this.trailing,
  });

  final String title;
  final IconData icon;
  final Widget child;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return _FrostedPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: _border),
                ),
                child: Icon(icon, color: _textPrimary, size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(
                    color: _textPrimary,
                    fontSize: 17,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              ...?switch (trailing) {
                Widget trailingWidget => [trailingWidget],
                null => null,
              },
            ],
          ),
          const SizedBox(height: 18),
          child,
        ],
      ),
    );
  }
}

class _LabShortcutTile extends StatelessWidget {
  const _LabShortcutTile({
    required this.label,
    required this.title,
    required this.accent,
    required this.icon,
    required this.onTap,
  });

  final String label;
  final String title;
  final Color accent;
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(22),
      child: Ink(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(22),
          color: Colors.white,
          border: Border.all(color: _border.withValues(alpha: 0.8)),
        ),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: _border),
              ),
              child: Icon(icon, color: _textPrimary),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: const TextStyle(
                      color: _textSecondary,
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.8,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    title,
                    style: const TextStyle(
                      color: _textPrimary,
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
            ),
            const Icon(Icons.arrow_forward_rounded, color: _textSecondary),
          ],
        ),
      ),
    );
  }
}

class _MiniStat extends StatelessWidget {
  const _MiniStat({
    required this.label,
    required this.value,
    required this.accent,
  });

  final String label;
  final String value;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: _border.withValues(alpha: 0.85)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(
              color: _textSecondary,
              fontSize: 12,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            value,
            style: TextStyle(
              color: accent,
              fontSize: 18,
              fontWeight: FontWeight.w900,
            ),
          ),
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          flex: 4,
          child: Text(
            label,
            style: const TextStyle(
              color: _textSecondary,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        const SizedBox(width: 14),
        Expanded(
          flex: 6,
          child: Text(
            value,
            textAlign: TextAlign.right,
            style: const TextStyle(
              color: _textPrimary,
              fontWeight: FontWeight.w800,
              height: 1.4,
            ),
          ),
        ),
      ],
    );
  }
}

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: _border),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: _border),
            ),
            child: const Icon(Icons.wifi_off_rounded, color: _textPrimary),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              message,
              style: const TextStyle(
                color: _textPrimary,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _PillTag extends StatelessWidget {
  const _PillTag({required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: _border),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: _textPrimary,
          fontSize: 12,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

class _HeroChip extends StatelessWidget {
  const _HeroChip({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: _border),
      ),
      child: Text(
        label,
        style: const TextStyle(
          color: _textPrimary,
          fontSize: 13,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

class _FrostedPanel extends StatelessWidget {
  const _FrostedPanel({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: _panel.withValues(alpha: 0.88),
        borderRadius: BorderRadius.circular(28),
        border: Border.all(color: _border.withValues(alpha: 0.8)),
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

DateTime? _parseOptionalDate(Object? value) {
  if (value is! String || value.isEmpty) {
    return null;
  }

  return DateTime.tryParse(value);
}

Uri _buildBulbSocketUri() {
  final apiUri = Uri.parse(apiBaseUrl);
  final scheme = apiUri.scheme == 'https' ? 'wss' : 'ws';

  return apiUri.replace(scheme: scheme, path: '/bulb/ws', query: '');
}

String _formatBulbStateLabel(BulbState? bulb) {
  if (bulb == null) {
    return 'Bulb unknown';
  }

  if (bulb.enabled) {
    return 'Bulb active';
  }

  if (bulb.pendingRfid) {
    return 'Waiting for RFID';
  }

  return 'Bulb idle';
}

String _formatDateTime(DateTime time) {
  final day = time.day.toString().padLeft(2, '0');
  final month = time.month.toString().padLeft(2, '0');
  final year = time.year.toString();
  final hours = time.hour.toString().padLeft(2, '0');
  final minutes = time.minute.toString().padLeft(2, '0');
  return '$day/$month/$year $hours:$minutes';
}

String _formatRelativeTime(DateTime? time) {
  if (time == null) {
    return 'Not synced yet';
  }

  final difference = DateTime.now().difference(time.toLocal());

  if (difference.inSeconds < 10) {
    return 'Just now';
  }

  if (difference.inMinutes < 1) {
    return '${difference.inSeconds}s ago';
  }

  if (difference.inHours < 1) {
    return '${difference.inMinutes}m ago';
  }

  if (difference.inDays < 1) {
    return '${difference.inHours}h ago';
  }

  return '${difference.inDays}d ago';
}

String _formatLastUpdated(DateTime? time) {
  if (time == null) {
    return '-';
  }

  final local = time.toLocal();
  final hours = local.hour.toString().padLeft(2, '0');
  final minutes = local.minute.toString().padLeft(2, '0');
  final seconds = local.second.toString().padLeft(2, '0');
  return '$hours:$minutes:$seconds';
}

String _formatDelta(double? value, String unit) {
  if (value == null) {
    return 'Waiting for comparison data';
  }

  final sign = value > 0 ? '+' : '';
  return '$sign${value.toStringAsFixed(1)}$unit vs previous';
}

String _formatChartLabel(DateTime time, HistoryRange range) {
  final local = time.toLocal();
  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return switch (range) {
    HistoryRange.day =>
      '${local.hour.toString().padLeft(2, '0')}:${local.minute.toString().padLeft(2, '0')}',
    HistoryRange.week => weekdays[local.weekday - 1],
    HistoryRange.month => '${local.day}/${local.month}',
  };
}

double _average(Iterable<double> values) {
  final list = values.toList(growable: false);

  if (list.isEmpty) {
    return 0;
  }

  final total = list.reduce((sum, value) => sum + value);
  return total / list.length;
}
