import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:convert';

class WidgetConfig {
  final String id;
  String title;
  bool isVisible;
  int orderIndex;
  String displayType;
  final List<String> availableTypes;
  String colorTheme;

  WidgetConfig({
    required this.id,
    required this.title,
    this.isVisible = true,
    required this.orderIndex,
    required this.displayType,
    required this.availableTypes,
    required this.colorTheme,
  });

  Map<String, dynamic> toJson() => {
    'id': id,
    'title': title,
    'isVisible': isVisible,
    'orderIndex': orderIndex,
    'displayType': displayType,
    'availableTypes': availableTypes,
    'colorTheme': colorTheme,
  };

  factory WidgetConfig.fromJson(Map<String, dynamic> json) => WidgetConfig(
    id: json['id'],
    title: json['title'],
    isVisible: json['isVisible'],
    orderIndex: json['orderIndex'],
    displayType: json['displayType'],
    availableTypes: List<String>.from(json['availableTypes']),
    colorTheme: json['colorTheme'],
  );

  List<Color> getColors() {
    switch (colorTheme) {
      case 'orange': return [const Color(0xFFFF8566), const Color(0xFFFF5C35)];
      case 'teal': return [const Color(0xFF4DB6AC), const Color(0xFF00897B)];
      case 'blue': return [const Color(0xFF64B5F6), const Color(0xFF1E88E5)];
      case 'purple': return [const Color(0xFF9575CD), const Color(0xFF5E35B1)];
      case 'green': return [const Color(0xFF81C784), const Color(0xFF43A047)];
      case 'red': return [const Color(0xFFE57373), const Color(0xFFE53935)];
      default: return [const Color(0xFFB0BEC5), const Color(0xFF78909C)];
    }
  }

  static const List<String> availableThemes = [
    'orange', 'teal', 'blue', 'purple', 'green', 'red'
  ];

  static Future<List<WidgetConfig>> loadConfigs(String prefKey, List<WidgetConfig> defaults) async {
    final prefs = await SharedPreferences.getInstance();
    final String? jsonStr = prefs.getString(prefKey);
    if (jsonStr != null) {
      try {
        List<dynamic> listRaw = jsonDecode(jsonStr);
        List<WidgetConfig> configs = listRaw.map((v) => WidgetConfig.fromJson(v)).toList();
        
        // Ensure all defaults exist (if a new version adds a new widget)
        for (var def in defaults) {
          if (!configs.any((c) => c.id == def.id)) {
            configs.add(def);
          }
        }
        configs.sort((a, b) => a.orderIndex.compareTo(b.orderIndex));
        return configs;
      } catch (e) {
        print("Error parsing configs: $e");
        return defaults;
      }
    }
    return defaults;
  }

  static Future<void> saveConfigs(String prefKey, List<WidgetConfig> configs) async {
    final prefs = await SharedPreferences.getInstance();
    // Update order index before saving
    for (int i = 0; i < configs.length; i++) {
      configs[i].orderIndex = i;
    }
    String jsonStr = jsonEncode(configs.map((c) => c.toJson()).toList());
    await prefs.setString(prefKey, jsonStr);
  }
}

// Global defaults for Daily View
final List<WidgetConfig> defaultDailyConfigs = [
  WidgetConfig(id: 'daily_revenue', title: 'Total Revenue', orderIndex: 0, displayType: 'kpi', availableTypes: ['kpi'], colorTheme: 'orange'),
  WidgetConfig(id: 'daily_orders', title: 'Total Orders', orderIndex: 1, displayType: 'kpi', availableTypes: ['kpi'], colorTheme: 'teal'),
  WidgetConfig(id: 'daily_group', title: 'Penjualan per Grup Barang', orderIndex: 2, displayType: 'top_list', availableTypes: ['top_list', 'bar_chart', 'pie_chart'], colorTheme: 'blue'),
  WidgetConfig(id: 'daily_costcenter', title: 'Perbandingan Costcenter', orderIndex: 3, displayType: 'top_list', availableTypes: ['top_list', 'bar_chart', 'pie_chart'], colorTheme: 'purple'),
  WidgetConfig(id: 'daily_chart', title: 'Revenue Analysis', orderIndex: 4, displayType: 'line_chart', availableTypes: ['line_chart', 'bar_chart'], colorTheme: 'green'),
  WidgetConfig(id: 'daily_cashier', title: 'Sales By Cashier', orderIndex: 5, displayType: 'pie_chart', availableTypes: ['pie_chart', 'bar_chart', 'top_list'], colorTheme: 'orange'),
  WidgetConfig(id: 'daily_recent', title: 'Recent Transactions', orderIndex: 6, displayType: 'list', availableTypes: ['list'], colorTheme: 'blue'),
];

// Global defaults for Annually View
final List<WidgetConfig> defaultAnnuallyConfigs = [
  WidgetConfig(id: 'annual_revenue', title: 'Annual Revenue', orderIndex: 0, displayType: 'kpi', availableTypes: ['kpi'], colorTheme: 'orange'),
  WidgetConfig(id: 'annual_orders', title: 'Total Orders', orderIndex: 1, displayType: 'kpi', availableTypes: ['kpi'], colorTheme: 'teal'),
  WidgetConfig(id: 'annual_chart', title: 'Sales Overview', orderIndex: 2, displayType: 'bar_chart', availableTypes: ['bar_chart', 'line_chart'], colorTheme: 'blue'),
  WidgetConfig(id: 'annual_cashier', title: 'Sales By Cashier', orderIndex: 3, displayType: 'pie_chart', availableTypes: ['pie_chart', 'bar_chart', 'top_list'], colorTheme: 'purple'),
];
