import 'package:sql_conn/sql_conn.dart';
import 'package:shared_preferences/shared_preferences.dart';

class SqlService {
  static final SqlService _instance = SqlService._internal();
  factory SqlService() => _instance;
  SqlService._internal();

  bool isConnected = false;
  final String connId = "mainDB";
  String? lastError;

  Future<bool> connect() async {
    try {
      if (isConnected) return true;
      lastError = null;
      
      final prefs = await SharedPreferences.getInstance();
      String rawHost = prefs.getString('db_host') ?? "cstde";
      String dbName = prefs.getString('db_name') ?? "kbrsbw3";
      String dbUser = prefs.getString('db_user') ?? "fxt";
      String dbPass = prefs.getString('db_pass') ?? "r3startsaja";

      String host = rawHost;
      int port = 1433;

      if (rawHost.contains(',')) {
        var parts = rawHost.split(',');
        host = parts[0].trim();
        port = int.tryParse(parts[1].trim()) ?? 1433;
      } else if (rawHost.contains(':')) {
        var parts = rawHost.split(':');
        host = parts[0].trim();
        port = int.tryParse(parts[1].trim()) ?? 1433;
      }

      isConnected = await SqlConn.connect(
        connectionId: connId,
        host: host, 
        port: port, 
        database: dbName, 
        username: dbUser, 
        password: dbPass
      );
      return isConnected;
    } catch (e) {
      lastError = e.toString();
      print("SQL Connection Error: $e");
      return false;
    }
  }

  Future<void> disconnect() async {
    if (isConnected) {
      await SqlConn.disconnect(connId);
      isConnected = false;
    }
  }
}
