import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';
import type { ViteDevServer } from 'vite';

// Plugin to integrate Express API with Vite dev server (development only)
function apiPlugin() {
  return {
    name: 'api-server',
    apply: 'serve', // Only use in development
    configureServer(server: ViteDevServer) {
      // Synchronously add middleware BEFORE Vite's built-in middleware
      // We'll set up the handler and initialize the Express app async
      let expressApp: any = null;
      let appReady = false;

      // Load the Express app
      import('./server/index').then(({ createServer }) => {
        expressApp = createServer();
        appReady = true;
        console.log('API server middleware ready at /api');
      }).catch((err) => {
        console.error('Failed to load API server:', err);
      });

      // Add middleware synchronously - it will wait for app to be ready
      server.middlewares.use((req, res, next) => {
        if (req.url?.startsWith('/api')) {
          if (!appReady) {
            // Wait for app to be ready
            const checkReady = setInterval(() => {
              if (appReady && expressApp) {
                clearInterval(checkReady);
                expressApp(req, res, next);
              }
            }, 10);
            // Timeout after 5 seconds
            setTimeout(() => {
              clearInterval(checkReady);
              if (!appReady) {
                res.statusCode = 503;
                res.end('API server not ready');
              }
            }, 5000);
          } else {
            expressApp(req, res, next);
          }
        } else {
          next();
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Load environment variables based on mode
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react(), apiPlugin()],
    // Environment variable prefix for frontend
    envPrefix: 'VITE_',
    // Define environment variables available to the frontend
    define: {
      'import.meta.env.VITE_API_URL': JSON.stringify(
        env.VITE_API_URL || 'http://localhost:3001'
      ),
    },
    resolve: {
      extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
      alias: {
        'vaul@1.1.2': 'vaul',
        'sonner@2.0.3': 'sonner',
        'recharts@2.15.2': 'recharts',
        'react-resizable-panels@2.1.7': 'react-resizable-panels',
        'react-hook-form@7.55.0': 'react-hook-form',
        'react-day-picker@8.10.1': 'react-day-picker',
        'next-themes@0.4.6': 'next-themes',
        'lucide-react@0.487.0': 'lucide-react',
        'input-otp@1.4.2': 'input-otp',
        'embla-carousel-react@8.6.0': 'embla-carousel-react',
        'cmdk@1.1.1': 'cmdk',
        'class-variance-authority@0.7.1': 'class-variance-authority',
        '@radix-ui/react-tooltip@1.1.8': '@radix-ui/react-tooltip',
        '@radix-ui/react-toggle@1.1.2': '@radix-ui/react-toggle',
        '@radix-ui/react-toggle-group@1.1.2': '@radix-ui/react-toggle-group',
        '@radix-ui/react-tabs@1.1.3': '@radix-ui/react-tabs',
        '@radix-ui/react-switch@1.1.3': '@radix-ui/react-switch',
        '@radix-ui/react-slot@1.1.2': '@radix-ui/react-slot',
        '@radix-ui/react-slider@1.2.3': '@radix-ui/react-slider',
        '@radix-ui/react-separator@1.1.2': '@radix-ui/react-separator',
        '@radix-ui/react-select@2.1.6': '@radix-ui/react-select',
        '@radix-ui/react-scroll-area@1.2.3': '@radix-ui/react-scroll-area',
        '@radix-ui/react-radio-group@1.2.3': '@radix-ui/react-radio-group',
        '@radix-ui/react-progress@1.1.2': '@radix-ui/react-progress',
        '@radix-ui/react-popover@1.1.6': '@radix-ui/react-popover',
        '@radix-ui/react-navigation-menu@1.2.5': '@radix-ui/react-navigation-menu',
        '@radix-ui/react-menubar@1.1.6': '@radix-ui/react-menubar',
        '@radix-ui/react-label@2.1.2': '@radix-ui/react-label',
        '@radix-ui/react-hover-card@1.1.6': '@radix-ui/react-hover-card',
        '@radix-ui/react-dropdown-menu@2.1.6': '@radix-ui/react-dropdown-menu',
        '@radix-ui/react-dialog@1.1.6': '@radix-ui/react-dialog',
        '@radix-ui/react-context-menu@2.2.6': '@radix-ui/react-context-menu',
        '@radix-ui/react-collapsible@1.1.3': '@radix-ui/react-collapsible',
        '@radix-ui/react-checkbox@1.1.4': '@radix-ui/react-checkbox',
        '@radix-ui/react-avatar@1.1.3': '@radix-ui/react-avatar',
        '@radix-ui/react-aspect-ratio@1.1.2': '@radix-ui/react-aspect-ratio',
        '@radix-ui/react-alert-dialog@1.1.6': '@radix-ui/react-alert-dialog',
        '@radix-ui/react-accordion@1.2.3': '@radix-ui/react-accordion',
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      target: 'esnext',
      outDir: 'dist',
      // Generate sourcemaps for production debugging
      sourcemap: mode === 'production' ? false : true,
      // Minify in production
      minify: mode === 'production' ? 'esbuild' : false,
      // Chunk splitting for better caching
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom'],
            'ui-vendor': ['framer-motion', 'lucide-react'],
            'radix-vendor': [
              '@radix-ui/react-dialog',
              '@radix-ui/react-dropdown-menu',
              '@radix-ui/react-select',
              '@radix-ui/react-tabs',
            ],
          },
        },
      },
    },
    server: {
      port: 3000,
      open: true,
      // Proxy API requests to backend in development (if not using apiPlugin)
      // Uncomment if you want to run frontend and backend separately
      // proxy: {
      //   '/api': {
      //     target: env.VITE_API_URL || 'http://localhost:3001',
      //     changeOrigin: true,
      //   },
      // },
    },
  };
});