import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:google_fonts/google_fonts.dart';
import '../database/sql_service.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final _hostController = TextEditingController();
  final _dbController = TextEditingController();

  bool _isLoading = true;
  int _tapCount = 0;

  @override
  void initState() {
    super.initState();
    _loadSettings();
  }

  Future<void> _loadSettings() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      _hostController.text = prefs.getString('db_host') ?? "cstde";
      _dbController.text = prefs.getString('db_name') ?? "kbrsbw3";
      _isLoading = false;
    });
  }

  Future<void> _saveSettings() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('db_host', _hostController.text.trim());
    await prefs.setString('db_name', _dbController.text.trim());
    
    // Disconnect so next fetch re-connects
    await SqlService().disconnect();

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Database settings saved! Application will now refresh.')),
      );
      Navigator.pop(context, true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey[50],
      appBar: AppBar(
        title: GestureDetector(
          onTap: () {
            _tapCount++;
            if (_tapCount >= 5) {
              _tapCount = 0;
              _showAdminPinDialog();
            }
          },
          child: Text(
            "Database Settings",
            style: GoogleFonts.plusJakartaSans(color: Colors.black87, fontWeight: FontWeight.bold),
          ),
        ),
        backgroundColor: Colors.white,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.black54),
      ),
      body: _isLoading 
        ? const Center(child: CircularProgressIndicator())
        : ListView(
            padding: const EdgeInsets.all(24.0),
            children: [
              _buildField("Server Host / IP", _hostController, Icons.computer),
              const SizedBox(height: 16),
              _buildField("Database Name", _dbController, Icons.storage),
              
              const SizedBox(height: 32),
              
              SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton(
                  onPressed: _saveSettings,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFFF5C35),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    elevation: 0,
                  ),
                  child: const Text("Save Configuration", style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white)),
                ),
              )
            ],
          ),
    );
  }

  Future<void> _showAdminPinDialog() async {
    final userCtrl = TextEditingController();
    final passCtrl = TextEditingController();
    
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text("Admin Access"),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(controller: userCtrl, decoration: const InputDecoration(labelText: "Admin Username")),
            const SizedBox(height: 8),
            TextField(controller: passCtrl, decoration: const InputDecoration(labelText: "Admin PIN"), obscureText: true),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text("Batal")),
          ElevatedButton(
            onPressed: () {
              if (userCtrl.text.trim() == "fxadmin" && passCtrl.text.trim() == "fx1234") {
                Navigator.pop(ctx);
                _showDatabaseCredentialsDialog();
              } else {
                ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("Akses Ditolak")));
                Navigator.pop(ctx);
              }
            },
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFFF5C35)),
            child: const Text("Login", style: TextStyle(color: Colors.white)),
          )
        ],
      ),
    );
  }

  Future<void> _showDatabaseCredentialsDialog() async {
    final prefs = await SharedPreferences.getInstance();
    final dbUserCtrl = TextEditingController(text: prefs.getString('db_user') ?? "fxt");
    final dbPassCtrl = TextEditingController(text: prefs.getString('db_pass') ?? "r3startsaja");

    if (!mounted) return;
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text("SQL Server Credentials"),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(controller: dbUserCtrl, decoration: const InputDecoration(labelText: "DB Username")),
            const SizedBox(height: 8),
            TextField(controller: dbPassCtrl, decoration: const InputDecoration(labelText: "DB Password"), obscureText: true),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text("Batal")),
          ElevatedButton(
            onPressed: () async {
              await prefs.setString('db_user', dbUserCtrl.text.trim());
              await prefs.setString('db_pass', dbPassCtrl.text.trim());
              await SqlService().disconnect();
              if (mounted) {
                Navigator.pop(ctx);
                ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("DB Credentials Saved")));
              }
            },
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFFF5C35)),
            child: const Text("Simpan", style: TextStyle(color: Colors.white)),
          )
        ],
      ),
    );
  }

  Widget _buildField(String label, TextEditingController controller, IconData icon) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.black87)),
        const SizedBox(height: 8),
        TextField(
          controller: controller,
          decoration: InputDecoration(
            prefixIcon: Icon(icon, color: Colors.grey[400]),
            filled: true,
            fillColor: Colors.white,
            contentPadding: const EdgeInsets.symmetric(vertical: 16),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: Colors.grey[300]!),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: Colors.grey[200]!),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: Color(0xFFFF5C35)),
            ),
          ),
        ),
      ],
    );
  }
}
