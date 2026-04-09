import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:sql_conn/sql_conn.dart';
import 'dart:ui';
import '../database/sql_service.dart';
import '../models/widget_config.dart';

class DailyView extends StatefulWidget {
  const DailyView({super.key});

  @override
  State<DailyView> createState() => _DailyViewState();
}

class _DailyViewState extends State<DailyView> {
  DateTime _startDate = DateTime.now();
  DateTime _endDate = DateTime.now();
  
  bool _isLoading = false;
  Map<String, dynamic>? _kpiData;
  List<dynamic> _groupDataList = [];
  List<dynamic> _recentTrans = [];
  List<dynamic> _chartData = [];
  String? _errorMessage;
  
  List<dynamic> _costcenterDataList = [];
  
  List<dynamic> _cashierData = [];
  double _totalCashierSales = 0;
  
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
      String startStr = "${DateFormat('yyyyMMdd').format(_startDate)} 00:00:00";
      String endStr = "${DateFormat('yyyyMMdd').format(_endDate)} 23:59:59";
      
      try {
        String qKpi = '''
          SELECT 
            SUM(ABS(ltl.netvalue + ltl.pajakvalue)) as total_sales, 
            COUNT(DISTINCT lt.logtransid) as total_orders 
          FROM logtrans lt
          JOIN logtransline ltl ON lt.logtransid = ltl.logtransid
          WHERE lt.entrydate BETWEEN '$startStr' AND '$endStr'
          AND lt.transtypeid IN (10, 18)
        ''';
        var resKpi = await SqlConn.read("mainDB", qKpi);
        if (resKpi.isNotEmpty) {
          _kpiData = resKpi.first;
        }

        String qGroup = '''
          SELECT itemgroupcode, masteritemgroup.description, -SUM(logtransline.netvalue+pajakvalue) as total
          FROM logtrans
          JOIN logtransline ON logtrans.logtransid = logtransline.logtransid
          JOIN masteritem ON logtransline.itemid = masteritem.itemid
          JOIN masteritemgroup ON masteritem.itemgroupid = masteritemgroup.itemgroupid
          WHERE logtrans.entrydate BETWEEN '$startStr' AND '$endStr'
          AND logtrans.transtypeid IN (10, 18)
          AND (masteritemgroup.description NOT LIKE '%bahan%' AND itemgroupcode <> 'UMUM')
          GROUP BY itemgroupcode, masteritemgroup.description
          HAVING -SUM(logtransline.netvalue+pajakvalue) > 0
          ORDER BY total DESC
        ''';
        _groupDataList = await SqlConn.read("mainDB", qGroup);

        String qCostcenter = '''
          SELECT mastercostcenter.description, SUM(ABS(logtransline.netvalue+pajakvalue)) as total
          FROM logtrans
          JOIN logtransline ON logtrans.logtransid = logtransline.logtransid
          JOIN mastercostcenter ON logtrans.costcenterid = mastercostcenter.costcenterid
          WHERE logtrans.entrydate BETWEEN '$startStr' AND '$endStr'
          AND logtrans.transtypeid IN (10, 18)
          GROUP BY mastercostcenter.description
          ORDER BY total DESC
        ''';
        _costcenterDataList = await SqlConn.read("mainDB", qCostcenter);

        String qCashier = '''
          SELECT createby, SUM(ABS(logtransline.netvalue+pajakvalue)) as total
          FROM logtrans
          JOIN logtransline ON logtrans.logtransid = logtransline.logtransid
          WHERE logtrans.entrydate BETWEEN '$startStr' AND '$endStr'
          AND logtrans.transtypeid IN (10, 18)
          GROUP BY createby
          ORDER BY total DESC
        ''';
        _cashierData = await SqlConn.read("mainDB", qCashier);
        
        double cTotal = 0;
        for (var c in _cashierData) {
          cTotal += (c['total'] is String ? double.tryParse(c['total']) ?? 0 : (c['total'] as num).toDouble());
        }
        _totalCashierSales = cTotal;

        String qRecent = '''
          SELECT TOP 10 lt.logtransentrytext, r.name as sales_name, lt.entrydate, 
          SUM(ABS(ltl.netvalue + ltl.pajakvalue)) as total, lt.transtypeid
          FROM logtrans lt
          JOIN masterrepresentative r ON lt.representativeid = r.representativeid
          JOIN logtransline ltl ON lt.logtransid = ltl.logtransid
          WHERE lt.entrydate BETWEEN '$startStr' AND '$endStr'
          AND lt.transtypeid IN (10, 18)
          GROUP BY lt.logtransentrytext, r.name, lt.entrydate, lt.transtypeid
          ORDER BY lt.entrydate DESC
        ''';
        _recentTrans = await SqlConn.read("mainDB", qRecent);

        String qChart = '''
          SELECT CAST(lt.entrydate AS DATE) as tgl, 
            SUM(CASE WHEN lt.transtypeid = 18 THEN ABS(ltl.netvalue + ltl.pajakvalue) ELSE 0 END) as tunai,
            SUM(CASE WHEN lt.transtypeid = 10 THEN ABS(ltl.netvalue + ltl.pajakvalue) ELSE 0 END) as kredit
          FROM logtrans lt
          JOIN logtransline ltl ON lt.logtransid = ltl.logtransid
          WHERE lt.entrydate BETWEEN '$startStr' AND '$endStr'
          AND lt.transtypeid IN (10, 18)
          GROUP BY CAST(lt.entrydate AS DATE) ORDER BY tgl ASC
        ''';
        _chartData = await SqlConn.read("mainDB", qChart);

      } catch(e) {
        _errorMessage = "Query Error: $e";
        print("Error fetching data: $e");
      }
    } else {
      _errorMessage = db.lastError ?? "SQL Connection Failed. Check Server IP in Settings.";
      print("SQL Connection Failed: ${db.lastError}");
    }

    _configs = await WidgetConfig.loadConfigs('daily_widgets_config', defaultDailyConfigs);
    setState(() => _isLoading = false);
  }

  Future<void> _selectDateRange() async {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (BuildContext context) {
        return Container(
          padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                leading: const Icon(Icons.today, color: Color(0xFFFF5C35)),
                title: const Text("Hari Ini", style: TextStyle(fontWeight: FontWeight.bold)),
                onTap: () {
                  Navigator.pop(context);
                  setState(() {
                    _startDate = DateTime.now();
                    _endDate = DateTime.now();
                  });
                  _fetchData();
                },
              ),
              ListTile(
                leading: const Icon(Icons.calendar_month, color: Color(0xFFFF5C35)),
                title: const Text("Bulan Ini", style: TextStyle(fontWeight: FontWeight.bold)),
                onTap: () {
                  Navigator.pop(context);
                  setState(() {
                    DateTime now = DateTime.now();
                    _startDate = DateTime(now.year, now.month, 1);
                    _endDate = DateTime.now();
                  });
                  _fetchData();
                },
              ),
              ListTile(
                leading: const Icon(Icons.history, color: Color(0xFFFF5C35)),
                title: const Text("Bulan Lalu", style: TextStyle(fontWeight: FontWeight.bold)),
                onTap: () {
                  Navigator.pop(context);
                  setState(() {
                    DateTime now = DateTime.now();
                    _startDate = DateTime(now.year, now.month - 1, 1);
                    _endDate = DateTime(now.year, now.month, 0);
                  });
                  _fetchData();
                },
              ),
              ListTile(
                leading: const Icon(Icons.date_range, color: Color(0xFFFF5C35)),
                title: const Text("Pilih Custom...", style: TextStyle(fontWeight: FontWeight.bold)),
                onTap: () async {
                  Navigator.pop(context);
                  final DateTimeRange? picked = await showDateRangePicker(
                    context: context,
                    firstDate: DateTime(2020),
                    lastDate: DateTime.now(),
                    initialDateRange: DateTimeRange(start: _startDate, end: _endDate),
                    builder: (context, child) {
                      return Theme(
                        data: ThemeData.light().copyWith(
                          colorScheme: const ColorScheme.light(primary: Color(0xFFFF5C35)),
                        ),
                        child: child!,
                      );
                    },
                  );
                  if (picked != null) {
                    setState(() {
                      _startDate = picked.start;
                      _endDate = picked.end;
                    });
                    _fetchData();
                  }
                },
              ),
            ],
          ),
        );
      },
    );
  }

  String formatCurrency(dynamic amount) {
    if (amount == null) return "0";
    double value = amount is String ? double.tryParse(amount) ?? 0 : (amount as num).toDouble();
    return NumberFormat.currency(locale: 'id', symbol: 'Rp ', decimalDigits: 0).format(value);
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
              Text("Daily Sales Overview", style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.grey[800])),
              InkWell(
                onTap: _selectDateRange,
                borderRadius: BorderRadius.circular(12),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    border: Border.all(color: Colors.grey[200]!),
                    borderRadius: BorderRadius.circular(12),
                    boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 4, offset: const Offset(0, 2))],
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.calendar_today, size: 14, color: Colors.grey[600]),
                      const SizedBox(width: 8),
                      Text(
                        "${DateFormat('dd MMM').format(_startDate)} - ${DateFormat('dd MMM').format(_endDate)}",
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.grey[700]),
                      )
                    ],
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
      case 'daily_revenue':
        return _buildColoredCard(title: config.title, value: formatCurrency(_kpiData?['total_sales']), subtitle: "Periode Terpilih", icon: Icons.trending_up, colors: config.getColors());
      case 'daily_orders':
        return _buildColoredCard(title: config.title, value: "${_kpiData?['total_orders'] ?? 0}", subtitle: "Transaksi", icon: Icons.shopping_bag_outlined, colors: config.getColors());
      case 'daily_group':
        return _buildGenericDataCard(config, _groupDataList, "description", "total", Icons.category_outlined);
      case 'daily_costcenter':
        return _buildGenericDataCard(config, _costcenterDataList, "description", "total", Icons.business_outlined);
      case 'daily_chart':
        return _buildTimelineChartCard(config);
      case 'daily_cashier':
        return _buildGenericDataCard(config, _cashierData, "createby", "total", Icons.person);
      case 'daily_recent':
        return _buildRecentCard(config);
      default:
        return const SizedBox.shrink();
    }
  }

  Widget _buildGenericDataCard(WidgetConfig config, List<dynamic> data, String nameKey, String valKey, IconData icon) {
    if (config.displayType == 'top_list') {
      return _buildListCard(title: config.title, items: data, nameKey: nameKey, valueKey: valKey, icon: icon, colors: config.getColors());
    }
    
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

  Widget _buildTimelineChartCard(WidgetConfig config) {
    return Container(
      height: 300, padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20), boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 10)]),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(config.title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
              Row(children: [
                _buildLegendDot(const Color(0xFF10B981), "Tunai"),
                const SizedBox(width: 12),
                _buildLegendDot(Colors.blue, "Kredit"),
              ])
            ],
          ),
          const SizedBox(height: 16),
          Expanded(child: config.displayType == 'bar_chart' ? _buildTimelineBarChart() : _buildLineChart()),
        ],
      )
    );
  }

  Widget _buildTimelineBarChart() {
    if (_chartData.isEmpty) return const Center(child: Text("No Data"));
    double maxVal = 0;
    for (var row in _chartData) {
      double t = (row['tunai'] is String ? double.tryParse(row['tunai']) ?? 0 : (row['tunai'] as num).toDouble());
      double k = (row['kredit'] is String ? double.tryParse(row['kredit']) ?? 0 : (row['kredit'] as num).toDouble());
      if (t > maxVal) maxVal = t;
      if (k > maxVal) maxVal = k;
    }
    return BarChart(BarChartData(
      alignment: BarChartAlignment.spaceAround, maxY: maxVal * 1.2,
      barTouchData: BarTouchData(
        enabled: true,
        touchTooltipData: BarTouchTooltipData(getTooltipItem: (group, groupIndex, rod, rodIndex) => BarTooltipItem(formatCurrency(rod.toY), const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)))
      ),
      titlesData: FlTitlesData(
        show: true,
        bottomTitles: AxisTitles(sideTitles: SideTitles(showTitles: true, reservedSize: 30, getTitlesWidget: (value, meta) {
          if (value.toInt() >= 0 && value.toInt() < _chartData.length) {
            if (_chartData.length > 7 && value.toInt() % (_chartData.length ~/ 5) != 0) return const SizedBox.shrink();
            String tgl = _chartData[value.toInt()]['tgl'];
            DateTime dt = DateTime.tryParse(tgl) ?? DateTime.now();
            return Padding(padding: const EdgeInsets.only(top: 8.0), child: Text(DateFormat('dd MMM').format(dt), style: TextStyle(fontSize: 10, color: Colors.grey[500])));
          }
          return const SizedBox.shrink();
        })),
        leftTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
        topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
        rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
      ),
      gridData: FlGridData(show: false), borderData: FlBorderData(show: false),
      barGroups: List.generate(_chartData.length, (i) {
        var row = _chartData[i];
        double t = (row['tunai'] is String ? double.tryParse(row['tunai']) ?? 0 : (row['tunai'] as num).toDouble());
        double k = (row['kredit'] is String ? double.tryParse(row['kredit']) ?? 0 : (row['kredit'] as num).toDouble());
        return BarChartGroupData(x: i, barRods: [
          BarChartRodData(toY: t, color: const Color(0xFF10B981), width: 6),
          BarChartRodData(toY: k, color: Colors.blue, width: 6),
        ]);
      }),
    ));
  }

  Widget _buildRecentCard(WidgetConfig config) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20), boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 10)]),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(config.title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
          const SizedBox(height: 16),
          ListView.separated(
            shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), itemCount: _recentTrans.length,
            separatorBuilder: (context, index) => const Divider(height: 24),
            itemBuilder: (context, index) {
              var item = _recentTrans[index];
              bool isTunai = item['transtypeid'] == 18;
              return Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text("${item['logtransentrytext']}", style: const TextStyle(fontWeight: FontWeight.bold)),
                        Text("${item['sales_name']} • ${item['entrydate'].toString().split(' ').first}", style: TextStyle(fontSize: 12, color: Colors.grey[500])),
                      ],
                    ),
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(formatCurrency(item['total']), style: const TextStyle(fontWeight: FontWeight.bold)),
                      const SizedBox(height: 4),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(color: isTunai ? const Color(0xFF10B981).withOpacity(0.1) : Colors.blue.withOpacity(0.1), borderRadius: BorderRadius.circular(10)),
                        child: Text(isTunai ? "TUNAI" : "KREDIT", style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: isTunai ? const Color(0xFF10B981) : Colors.blue)),
                      )
                    ],
                  )
                ],
              );
            },
          ),
        ],
      )
    );
  }

  Widget _buildLegendDot(Color color, String text) {
    return Row(
      children: [
        Container(width: 8, height: 8, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
        const SizedBox(width: 4),
        Text(text, style: TextStyle(fontSize: 12, color: Colors.grey[600])),
      ],
    );
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

  Widget _buildLineChart() {
    if (_chartData.isEmpty) return const Center(child: Text("No Data"));
    
    List<FlSpot> tunaiSpots = [];
    List<FlSpot> kreditSpots = [];
    
    double maxVal = 0;
    
    for (int i = 0; i < _chartData.length; i++) {
      var row = _chartData[i];
      dynamic tVal = row['tunai'];
      dynamic kVal = row['kredit'];
      double tunai = (tVal is String ? double.tryParse(tVal) ?? 0 : (tVal as num).toDouble());
      double kredit = (kVal is String ? double.tryParse(kVal) ?? 0 : (kVal as num).toDouble());
      tunaiSpots.add(FlSpot(i.toDouble(), tunai));
      kreditSpots.add(FlSpot(i.toDouble(), kredit));
      if (tunai > maxVal) maxVal = tunai;
      if (kredit > maxVal) maxVal = kredit;
    }

    return LineChart(
      LineChartData(
        lineTouchData: LineTouchData(
          touchTooltipData: LineTouchTooltipData(
            getTooltipItems: (touchedSpots) {
              return touchedSpots.map((touchedSpot) {
                return LineTooltipItem(
                  formatCurrency(touchedSpot.y.toDouble()),
                  const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontFeatures: [FontFeature.tabularFigures()]),
                );
              }).toList();
            },
          ),
        ),
        gridData: FlGridData(show: false),
        titlesData: FlTitlesData(
          rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          leftTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          bottomTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              reservedSize: 30,
              getTitlesWidget: (value, meta) {
                if (value.toInt() >= 0 && value.toInt() < _chartData.length) {
                  if (_chartData.length > 7 && value.toInt() % (_chartData.length ~/ 5) != 0) {
                     return const SizedBox.shrink();
                  }
                  String tgl = _chartData[value.toInt()]['tgl'];
                  DateTime dt = DateTime.tryParse(tgl) ?? DateTime.now();
                  return Padding(
                    padding: const EdgeInsets.only(top: 8.0),
                    child: Text(DateFormat('dd MMM').format(dt), style: TextStyle(fontSize: 10, color: Colors.grey[500])),
                  );
                }
                return const SizedBox.shrink();
              },
            ),
          ),
        ),
        borderData: FlBorderData(show: false),
        minX: 0,
        maxX: (_chartData.length - 1).toDouble(),
        minY: 0,
        maxY: maxVal * 1.2,
        lineBarsData: [
          LineChartBarData(
            spots: tunaiSpots,
            isCurved: true,
            color: const Color(0xFF10B981),
            barWidth: 3,
            isStrokeCapRound: true,
            dotData: const FlDotData(show: false),
            belowBarData: BarAreaData(
              show: true,
              color: const Color(0xFF10B981).withOpacity(0.1),
            ),
          ),
          LineChartBarData(
            spots: kreditSpots,
            isCurved: true,
            color: Colors.blue,
            barWidth: 3,
            isStrokeCapRound: true,
            dotData: const FlDotData(show: false),
            belowBarData: BarAreaData(
              show: true,
              color: Colors.blue.withOpacity(0.1),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildListCard({
    required String title,
    required List<dynamic> items,
    required String nameKey,
    required String valueKey,
    required IconData icon,
    required List<Color> colors,
  }) {
    if (items.isEmpty) return const SizedBox.shrink();

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
                const SizedBox(height: 16),
                ...items.map((item) {
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 12.0),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Text(
                            item[nameKey]?.toString() ?? "-",
                            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Colors.white),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          formatCurrency(item[valueKey]),
                          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.white, fontFeatures: [FontFeature.tabularFigures()]),
                        ),
                      ],
                    ),
                  );
                }).toList(),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCashierPieChart() {
    if (_cashierData.isEmpty) return const Center(child: Text("No Data"));
    
    return PieChart(
      PieChartData(
        sectionsSpace: 2,
        centerSpaceRadius: 40,
        sections: _cashierData.take(5).toList().asMap().entries.map((entry) {
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
