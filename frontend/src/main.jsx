// =====================================================================
// main.jsx: React 시동을 거는 핵심 메인 파일
// 비유: 자동차의 키를 꽂아 엔진을 돌리고, App 컴포넌트를 화면(root)에 올려놓습니다.
// =====================================================================
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
