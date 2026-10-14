<script setup lang="ts">
import { ref, watch } from 'vue';
import manifest from '../wiki-images.json';
const props = defineProps<{ title: string; size?: number }>();
const failed = ref(false);
const base = import.meta.env.BASE_URL;
watch(() => props.title, () => failed.value = false);
const assets = manifest as Record<string, { path: string; source: string }>;
</script>
<template>
  <span class="wiki-image" :style="{ width: `${size ?? 36}px`, height: `${size ?? 36}px` }">
    <img v-if="assets[title] && !failed" :src="`${base}${assets[title].path.replace(/^\//, '')}`" :alt="title" loading="lazy" @error="failed = true">
    <i v-else class="pi pi-box" role="img" :aria-label="`${title} — image unavailable`"></i>
  </span>
</template>
