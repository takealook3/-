// =====================================================================
// [Sidebar.jsx: Streamlit 사이드바 완벽 구현]
// 비유: 식당 입구 카운터 옆에 놓인 전광판과 서랍으로,
// 서버와의 통신 상태를 실시간 확인하고 오늘 작업 기록을 언제든 열어볼 수 있습니다.
// =====================================================================
import React from 'react';
import { API_BASE_URL } from '../services/api';

export default function Sidebar({ serverStatus, onRefreshHealth, sessionId, onOpenSessionModal }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-title">
        <span style={{ fontSize: '1.4rem' }}>🏠</span>
        <span>ZipPT Interior MVP</span>
      </div>

      {/* 1. 시스템 연결 상태 */}
      <div className="sidebar-section">
        <div style={{ fontWeight: '600', fontSize: '0.95rem', color: '#e2e8f0' }}>🔌 시스템 연결 상태</div>
        <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>백엔드 API 서버 주소:</div>
        <div className="code-box">{API_BASE_URL}</div>
      </div>

      <hr style={{ borderColor: '#1f2937' }} />

      {/* 2. 백엔드 연결 확인 (GET /health) */}
      <div className="sidebar-section">
        <div style={{ fontWeight: '600', fontSize: '0.95rem', color: '#e2e8f0' }}>🏥 백엔드 연결 확인 (GET /health)</div>
        
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {serverStatus.loading ? (
            <div className="badge" style={{ backgroundColor: '#1f2937', color: '#94a3b8' }}>⏳ 서버 확인 중...</div>
          ) : serverStatus.online ? (
            <div className="badge badge-online">🟢 서버 연결됨</div>
          ) : (
            <div className="badge badge-offline">🔴 서버 연결 실패</div>
          )}

          <button
            onClick={onRefreshHealth}
            className="btn btn-secondary"
            style={{ padding: '6px 10px', fontSize: '0.8rem' }}
            title="새로고침"
          >
            🔄
          </button>
        </div>

        {!serverStatus.online && serverStatus.error && (
          <div style={{ fontSize: '0.75rem', color: '#f87171', background: '#450a0a', padding: '8px', borderRadius: '6px' }}>
            원인: {serverStatus.error}
          </div>
        )}
      </div>

      <hr style={{ borderColor: '#1f2937' }} />

      {/* 3. 내 세션 작업 기록 조회 */}
      <div className="sidebar-section">
        <div style={{ fontWeight: '600', fontSize: '0.95rem', color: '#e2e8f0' }}>📋 세션 작업 관리</div>
        {sessionId ? (
          <div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '8px' }}>현재 세션: <code>{sessionId}</code></div>
            <button onClick={onOpenSessionModal} className="btn btn-primary btn-full" style={{ fontSize: '0.85rem' }}>
              📋 내 세션 작업 기록 조회
            </button>
          </div>
        ) : (
          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>사진 업로드 시 세션이 시작됩니다.</div>
        )}
      </div>
    </aside>
  );
}
