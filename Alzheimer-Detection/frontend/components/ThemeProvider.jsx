import { useEffect } from 'react';

export default function ThemeProvider({ children }) {
  useEffect(() => {
    // Load theme preferences on mount
    const loadTheme = () => {
      const savedTheme = localStorage.getItem('theme') || 'dark';
      const savedColor = localStorage.getItem('accentColor') || '#3b82f6';

      const root = document.documentElement;
      const body = document.body;

      // Color mappings
      const colorMap = {
        '#3b82f6': { rgb: '59, 130, 246' },
        '#8b5cf6': { rgb: '139, 92, 246' },
        '#10b981': { rgb: '16, 185, 129' },
        '#ec4899': { rgb: '236, 72, 153' },
        '#f97316': { rgb: '249, 115, 22' },
        '#14b8a6': { rgb: '20, 184, 166' },
      };

      // Apply theme
      if (savedTheme === 'dark') {
        body.style.background = 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)';
        body.style.color = '#f1f5f9';
        body.style.minHeight = '100vh';
        body.setAttribute('data-theme', 'dark');

        root.style.setProperty('--bg-primary', '#0f172a');
        root.style.setProperty('--bg-secondary', '#1e293b');
        root.style.setProperty('--bg-card', 'rgba(30, 41, 59, 0.8)');
        root.style.setProperty('--bg-sidebar', 'linear-gradient(135deg, rgba(15, 23, 42, 0.98) 0%, rgba(30, 41, 59, 0.95) 100%)');
        root.style.setProperty('--text-primary', '#f1f5f9');
        root.style.setProperty('--text-secondary', '#cbd5e1');
        root.style.setProperty('--border-color', 'rgba(59, 130, 246, 0.2)');
      } else {
        body.style.background = 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)';
        body.style.color = '#0f172a';
        body.style.minHeight = '100vh';
        body.setAttribute('data-theme', 'light');

        root.style.setProperty('--bg-primary', '#ffffff');
        root.style.setProperty('--bg-secondary', '#f8fafc');
        root.style.setProperty('--bg-card', 'rgba(255, 255, 255, 0.8)');
        root.style.setProperty('--bg-sidebar', 'linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 250, 252, 0.95) 100%)');
        root.style.setProperty('--text-primary', '#0f172a');
        root.style.setProperty('--text-secondary', '#475569');
        root.style.setProperty('--border-color', 'rgba(203, 213, 225, 0.5)');
      }

      // Apply secondary/sidebar color
      const colorData = colorMap[savedColor];
      if (colorData) {
        root.style.setProperty('--role-color', savedColor);
        root.style.setProperty('--role-color-rgb', colorData.rgb);
        root.style.setProperty('--sidebar-accent', savedColor);
        root.style.setProperty('--sidebar-hover', `${savedColor}20`);
        root.style.setProperty('--sidebar-active', `${savedColor}30`);
      }
    };

    loadTheme();

    // Listen for storage changes (when theme changes in another tab)
    window.addEventListener('storage', loadTheme);

    return () => {
      window.removeEventListener('storage', loadTheme);
    };
  }, []);

  return <>{children}</>;
}
