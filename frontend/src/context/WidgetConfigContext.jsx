import React, { createContext, useState, useEffect, useContext } from 'react';

// Default configs (mirroring Flutter defaults)
const defaultDailyConfigs = [
  { id: 'daily_revenue', title: 'Total Revenue', orderIndex: 0, displayType: 'kpi', availableTypes: ['kpi'], colorTheme: 'orange', isVisible: true },
  { id: 'daily_orders', title: 'Total Orders', orderIndex: 1, displayType: 'kpi', availableTypes: ['kpi'], colorTheme: 'teal', isVisible: true },
  { id: 'daily_group', title: 'Penjualan per Grup Barang', orderIndex: 2, displayType: 'top_list', availableTypes: ['top_list', 'bar_chart', 'pie_chart'], colorTheme: 'blue', isVisible: true },
  { id: 'daily_costcenter', title: 'Perbandingan Costcenter', orderIndex: 3, displayType: 'top_list', availableTypes: ['top_list', 'bar_chart', 'pie_chart'], colorTheme: 'purple', isVisible: true },
  { id: 'daily_chart', title: 'Revenue Analysis', orderIndex: 4, displayType: 'line_chart', availableTypes: ['line_chart', 'bar_chart'], colorTheme: 'green', isVisible: true },
  { id: 'daily_cashier', title: 'Sales By Cashier', orderIndex: 5, displayType: 'pie_chart', availableTypes: ['pie_chart', 'bar_chart', 'top_list'], colorTheme: 'orange', isVisible: true },
  { id: 'daily_recent', title: 'Recent Transactions', orderIndex: 6, displayType: 'list', availableTypes: ['list'], colorTheme: 'blue', isVisible: true },
  { id: 'daily_production', title: 'Production (TT45)', orderIndex: 7, displayType: 'table', availableTypes: ['table'], colorTheme: 'green', isVisible: true },
];

const defaultAnnuallyConfigs = [
  { id: 'annual_revenue', title: 'Annual Revenue', orderIndex: 0, displayType: 'kpi', availableTypes: ['kpi'], colorTheme: 'orange', isVisible: true },
  { id: 'annual_orders', title: 'Total Orders', orderIndex: 1, displayType: 'kpi', availableTypes: ['kpi'], colorTheme: 'teal', isVisible: true },
  { id: 'annual_chart', title: 'Sales Overview', orderIndex: 2, displayType: 'bar_chart', availableTypes: ['bar_chart', 'line_chart'], colorTheme: 'blue', isVisible: true },
  { id: 'annual_cashier', title: 'Sales By Cashier', orderIndex: 3, displayType: 'pie_chart', availableTypes: ['pie_chart', 'bar_chart', 'top_list'], colorTheme: 'purple', isVisible: true },
];

const WidgetConfigContext = createContext();

export const useWidgetConfig = () => useContext(WidgetConfigContext);

const mergeConfigs = (defaults, saved) => {
  if (!Array.isArray(saved) || saved.length === 0) return defaults;

  const savedById = new Map(saved.filter((item) => item?.id).map((item) => [item.id, item]));
  const merged = defaults.map((def) => {
    const existing = savedById.get(def.id);
    if (!existing) return def;
    if (def.id === 'daily_production') {
      return {
        ...existing,
        ...def,
        isVisible: typeof existing.isVisible === 'boolean' ? existing.isVisible : def.isVisible,
        orderIndex: Number.isFinite(existing.orderIndex) ? existing.orderIndex : def.orderIndex,
      };
    }
    return { ...def, ...existing };
  });

  const extraSaved = saved.filter((item) => item?.id && !defaults.some((def) => def.id === item.id));
  return [...merged, ...extraSaved];
};

export const WidgetConfigProvider = ({ children }) => {
  const [dailyConfigs, setDailyConfigs] = useState(() => {
    const saved = localStorage.getItem('daily_widgets_config');
    if (!saved) return defaultDailyConfigs;
    return mergeConfigs(defaultDailyConfigs, JSON.parse(saved));
  });

  const [annuallyConfigs, setAnnuallyConfigs] = useState(() => {
    const saved = localStorage.getItem('annually_widgets_config');
    if (!saved) return defaultAnnuallyConfigs;
    return mergeConfigs(defaultAnnuallyConfigs, JSON.parse(saved));
  });

  useEffect(() => {
    localStorage.setItem('daily_widgets_config', JSON.stringify(dailyConfigs));
  }, [dailyConfigs]);

  useEffect(() => {
    localStorage.setItem('annually_widgets_config', JSON.stringify(annuallyConfigs));
  }, [annuallyConfigs]);

  const updateDailyConfigs = (newConfigs) => setDailyConfigs(newConfigs);
  const updateAnnuallyConfigs = (newConfigs) => setAnnuallyConfigs(newConfigs);

  return (
    <WidgetConfigContext.Provider value={{
      dailyConfigs, updateDailyConfigs,
      annuallyConfigs, updateAnnuallyConfigs,
      defaultDailyConfigs, defaultAnnuallyConfigs
    }}>
      {children}
    </WidgetConfigContext.Provider>
  );
};
