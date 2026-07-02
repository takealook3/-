import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// =====================================================================
// [Vite 설정서]
// 비유: 식당 키오스크 기계를 켤 때 몇 번 포트(5173)에서 동작할지 정해주는 설정서입니다.
// =====================================================================
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true
  }
});
