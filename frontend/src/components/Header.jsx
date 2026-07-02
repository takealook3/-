// =====================================================================
// [Header.jsx: 상단 안내 데스크 및 상태 전광판]
// 비유: 식당 입구에 걸린 간판이자, 주방과 연결이 잘 되어 있는지 보여주는 알람등입니다.
// =====================================================================
import React from 'react';
import { Home, Activity, RefreshCw, FileText, CheckCircle2, AlertTriangle } from 'lucide-react';

export default function Header({ serverStatus, onRefreshHealth, sessionId, onOpenSessionModal }) {
  return (
    <header className="border-b border-white/10 bg-slate-900/60 backdrop-blur-xl sticky top-0 z-40 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        
        {/* 좌측 타이틀 영역 */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Home className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-200 bg-clip-text text-transparent" style={{ fontFamily: 'Outfit, sans-serif' }}>
              ZipPT Interior Studio <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 ml-2 align-middle">React MVP</span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">AI 맞춤형 실내 리모델링 & 홈 스타일링 플랫폼</p>
          </div>
        </div>

        {/* 우측 서버 상태 및 세션 버튼 영역 */}
        <div className="flex items-center gap-3 flex-wrap justify-end">
          
          {/* 서버 상태 확인 뱃지 (GET /health) */}
          <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-medium backdrop-blur-md ${
            serverStatus.loading 
              ? "bg-slate-800/80 border-slate-700 text-slate-300"
              : serverStatus.online 
                ? "bg-emerald-950/60 border-emerald-500/30 text-emerald-300 shadow-sm shadow-emerald-500/10" 
                : "bg-red-950/60 border-red-500/30 text-red-300 shadow-sm shadow-red-500/10"
          }`}>
            <Activity className="w-3.5 h-3.5 animate-pulse" />
            <span>
              {serverStatus.loading ? "서버 확인 중..." : (serverStatus.online ? "서버 정상 연결됨" : "서버 연결 끊김")}
            </span>
            <button 
              onClick={onRefreshHealth} 
              title="서버 상태 새로고침 (GET /health)"
              className="ml-1 text-slate-400 hover:text-white transition-colors p-0.5 rounded"
            >
              <RefreshCw className={`w-3 h-3 ${serverStatus.loading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {/* 세션 장부 조회 버튼 */}
          {sessionId && (
            <button
              onClick={onOpenSessionModal}
              className="btn-secondary text-xs py-1.5 px-3 bg-indigo-950/40 border-indigo-500/30 hover:border-indigo-500/60 text-indigo-200"
            >
              <FileText className="w-3.5 h-3.5 text-indigo-400" />
              <span>작업 기록 조회</span>
              <span className="font-mono text-[10px] bg-indigo-500/30 px-1.5 py-0.5 rounded text-indigo-100">
                {sessionId.slice(0, 10)}...
              </span>
            </button>
          )}

        </div>
      </div>
    </header>
  );
}
