import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'daily_view.dart';
import 'annually_view.dart';
import 'settings_screen.dart';
import 'package:sql_conn/sql_conn.dart';
import '../database/sql_service.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  int _currentIndex = 0;
  String _companyName = "";

  @override
  void initState() {
    super.initState();
    _fetchCompany();
  }

  Future<void> _fetchCompany() async {
    bool connected = await SqlService().connect();
    if (connected) {
      try {
        String qCompany = '''
          SELECT datachar1 + ' - ' + datachar2 as company_name
          FROM flexnotesetting 
          WHERE settingtypecode = 'customerinfo1'
        ''';
        var resCompany = await SqlConn.read("mainDB", qCompany);
        if (resCompany.isNotEmpty) {
          if (mounted) {
            setState(() {
              _companyName = resCompany.first['company_name']?.toString() ?? "";
            });
          }
        }
      } catch (e) {
        print("Company query error: $e");
      }
    }
  }

  List<Widget> _pages = [
    const DailyView(),
    const AnnuallyView(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: Colors.white.withOpacity(0.8),
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        title: Row(
          children: [
            ClipOval(
              child: Image.asset(
                'assets/images/FXT_Icon.png',
                width: 40,
                height: 40,
                fit: BoxFit.cover,
                errorBuilder: (context, error, stackTrace) {
                  return Container(
                    width: 40,
                    height: 40,
                    color: Colors.blue[800],
                    child: const Center(
                      child: Text("fx", style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontStyle: FontStyle.italic)),
                    ),
                  );
                },
              ),
            ),
            const SizedBox(width: 12),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Flexnote Suites',
                  style: GoogleFonts.plusJakartaSans(
                    fontWeight: FontWeight.bold,
                    color: Colors.black87,
                    fontSize: 20,
                  ),
                ),
                if (_companyName.isNotEmpty)
                  Text(
                    _companyName,
                    style: TextStyle(
                      fontSize: 12,
                      color: Colors.grey[600],
                      fontWeight: FontWeight.w500,
                    ),
                  ),
              ],
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.settings, color: Colors.black54),
            onPressed: () async {
              final shouldRefresh = await Navigator.push(
                context,
                MaterialPageRoute(builder: (context) => const SettingsScreen()),
              );
              // Force rebuild screens to trigger a new fetch
              if (shouldRefresh == true) {
                setState(() {
                  _pages = [
                    // Keys ensure the widget completely rebuilds
                    DailyView(key: UniqueKey()),
                    AnnuallyView(key: UniqueKey()),
                  ];
                });
              }
            },
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: _pages[_currentIndex],
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: (index) {
          setState(() {
            _currentIndex = index;
          });
        },
        backgroundColor: Colors.white,
        indicatorColor: const Color(0xFFFF5C35).withOpacity(0.1),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.grid_view_outlined, color: Colors.grey),
            selectedIcon: Icon(Icons.grid_view, color: Color(0xFFFF5C35)),
            label: 'Daily',
          ),
          NavigationDestination(
            icon: Icon(Icons.calendar_today_outlined, color: Colors.grey),
            selectedIcon: Icon(Icons.calendar_today, color: Color(0xFFFF5C35)),
            label: 'Annually',
          ),
        ],
      ),
    );
  }
}
