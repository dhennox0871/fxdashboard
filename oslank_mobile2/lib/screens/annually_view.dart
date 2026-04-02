import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:sql_conn/sql_conn.dart';
import 'dart:ui';
import '../database/sql_service.dart';
import '../models/widget_config.dart';

class AnnuallyView extends StatefulWidget {
  const AnnuallyView({super.key});

  @override
  State<AnnuallyView> createState() => _AnnuallyViewState();
}

class _AnnuallyViewState extends State<AnnuallyView> {
  int _selectedYear = DateTime.now().year;
  
  bool _isLoading = false;
  double _annualRevenue = 0;
  int _totalOrders = 0;
  List<double> _monthlyData = List.filled(12, 0);
  List<dynamic> _distData = [];
  String? _errorMessage;
  List<WidgetConfig> _configs = [];
  
  final List<Color> _pieColors = [
    const Color(0xFFFF5C35),
    Colors.deepPurple,
    Colors.blue,
    const Color(0xFF10B981),
    Colors.amber,
    Colors.teal,
    Colors.indigo,
  ];

  @override
  void initState() {
    super.initState();
    _fetchData();
  }

  Future<void> _fetchData() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });
    
    final db = SqlService();
    bool connected = await db.connect();
    
    if (connected) {
      try {
        String qYearly = '''
          SELECT MONTH(lt.entrydate) as bulan, SUM(ABS(ltl.netvalue + ltl.pajakvalue)) as total 
          FROM logtrans lt
          JOIN logtransline ltl ON lt.logtransid = ltl.logtransid
          WHERE YEAR(lt.entrydate) = $_selectedYear
          AND lt.transtypeid IN (10, 18)
          GROUP BY MONTH(lt.entrydate)
          ORDER BY bulan ASC
        ''';
        var listYearly = await SqlConn.read("mainDB", qYearly);
        
        List<double> tempData = List.filled(12, 0);
        double totalRev = 0;
        for (var row in listYearly) {
          dynamic b = row['bulan'];
          dynamic t = row['total'];
          int bulan = (b is String ? int.parse(b) : (b as num).toInt()) - 1;
          double total = (t is String ? double.parse(t) : (t as num).toDouble());
          if (bulan >= 0 && bulan < 12) {
            tempData[bulan] = total;
            totalRev += total;
          }
        }
        _monthlyData = tempData;
        _annualRevenue = totalRev;

        String qYearKpi = '''
          SELECT COUNT(DISTINCT lt.logtransid) as total_orders 
          FROM logtrans lt 
          WHERE YEAR(lt.entrydate) = $_selectedYear AND lt.transtypeid IN (10,18)
        ''';
        var listKpi = await SqlConn.read("mainDB", qYearKpi);
        if (listKpi.isNotEmpty) {
          dynamic toVal = listKpi.first['total_orders'];
          _totalOrders = toVal is String ? int.parse(toVal) : (toVal as num).toInt();
        }

        String qDist = '''
          SELECT createby, SUM(ABS(logtransline.netvalue+pajakvalue)) as total
          FROM logtrans
          JOIN logtransline ON logtrans.logtransid = logtransline.logtransid
          WHERE YEAR(logtrans.entrydate) = $_selectedYear
          AND logtrans.transtypeid IN (10, 18)
          GROUP BY createby
          ORDER BY total DESC
        ''';
        _distData = await SqlConn.read("mainDB", qDist);

      } catch(e) {
        _errorMessage = "Query Error: $e";
        print("Error fetching annual data: $e");
      }
    } else {
      _errorMessage = db.lastError ?? "SQL Connection Failed. Check Server IP in Settings.";
    }

    _configs = await WidgetConfig.loadConfigs('annual_widgets_config', defaultAnnuallyConfigs);
    setState(() => _isLoading = false);
  }

  String formatCurrency(double amount) {
    return NumberFormat.currency(locale: 'id', symbol: 'Rp ', decimalDigits: 0).format(amount);
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text("Annual Performance", style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.grey[800])),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                decoration: BoxDecoration(
                  color: Colors.white,
                  border: Border.all(color: Colors.grey[200]!),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<int>(
                    value: _selectedYear,
                    icon: Icon(Icons.arrow_drop_down, color: Colors.grey[600]),
                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.grey[800]),
                    items: List.generate(5, (index) {
                      int year = DateTime.now().year - index;
                      return DropdownMenuItem(value: year, child: Text(year.toString()));
                    }),
                    onChanged: (val) {
                      if (val != null) {
                        setState(() => _selectedYear = val);
                        _fetchData();
                      }
                    },
                  ),
                ),
              )
            ],
          ),
          const SizedBox(height: 20),
          
          if (_errorMessage != null)
            Container(
              padding: const EdgeInsets.all(12),
              margin: const EdgeInsets.only(bottom: 16),
              decoration: BoxDecoration(color: Colors.red.withOpacity(0.1), borderRadius: BorderRadius.circular(8)),
              child: Text("$_errorMessage", style: const TextStyle(color: Colors.red, fontWeight: FontWeight.bold)),
            ),

          if (_isLoading)
            const Center(child: CircularProgressIndicator(color: Color(0xFFFF5C35)))
          else 
            ..._configs.where((c) => c.isVisible).map((c) => Padding(
              padding: const EdgeInsets.only(bottom: 24.0),
              child: _renderWidget(c),
            )).toList(),
        ],
      ),
    );
  }

  Widget _renderWidget(WidgetConfig config) {
    switch(config.id) {
      case 'annual_revenue':
        return _buildColoredCard(title: config.title, value: formatCurrency(_annualRevenue), subtitle: "Tahun $_selectedYear", icon: Icons.trending_up, colors: config.getColors());
      case 'annual_orders':
        return _buildColoredCard(title: config.title, value: NumberFormat('#,###', 'id').format(_totalOrders), subtitle: "Transaksi Tahun $_selectedYear", icon: Icons.shopping_bag_outlined, colors: config.getColors());
      case 'annual_chart':
        return _buildLineChartCard(config);
      case 'annual_cashier':
        return _buildGenericPieCard(config, _distData, "createby", "total");
      default:
        return const SizedBox.shrink();
    }
  }

  Widget _buildLineChartCard(WidgetConfig config) {
    return Container(
      height: 300, padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20), boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 10)]),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          RichText(text: TextSpan(text: "${config.title} ", style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.bold, fontSize: 16, color: Colors.black), children: [TextSpan(text: "Year $_selectedYear", style: TextStyle(fontWeight: FontWeight.normal, color: Colors.grey[400], fontSize: 14))])),
          const SizedBox(height: 24),
          Expanded(child: config.displayType == 'line_chart' ? _buildLineChartImpl(config) : _buildBarChart(config.getColors().first)),
        ],
      )
    );
  }

  Widget _buildLineChartImpl(WidgetConfig config) {
    double maxVal = _monthlyData.fold(0, (m, e) => e > m ? e : m);
    if (maxVal == 0) maxVal = 1;
    return LineChart(LineChartData(
      gridData: FlGridData(show: false),
      titlesData: FlTitlesData(
        show: true,
        bottomTitles: AxisTitles(sideTitles: SideTitles(showTitles: true, reservedSize: 30, getTitlesWidget: (val, meta) {
          const m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
          if (val >= 0 && val < 12) return Padding(padding: const EdgeInsets.only(top: 8), child: Text(m[val.toInt()], style: TextStyle(color: Colors.grey[400], fontSize: 10)));
          return const SizedBox.shrink();
        })),
        leftTitles: AxisTitles(sideTitles: SideTitles(showTitles: true, reservedSize: 40, getTitlesWidget: (val, meta) {
          if (val == 0) return const SizedBox.shrink();
          return Text("${(val / 1000000).toStringAsFixed(0)}M", style: TextStyle(color: Colors.grey[400], fontSize: 10));
        })),
        topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
        rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
      ),
      borderData: FlBorderData(show: false),
      minX: 0, maxX: 11, minY: 0, maxY: maxVal * 1.2,
      lineBarsData: [
        LineChartBarData(
          spots: List.generate(12, (i) => FlSpot(i.toDouble(), _monthlyData[i])),
          isCurved: true, color: config.getColors().first, barWidth: 3, isStrokeCapRound: true, dotData: const FlDotData(show: false),
          belowBarData: BarAreaData(show: true, color: config.getColors().first.withOpacity(0.1))
        )
      ]
    ));
  }

  Widget _buildGenericPieCard(WidgetConfig config, List<dynamic> data, String nameKey, String valKey) {
    if (data.isEmpty) return Container(height: 200, alignment: Alignment.center, child: const Text("No Data"));
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20), boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 10)]),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(config.title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
          const SizedBox(height: 24),
          if (config.displayType == 'pie_chart') 
            Row(
              children: [
                SizedBox(width: 140, height: 140, child: _renderGenericPieChart(data, valKey)),
                const SizedBox(width: 24),
                Expanded(child: _renderGenericPieLegend(data, nameKey, valKey)),
              ],
            )
          else if (config.displayType == 'bar_chart')
            SizedBox(height: 200, child: _renderGenericBarChart(data, nameKey, valKey, config.getColors().first))
          else if (config.displayType == 'top_list')
            Column(
              children: data.take(5).map((item) {
                return Padding(
                  padding: const EdgeInsets.only(bottom: 12.0),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(item[nameKey]?.toString() ?? '-', style: const TextStyle(fontWeight: FontWeight.bold)),
                      Text(formatCurrency(double.tryParse(item[valKey].toString()) ?? 0), style: const TextStyle(fontWeight: FontWeight.bold, fontFeatures: [FontFeature.tabularFigures()])),
                    ]
                  )
                );
              }).toList()
            )
        ],
      )
    );
  }

  Widget _renderGenericPieChart(List<dynamic> data, String valKey) {
    return PieChart(PieChartData(
      sectionsSpace: 2, centerSpaceRadius: 40,
      sections: data.take(5).toList().asMap().entries.map((entry) {
        dynamic tVal = entry.value[valKey];
        double val = tVal is String ? double.parse(tVal) : (tVal as num).toDouble();
        return PieChartSectionData(color: _pieColors[entry.key % _pieColors.length], value: val, title: '', radius: 20);
      }).toList(),
    ));
  }

  Widget _renderGenericPieLegend(List<dynamic> data, String nameKey, String valKey) {
    double total = 0;
    for (var d in data) {
      dynamic tVal = d[valKey];
      total += tVal is String ? double.parse(tVal) : (tVal as num).toDouble();
    }
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: data.take(5).toList().asMap().entries.map((entry) {
        dynamic tVal = entry.value[valKey];
        double val = tVal is String ? double.parse(tVal) : (tVal as num).toDouble();
        double pct = total > 0 ? (val / total) * 100 : 0;
        Color c = _pieColors[entry.key % _pieColors.length];
        return Padding(
          padding: const EdgeInsets.only(bottom: 8.0),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(children: [
                Container(width: 8, height: 8, decoration: BoxDecoration(color: c, shape: BoxShape.circle)),
                const SizedBox(width: 8),
                SizedBox(width: 70, child: Text(entry.value[nameKey]?.toString() ?? 'Unknown', style: TextStyle(fontSize: 12, color: Colors.grey[600]), maxLines: 1, overflow: TextOverflow.ellipsis)),
              ]),
              Text("${pct.toStringAsFixed(1)}%", style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, fontFeatures: [FontFeature.tabularFigures()])),
            ]
          )
        );
      }).toList()
    );
  }

  Widget _renderGenericBarChart(List<dynamic> data, String nameKey, String valKey, Color color) {
    var topData = data.take(5).toList();
    double maxVal = 0;
    for (var d in topData) {
      dynamic tVal = d[valKey];
      double val = tVal is String ? double.parse(tVal) : (tVal as num).toDouble();
      if (val > maxVal) maxVal = val;
    }
    if (maxVal == 0) maxVal = 1;

    return BarChart(BarChartData(
      alignment: BarChartAlignment.spaceAround, maxY: maxVal * 1.2,
      barTouchData: BarTouchData(
        enabled: true,
        touchTooltipData: BarTouchTooltipData(
          getTooltipItem: (group, groupIndex, rod, rodIndex) => BarTooltipItem(formatCurrency(rod.toY), const TextStyle(color: Colors.white, fontWeight: FontWeight.bold))
        )
      ),
      titlesData: FlTitlesData(
        show: true,
        bottomTitles: AxisTitles(sideTitles: SideTitles(showTitles: true, getTitlesWidget: (val, meta) {
          if (val >= 0 && val < topData.length) {
            String name = topData[val.toInt()][nameKey]?.toString() ?? '';
            if (name.length > 5) name = name.substring(0, 5);
            return Padding(padding: const EdgeInsets.only(top: 8.0), child: Text(name, style: TextStyle(color: Colors.grey[400], fontSize: 10)));
          }
          return const SizedBox.shrink();
        }, reservedSize: 30)),
        leftTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
        topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
        rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
      ),
      gridData: FlGridData(show: false), borderData: FlBorderData(show: false),
      barGroups: List.generate(topData.length, (i) {
        dynamic tVal = topData[i][valKey];
        double val = tVal is String ? double.parse(tVal) : (tVal as num).toDouble();
        return BarChartGroupData(x: i, barRods: [BarChartRodData(toY: val, color: color, width: 20, borderRadius: const BorderRadius.vertical(top: Radius.circular(4)))]);
      }),
    ));
  }

  Widget _buildColoredCard({required String title, required String value, required String subtitle, required IconData icon, required List<Color> colors}) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 16),
      clipBehavior: Clip.hardEdge,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: colors,
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: colors.last.withOpacity(0.3),
            blurRadius: 10,
            offset: const Offset(0, 5),
          )
        ],
      ),
      child: Stack(
        children: [
          Positioned(
            right: -20,
            bottom: -20,
            child: Icon(
              icon,
              size: 140,
              color: Colors.white.withOpacity(0.15),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(fontSize: 16, color: Colors.white70, fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
                Text(value, style: const TextStyle(fontSize: 32, fontWeight: FontWeight.bold, color: Colors.white, fontFeatures: [FontFeature.tabularFigures()]), maxLines: 1, overflow: TextOverflow.ellipsis),
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(subtitle, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.white)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBarChart(Color color) {
    double maxVal = _monthlyData.fold(0, (m, e) => e > m ? e : m);
    if (maxVal == 0) maxVal = 1;

    return BarChart(
      BarChartData(
        alignment: BarChartAlignment.spaceAround,
        maxY: maxVal * 1.2,
        barTouchData: BarTouchData(
          enabled: true,
          touchTooltipData: BarTouchTooltipData(
            getTooltipItem: (group, groupIndex, rod, rodIndex) {
              return BarTooltipItem(
                formatCurrency(rod.toY),
                const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontFeatures: [FontFeature.tabularFigures()]),
              );
            },
          ),
        ),
        titlesData: FlTitlesData(
          show: true,
          bottomTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              getTitlesWidget: (val, meta) {
                const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                if (val >= 0 && val < 12) {
                  return Padding(
                    padding: const EdgeInsets.only(top: 8.0),
                    child: Text(months[val.toInt()], style: TextStyle(color: Colors.grey[400], fontSize: 10)),
                  );
                }
                return const SizedBox.shrink();
              },
              reservedSize: 30,
            ),
          ),
          leftTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              reservedSize: 40,
              getTitlesWidget: (val, meta) {
                if (val == 0) return const SizedBox.shrink();
                return Text("${(val / 1000000).toStringAsFixed(0)}M", style: TextStyle(color: Colors.grey[400], fontSize: 10));
              },
            ),
          ),
          topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
        ),
        gridData: FlGridData(
          show: true,
          drawVerticalLine: false,
          getDrawingHorizontalLine: (val) => FlLine(color: Colors.grey[100], strokeWidth: 1, dashArray: [5, 5]),
        ),
        borderData: FlBorderData(show: false),
        barGroups: List.generate(12, (i) {
          return BarChartGroupData(
            x: i,
            barRods: [
              BarChartRodData(
                toY: _monthlyData[i],
                color: color,
                width: 12,
                borderRadius: const BorderRadius.vertical(top: Radius.circular(4)),
              )
            ],
          );
        }),
      ),
    );
  }

  Widget _buildPieChart() {
    if (_distData.isEmpty) return const Center(child: Text("No Data"));
    
    return PieChart(
      PieChartData(
        sectionsSpace: 2,
        centerSpaceRadius: 40,
        sections: _distData.take(5).toList().asMap().entries.map((entry) {
          int idx = entry.key;
          var row = entry.value;
          dynamic tVal = row['total'];
          double val = tVal is String ? double.parse(tVal) : (tVal as num).toDouble();
          return PieChartSectionData(
            color: _pieColors[idx % _pieColors.length],
            value: val,
            title: '',
            radius: 20,
          );
        }).toList(),
      ),
    );
  }
}
