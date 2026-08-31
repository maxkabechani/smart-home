import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:web_socket_channel/web_socket_channel.dart';

const apiBaseUrl = String.fromEnvironment('API_BASE_URL', defaultValue: 'http://10.0.2.2:4000');
const deviceId = String.fromEnvironment('DEVICE_ID', defaultValue: 'esp32-home-01');

void main() => runApp(const SmartHomeApp());

class SmartHomeApp extends StatelessWidget {
  const SmartHomeApp({super.key});
  @override
  Widget build(BuildContext context) => MaterialApp(
    debugShowCheckedModeBanner: false,
    title: 'Smart Home',
    theme: ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xff2563eb)),
      scaffoldBackgroundColor: const Color(0xfff4f7fb),
      cardTheme: const CardThemeData(elevation: 0, margin: EdgeInsets.zero),
    ),
    home: const SmartHomePage(),
  );
}

class HomeState {
  const HomeState({required this.data, required this.online});
  final Map<String, dynamic>? data;
  final bool online;
  factory HomeState.fromJson(Map<String, dynamic> json) => HomeState(
    data: json['data'] as Map<String, dynamic>?, online: json['online'] == true,
  );
}

class SmartHomeApi {
  const SmartHomeApi();
  Future<HomeState> status() async {
    final response = await http.get(Uri.parse('$apiBaseUrl/smart-home/status?deviceId=$deviceId'));
    if (response.statusCode != 200) throw Exception('Status ${response.statusCode}');
    return HomeState.fromJson(jsonDecode(response.body) as Map<String, dynamic>);
  }
  Future<void> command(String command) async {
    final response = await http.post(Uri.parse('$apiBaseUrl/smart-home/commands'), headers: {'content-type': 'application/json'}, body: jsonEncode({'deviceId': deviceId, 'command': command}));
    if (response.statusCode != 202) throw Exception('Command ${response.statusCode}');
  }
}

class SmartHomePage extends StatefulWidget {
  const SmartHomePage({super.key});
  @override State<SmartHomePage> createState() => _SmartHomePageState();
}

class _SmartHomePageState extends State<SmartHomePage> {
  final _api = const SmartHomeApi();
  HomeState _state = const HomeState(data: null, online: false);
  WebSocketChannel? _socket;
  StreamSubscription<dynamic>? _subscription;
  Timer? _reconnect;
  Timer? _fallbackPoll;
  String? _error;
  bool _sending = false;

  @override void initState() {
    super.initState();
    _refresh();
    _connect();
    _fallbackPoll = Timer.periodic(const Duration(seconds: 15), (_) => _refresh());
  }
  @override void dispose() {
    _reconnect?.cancel(); _fallbackPoll?.cancel(); _subscription?.cancel(); _socket?.sink.close();
    super.dispose();
  }
  Uri get _socketUri {
    final uri = Uri.parse(apiBaseUrl);
    return uri.replace(scheme: uri.scheme == 'https' ? 'wss' : 'ws', path: '/smart-home/ws', queryParameters: {'deviceId': deviceId});
  }
  void _connect() {
    _reconnect?.cancel();
    final socket = WebSocketChannel.connect(_socketUri); _socket = socket;
    _subscription = socket.stream.listen((raw) {
      final message = jsonDecode(raw as String) as Map<String, dynamic>;
      if (message['type'] == 'smart-home.state' && mounted) setState(() { _state = HomeState.fromJson(message); _error = null; });
    }, onError: (_) => _scheduleReconnect(), onDone: _scheduleReconnect, cancelOnError: true);
  }
  void _scheduleReconnect() { _reconnect?.cancel(); _reconnect = Timer(const Duration(seconds: 2), _connect); }
  Future<void> _refresh() async {
    try { final state = await _api.status(); if (mounted) setState(() { _state = state; _error = null; }); }
    catch (_) { if (mounted) setState(() => _error = 'Backend unavailable. Local home automation continues.'); }
  }
  Future<void> _send(String command) async {
    setState(() => _sending = true);
    try {
      if (_socket != null) {
        await _socket!.ready.timeout(const Duration(seconds: 2));
        _socket!.sink.add(jsonEncode({'type': 'smart-home.command', 'command': command}));
      }
      else await _api.command(command);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$command queued')));
    } catch (_) { try { await _api.command(command); } catch (_) { if (mounted) setState(() => _error = 'Could not queue command.'); } }
    finally { if (mounted) setState(() => _sending = false); }
  }

  @override Widget build(BuildContext context) {
    final d = _state.data;
    return Scaffold(
      appBar: AppBar(title: const Text('Smart Home'), actions: [IconButton(onPressed: _refresh, icon: const Icon(Icons.refresh))]),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: ListView(padding: const EdgeInsets.all(16), children: [
          _ConnectionBanner(online: _state.online, error: _error, updatedAt: d?['updatedAt'] as String?),
          const SizedBox(height: 16),
          GridView.count(crossAxisCount: MediaQuery.sizeOf(context).width > 700 ? 2 : 1, childAspectRatio: 1.65, mainAxisSpacing: 12, crossAxisSpacing: 12, shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), children: [
            _ModeCard(icon: Icons.thermostat, title: 'Climate', value: d == null ? 'Waiting for telemetry' : '${_decimal(d['temperature'])}°C · ${_decimal(d['humidity'])}% humidity', detail: 'Fan ${_onOff(d?['fanOn'])}', mode: d?['fanMode'] as String?, disabled: _sending, onMode: (m) => _send('SET_FAN_MODE:${m.toLowerCase()}')),
            _ModeCard(icon: Icons.water_drop, title: 'Water tank', value: d == null ? 'Waiting for telemetry' : '${d['tankPercent']}% full · ${_decimal(d['tankDistanceCm'])} cm', detail: 'Pump ${_onOff(d?['pumpOn'])}', mode: d?['pumpMode'] as String?, disabled: _sending, onMode: (m) => _send('SET_PUMP_MODE:${m.toLowerCase()}')),
            _ModeCard(icon: Icons.light_outlined, title: 'Outside light', value: 'Light ${_onOff(d?['outsideLightOn'])}', detail: 'Ambient relay', mode: d?['outsideLightMode'] as String?, disabled: _sending, onMode: (m) => _send('SET_OUTSIDE_LIGHT_MODE:${m.toLowerCase()}')),
            _ModeCard(icon: Icons.lightbulb_outline, title: 'Inside light', value: 'Light ${_onOff(d?['insideLightOn'])}', detail: d?['motion'] == true ? 'Motion detected' : 'No motion', mode: d?['insideLightMode'] as String?, disabled: _sending, onMode: (m) => _send('SET_INSIDE_LIGHT_MODE:${m.toLowerCase()}')),
          ]),
          const SizedBox(height: 12),
          _ActionCard(icon: Icons.door_front_door, title: 'Gate', state: d?['gateOpen'] == true ? 'Open' : 'Closed', children: [FilledButton(onPressed: _sending ? null : () => _send('OPEN_GATE'), child: const Text('Open')), OutlinedButton(onPressed: _sending ? null : () => _send('CLOSE_GATE'), child: const Text('Close'))]),
          const SizedBox(height: 12),
          _ActionCard(icon: Icons.shield_outlined, title: 'Security', state: d?['securityArmed'] == true ? 'Armed' : 'Disarmed', children: [FilledButton(onPressed: _sending ? null : () => _send('SET_SECURITY:armed'), child: const Text('Arm')), OutlinedButton(onPressed: _sending ? null : () => _send('SET_SECURITY:off'), child: const Text('Disarm')), OutlinedButton(onPressed: _sending ? null : () => _send('TRIGGER_ALARM'), child: const Text('Alarm'))]),
          const SizedBox(height: 24),
          Text(d == null ? 'No device data yet' : 'Wi-Fi ${d['wifiRssi']} dBm · Device $deviceId', textAlign: TextAlign.center, style: Theme.of(context).textTheme.bodySmall),
        ]),
      ),
    );
  }
}

String _decimal(dynamic value) => value is num ? value.toStringAsFixed(1) : '—';
String _onOff(dynamic value) => value == true ? 'on' : 'off';

class _ConnectionBanner extends StatelessWidget {
  const _ConnectionBanner({required this.online, this.error, this.updatedAt});
  final bool online; final String? error; final String? updatedAt;
  @override Widget build(BuildContext context) => Card(color: online ? const Color(0xffecfdf5) : const Color(0xfffff7ed), child: Padding(padding: const EdgeInsets.all(16), child: Row(children: [Icon(online ? Icons.cloud_done : Icons.cloud_off), const SizedBox(width: 12), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(online ? 'ESP32 online' : 'ESP32 offline', style: const TextStyle(fontWeight: FontWeight.bold)), Text(error ?? (updatedAt == null ? 'Waiting for the first telemetry packet' : 'Last update ${DateTime.parse(updatedAt!).toLocal()}'))]))])));
}

class _ModeCard extends StatelessWidget {
  const _ModeCard({required this.icon, required this.title, required this.value, required this.detail, required this.mode, required this.disabled, required this.onMode});
  final IconData icon; final String title, value, detail; final String? mode; final bool disabled; final ValueChanged<String> onMode;
  @override Widget build(BuildContext context) => Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Row(children: [Icon(icon), const SizedBox(width: 8), Text(title, style: const TextStyle(fontWeight: FontWeight.bold))]), const Spacer(), Text(value, style: Theme.of(context).textTheme.titleMedium), Text(detail, style: Theme.of(context).textTheme.bodySmall), const SizedBox(height: 12), SegmentedButton<String>(segments: const [ButtonSegment(value: 'AUTO', label: Text('Auto')), ButtonSegment(value: 'ON', label: Text('On')), ButtonSegment(value: 'OFF', label: Text('Off'))], selected: {mode ?? 'AUTO'}, onSelectionChanged: disabled ? null : (v) => onMode(v.first))])));
}

class _ActionCard extends StatelessWidget {
  const _ActionCard({required this.icon, required this.title, required this.state, required this.children});
  final IconData icon; final String title, state; final List<Widget> children;
  @override Widget build(BuildContext context) => Card(child: Padding(padding: const EdgeInsets.all(16), child: Wrap(crossAxisAlignment: WrapCrossAlignment.center, spacing: 12, runSpacing: 8, children: [Icon(icon), SizedBox(width: 150, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(title, style: const TextStyle(fontWeight: FontWeight.bold)), Text(state)])), ...children])));
}
