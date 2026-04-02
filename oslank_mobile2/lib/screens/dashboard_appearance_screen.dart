import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../models/widget_config.dart';

class DashboardAppearanceScreen extends StatefulWidget {
  const DashboardAppearanceScreen({super.key});

  @override
  State<DashboardAppearanceScreen> createState() => _DashboardAppearanceScreenState();
}

class _DashboardAppearanceScreenState extends State<DashboardAppearanceScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  List<WidgetConfig> _dailyConfigs = [];
  List<WidgetConfig> _annuallyConfigs = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _loadConfigs();
  }

  Future<void> _loadConfigs() async {
    _dailyConfigs = await WidgetConfig.loadConfigs('daily_widgets_config', defaultDailyConfigs);
    _annuallyConfigs = await WidgetConfig.loadConfigs('annual_widgets_config', defaultAnnuallyConfigs);
    setState(() {
      _isLoading = false;
    });
  }

  Future<void> _saveAll() async {
    await WidgetConfig.saveConfigs('daily_widgets_config', _dailyConfigs);
    await WidgetConfig.saveConfigs('annual_widgets_config', _annuallyConfigs);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Dashboard layout saved!'))
    );
    Navigator.pop(context, true);
  }

  void _onReorder(int oldIndex, int newIndex, List<WidgetConfig> list) {
    setState(() {
      if (newIndex > oldIndex) {
        newIndex -= 1;
      }
      final item = list.removeAt(oldIndex);
      list.insert(newIndex, item);
    });
  }

  void _showEditDialog(WidgetConfig config, VoidCallback onUpdate) {
    final titleCtrl = TextEditingController(text: config.title);
    String selectedType = config.displayType;
    String selectedTheme = config.colorTheme;

    showDialog(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return AlertDialog(
              title: const Text("Edit Widget", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text("Title"),
                    const SizedBox(height: 8),
                    TextField(
                      controller: titleCtrl,
                      decoration: const InputDecoration(border: OutlineInputBorder(), isDense: true),
                    ),
                    const SizedBox(height: 16),
                    if (config.availableTypes.length > 1) ...[
                      const Text("Display Mode"),
                      const SizedBox(height: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        decoration: BoxDecoration(border: Border.all(color: Colors.grey), borderRadius: BorderRadius.circular(4)),
                        child: DropdownButton<String>(
                          value: selectedType,
                          isExpanded: true,
                          underline: const SizedBox(),
                          items: config.availableTypes.map((t) {
                            return DropdownMenuItem(value: t, child: Text(t.replaceAll('_', ' ').toUpperCase()));
                          }).toList(),
                          onChanged: (val) {
                            if (val != null) setModalState(() => selectedType = val);
                          },
                        ),
                      ),
                      const SizedBox(height: 16),
                    ],
                    const Text("Color Theme"),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: WidgetConfig.availableThemes.map((theme) {
                        bool isSelected = selectedTheme == theme;
                        Color c;
                        switch(theme) {
                          case 'orange': c = Colors.orange; break;
                          case 'teal': c = Colors.teal; break;
                          case 'blue': c = Colors.blue; break;
                          case 'purple': c = Colors.purple; break;
                          case 'green': c = Colors.green; break;
                          case 'red': c = Colors.red; break;
                          default: c = Colors.grey; break;
                        }
                        return GestureDetector(
                          onTap: () => setModalState(() => selectedTheme = theme),
                          child: Container(
                            width: 36, height: 36,
                            decoration: BoxDecoration(
                              color: c,
                              shape: BoxShape.circle,
                              border: isSelected ? Border.all(color: Colors.black, width: 3) : null,
                            ),
                          ),
                        );
                      }).toList(),
                    )
                  ],
                ),
              ),
              actions: [
                TextButton(onPressed: () => Navigator.pop(ctx), child: const Text("Cancel")),
                ElevatedButton(
                  onPressed: () {
                    config.title = titleCtrl.text.trim();
                    config.displayType = selectedType;
                    config.colorTheme = selectedTheme;
                    onUpdate();
                    Navigator.pop(ctx);
                  },
                  style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFFF5C35)),
                  child: const Text("Save changes", style: TextStyle(color: Colors.white)),
                )
              ],
            );
          }
        );
      }
    );
  }

  Widget _buildList(List<WidgetConfig> list) {
    return Theme(
      data: Theme.of(context).copyWith(
        canvasColor: Colors.transparent,
      ),
      child: ReorderableListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: list.length,
        onReorder: (oldIdx, newIdx) => _onReorder(oldIdx, newIdx, list),
        itemBuilder: (context, index) {
          final item = list[index];
          return Card(
            key: ValueKey(item.id),
            margin: const EdgeInsets.only(bottom: 12),
            elevation: 2,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            child: ListTile(
              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              leading: Checkbox(
                value: item.isVisible,
                activeColor: const Color(0xFFFF5C35),
                onChanged: (val) {
                  setState(() => item.isVisible = val ?? true);
                },
              ),
              title: Text(item.title, style: const TextStyle(fontWeight: FontWeight.bold)),
              subtitle: Text("Type: ${item.displayType.replaceAll('_', ' ').toUpperCase()} • Theme: ${item.colorTheme}"),
              trailing: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  IconButton(
                    icon: const Icon(Icons.edit, color: Colors.blue),
                    onPressed: () => _showEditDialog(item, () => setState((){})),
                  ),
                  const Icon(Icons.drag_handle, color: Colors.grey),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey[50],
      appBar: AppBar(
        title: Text("Layout Customization", style: GoogleFonts.plusJakartaSans(color: Colors.black87, fontWeight: FontWeight.bold)),
        backgroundColor: Colors.white,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.black54),
        actions: [
          IconButton(
            icon: const Icon(Icons.save, color: Color(0xFFFF5C35)),
            onPressed: _saveAll,
            tooltip: 'Save Layout',
          )
        ],
        bottom: TabBar(
          controller: _tabController,
          labelColor: const Color(0xFFFF5C35),
          unselectedLabelColor: Colors.grey,
          indicatorColor: const Color(0xFFFF5C35),
          tabs: const [
            Tab(text: "Daily View"),
            Tab(text: "Annual View"),
          ],
        ),
      ),
      body: _isLoading 
        ? const Center(child: CircularProgressIndicator())
        : TabBarView(
            controller: _tabController,
            children: [
              _buildList(_dailyConfigs),
              _buildList(_annuallyConfigs),
            ],
          ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: const Color(0xFFFF5C35),
        onPressed: _saveAll,
        icon: const Icon(Icons.save, color: Colors.white),
        label: const Text("Save Configuration", style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
      ),
    );
  }
}
