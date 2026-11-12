import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'jump-ant',
  permissions: [],
  webBundleDir: 'dist',
  navigationBar: {
    theme: 'dark',
    transparentBackground: true,
    withTitle: false,
  },
});
