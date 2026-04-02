import React, { useState } from 'react';
import { Box, Typography, Paper, Switch, IconButton, Select, MenuItem, Button, Tabs, Tab } from '@mui/material';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useWidgetConfig } from '../context/WidgetConfigContext';
import { GripVertical, RefreshCcw } from 'lucide-react';

export default function AppearanceSettings() {
  const { dailyConfigs, updateDailyConfigs, annuallyConfigs, updateAnnuallyConfigs, defaultDailyConfigs, defaultAnnuallyConfigs } = useWidgetConfig();
  const [tabIndex, setTabIndex] = useState(0);

  const configs = tabIndex === 0 ? dailyConfigs : annuallyConfigs;
  const updateConfigs = tabIndex === 0 ? updateDailyConfigs : updateAnnuallyConfigs;
  const defaults = tabIndex === 0 ? defaultDailyConfigs : defaultAnnuallyConfigs;

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    const items = Array.from(configs);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    const newItems = items.map((item, index) => ({ ...item, orderIndex: index }));
    updateConfigs(newItems);
  };

  const handleChange = (id, field, value) => {
    const newConfigs = configs.map(c => c.id === id ? { ...c, [field]: value } : c);
    updateConfigs(newConfigs);
  };

  const handleReset = () => {
    updateConfigs(defaults);
  };

  return (
    <Box>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
           <Typography variant="h5" sx={{ fontWeight: 'bold' }}>Pengaturan Tampilan</Typography>
           <Typography variant="body2" color="textSecondary">Atur widget yang ingin ditampilkan</Typography>
        </Box>
        <Button variant="outlined" color="error" startIcon={<RefreshCcw size={16}/>} onClick={handleReset}>
          Reset
        </Button>
      </Box>

      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabIndex} onChange={(e, v) => setTabIndex(v)} textColor="primary" indicatorColor="primary" variant="fullWidth">
          <Tab label="Dashboard Harian" />
          <Tab label="Dashboard Tahunan" />
        </Tabs>
      </Paper>

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="widget-list">
          {(provided) => (
            <Box {...provided.droppableProps} ref={provided.innerRef}>
              {configs.map((item, index) => (
                <Draggable key={item.id} draggableId={item.id} index={index}>
                  {(provided, snapshot) => (
                    <Paper
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      elevation={snapshot.isDragging ? 4 : 1}
                      sx={{
                        p: 2, mb: 2, borderRadius: 3, display: 'flex', alignItems: 'center',
                        backgroundColor: snapshot.isDragging ? '#fafafa' : 'white',
                        borderLeft: item.isVisible ? `4px solid ${getThemeColor(item.colorTheme)}` : '4px solid #ccc'
                      }}
                    >
                      <Box {...provided.dragHandleProps} sx={{ mr: 2, cursor: 'grab', color: 'text.disabled' }}>
                        <GripVertical />
                      </Box>
                      
                      <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 'bold', textDecoration: !item.isVisible ? 'line-through' : 'none', color: !item.isVisible ? 'text.secondary' : 'text.primary' }}>
                          {item.title}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">{item.displayType.replace('_', ' ').toUpperCase()}</Typography>
                      </Box>

                      {item.availableTypes.length > 1 && (
                         <Select
                           size="small"
                           value={item.displayType}
                           onChange={(e) => handleChange(item.id, 'displayType', e.target.value)}
                           sx={{ mr: 2, width: 120 }}
                         >
                           {item.availableTypes.map(t => (
                             <MenuItem key={t} value={t}>{t.replace('_', ' ').toUpperCase()}</MenuItem>
                           ))}
                         </Select>
                      )}

                      <Select
                        size="small"
                        value={item.colorTheme}
                        onChange={(e) => handleChange(item.id, 'colorTheme', e.target.value)}
                        sx={{ mr: 2, width: 100 }}
                      >
                         {['orange', 'teal', 'blue', 'purple', 'green', 'red'].map(c => (
                           <MenuItem key={c} value={c}>{c}</MenuItem>
                         ))}
                      </Select>

                      <Switch 
                        checked={item.isVisible} 
                        onChange={(e) => handleChange(item.id, 'isVisible', e.target.checked)}
                        color="success"
                      />
                    </Paper>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </Box>
          )}
        </Droppable>
      </DragDropContext>
    </Box>
  );
}

const getThemeColor = (theme) => {
  switch (theme) {
    case 'orange': return '#FF5C35';
    case 'teal': return '#00897B';
    case 'blue': return '#1E88E5';
    case 'purple': return '#5E35B1';
    case 'green': return '#43A047';
    case 'red': return '#E53935';
    default: return '#78909C';
  }
};
