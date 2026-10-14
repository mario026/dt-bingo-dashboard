import { createApp } from 'vue';
import PrimeVue from 'primevue/config';
import Aura from '@primeuix/themes/aura';
import 'primeicons/primeicons.css';
import './style.css';
import App from './App.vue';

document.documentElement.classList.add('dark');
createApp(App).use(PrimeVue, {
  theme: { preset: Aura, options: { darkModeSelector: '.dark', cssLayer: { name: 'primevue', order: 'theme, base, primevue, components, utilities' } } },
}).mount('#app');
