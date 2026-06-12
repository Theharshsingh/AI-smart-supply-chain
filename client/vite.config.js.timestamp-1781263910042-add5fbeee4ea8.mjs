// vite.config.js
import { defineConfig, loadEnv } from "file:///c:/Users/goura/Desktop/top10/AI-smart-supply-chain/client/node_modules/vite/dist/node/index.js";
import react from "file:///c:/Users/goura/Desktop/top10/AI-smart-supply-chain/client/node_modules/@vitejs/plugin-react/dist/index.js";
import tailwindcss from "file:///c:/Users/goura/Desktop/top10/AI-smart-supply-chain/client/node_modules/@tailwindcss/vite/dist/index.mjs";
var vite_config_default = defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiUrl = env.VITE_API_URL || "http://localhost:4000";
  return {
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        "/api": apiUrl,
        "/socket.io": { target: apiUrl, ws: true }
      }
    }
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJjOlxcXFxVc2Vyc1xcXFxnb3VyYVxcXFxEZXNrdG9wXFxcXHRvcDEwXFxcXEFJLXNtYXJ0LXN1cHBseS1jaGFpblxcXFxjbGllbnRcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcImM6XFxcXFVzZXJzXFxcXGdvdXJhXFxcXERlc2t0b3BcXFxcdG9wMTBcXFxcQUktc21hcnQtc3VwcGx5LWNoYWluXFxcXGNsaWVudFxcXFx2aXRlLmNvbmZpZy5qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vYzovVXNlcnMvZ291cmEvRGVza3RvcC90b3AxMC9BSS1zbWFydC1zdXBwbHktY2hhaW4vY2xpZW50L3ZpdGUuY29uZmlnLmpzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnLCBsb2FkRW52IH0gZnJvbSAndml0ZSdcclxuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0J1xyXG5pbXBvcnQgdGFpbHdpbmRjc3MgZnJvbSAnQHRhaWx3aW5kY3NzL3ZpdGUnXHJcblxyXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoKHsgbW9kZSB9KSA9PiB7XHJcbiAgY29uc3QgZW52ID0gbG9hZEVudihtb2RlLCBwcm9jZXNzLmN3ZCgpLCAnJylcclxuICBjb25zdCBhcGlVcmwgPSBlbnYuVklURV9BUElfVVJMIHx8ICdodHRwOi8vbG9jYWxob3N0OjQwMDAnXHJcblxyXG4gIHJldHVybiB7XHJcbiAgICBwbHVnaW5zOiBbcmVhY3QoKSwgdGFpbHdpbmRjc3MoKV0sXHJcbiAgICBzZXJ2ZXI6IHtcclxuICAgICAgcHJveHk6IHtcclxuICAgICAgICAnL2FwaSc6IGFwaVVybCxcclxuICAgICAgICAnL3NvY2tldC5pbyc6IHsgdGFyZ2V0OiBhcGlVcmwsIHdzOiB0cnVlIH0sXHJcbiAgICAgIH0sXHJcbiAgICB9LFxyXG4gIH1cclxufSlcclxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUEyVyxTQUFTLGNBQWMsZUFBZTtBQUNqWixPQUFPLFdBQVc7QUFDbEIsT0FBTyxpQkFBaUI7QUFFeEIsSUFBTyxzQkFBUSxhQUFhLENBQUMsRUFBRSxLQUFLLE1BQU07QUFDeEMsUUFBTSxNQUFNLFFBQVEsTUFBTSxRQUFRLElBQUksR0FBRyxFQUFFO0FBQzNDLFFBQU0sU0FBUyxJQUFJLGdCQUFnQjtBQUVuQyxTQUFPO0FBQUEsSUFDTCxTQUFTLENBQUMsTUFBTSxHQUFHLFlBQVksQ0FBQztBQUFBLElBQ2hDLFFBQVE7QUFBQSxNQUNOLE9BQU87QUFBQSxRQUNMLFFBQVE7QUFBQSxRQUNSLGNBQWMsRUFBRSxRQUFRLFFBQVEsSUFBSSxLQUFLO0FBQUEsTUFDM0M7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
