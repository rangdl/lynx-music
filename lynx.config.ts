import { pluginLynxConfig } from '@lynx-js/config-rsbuild-plugin';
import { pluginQRCode } from '@lynx-js/qrcode-rsbuild-plugin';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
import { defineConfig } from '@lynx-js/rspeedy';
import { pluginTypeCheck } from '@rsbuild/plugin-type-check';

export default defineConfig({
  environments: {
    web: {},
    lynx: {},
  },
  server: {
    port: 3090,
    host: '0.0.0.0',
  },
  plugins: [
    // 开启 CSS Rule 编码：@media (prefers-color-scheme: dark) 等规则需要 SDK 4.0+
    pluginLynxConfig({ enableCSSRule: true }),
    pluginQRCode({
      schema(url) {
        // We use `?fullscreen=true` to open the page in LynxExplorer in full screen mode
        return `${url}?fullscreen=true`;
      },
    }),
    pluginReactLynx({ enableNewGesture: true }),
    pluginTypeCheck(),
  ],
});
