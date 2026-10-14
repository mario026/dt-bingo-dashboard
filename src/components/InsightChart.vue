<script setup lang="ts">
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { BarChart, ScatterChart, HeatmapChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent, VisualMapComponent, AriaComponent } from 'echarts/components';
import VChart from 'vue-echarts';
import type { EChartsOption } from 'echarts';
use([CanvasRenderer, BarChart, ScatterChart, HeatmapChart, GridComponent, TooltipComponent, LegendComponent, VisualMapComponent, AriaComponent]);
defineProps<{ option: EChartsOption; label: string; height?: number }>();
</script>
<template><VChart :option="{ backgroundColor: 'transparent', textStyle: { color: '#a7b7af', fontFamily: 'inherit' }, aria: { enabled: true }, ...option }" autoresize :style="{ height: `${height ?? 300}px` }" role="img" :aria-label="label" /></template>
