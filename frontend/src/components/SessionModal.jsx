// =====================================================================
// [SessionModal.jsx: 순수 Vanilla CSS 기반 세션 장부 모달]
// =====================================================================
import React, { useEffect, useState } from 'react';
import { getSessionHistory } from '../services/api';

export default function SessionModal({ sessionId, onClose }) {
  const [loading, setLoading] = useState(true);
  const [historyData, setHistoryData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!sessionId) return;
    let isMounted = true;

    async function fetchHistory() {
      setLoading(true);
      setError(null);
      const res = await getSessionHistory(sessionId);
      if (!isMounted) return;

      setLoading(false);
      if (res.success) {
        setHistoryData(res.data);
      } else {
        setError({
          errorCode: res.errorCode || "SESSION_FETCH_FAILED",
          message: res.message || "세션 기록을 서버에서 가져오지 못했습니다."
        });
      }
    }
    fetchHistory();
    return () => { isMounted = false; };
  }, [sessionId]);

  if (!sessionId) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(42, 40, 37, 0.4)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px'
    }}>
      <div className="card" style={{ width: '100%', maxWidth: '700px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden', border: '1px solid var(--border-color)' }}>
        
        {/* 모달 헤더 */}
        <div style={{ padding: '20px', backgroundColor: 'var(--primary)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '1.2rem', fontWeight: '700', color: '#FCFAF7', fontFamily: 'Playfair Display, serif' }}>📋 세션 활동 장부 내역 ({sessionId})</div>
          <button onClick={onClose} className="btn btn-secondary" style={{ padding: '6px 12px', color: 'var(--text-main)' }}>✕</button>
        </div>

        {/* 모달 본문 */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1, backgroundColor: 'var(--bg-card)' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>⏳ 서버 장부에서 기록을 불러오는 중...</div>
          ) : error ? (
            <div style={{ padding: '20px', backgroundColor: 'rgba(176, 91, 72, 0.08)', border: '1px solid var(--border-color)', borderRadius: '10px', color: 'var(--accent)' }}>
              <div style={{ fontWeight: '700', marginBottom: '6px' }}>🚨 세션 조회 실패 [{error.errorCode}]</div>
              <div>{error.message}</div>
            </div>
          ) : !historyData ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>기록이 없습니다.</div>
          ) : (
            <div>
              {/* 요약 카운트 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '24px' }}>
                <div className="metric-card" style={{ textAlign: 'center' }}>
                  <div className="metric-label">인테리어 변환</div>
                  <div className="metric-value" style={{ color: 'var(--primary)' }}>{historyData.generations?.length || 0}건</div>
                </div>
                <div className="metric-card" style={{ textAlign: 'center' }}>
                  <div className="metric-label">이미지 편집</div>
                  <div className="metric-value" style={{ color: 'var(--accent)' }}>{historyData.edits?.length || 0}건</div>
                </div>
                <div className="metric-card" style={{ textAlign: 'center' }}>
                  <div className="metric-label">챗봇 대화</div>
                  <div className="metric-value" style={{ color: '#89705E' }}>{historyData.chats?.length || 0}건</div>
                </div>
              </div>

              {/* 변환 목록 */}
              <div style={{ fontWeight: '700', fontSize: '1rem', color: 'var(--text-main)', marginBottom: '12px', fontFamily: 'Outfit, sans-serif' }}>🎨 인테리어 변환 이력 (generations)</div>
              {(!historyData.generations || historyData.generations.length === 0) ? (
                <div style={{ padding: '20px', background: 'var(--bg-card-inner)', borderRadius: '10px', textAlign: 'center', color: 'var(--text-muted)', border: '1px solid var(--border-color)' }}>변환 이력이 없습니다.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {historyData.generations.map((gen, idx) => (
                    <div key={idx} style={{ background: 'var(--bg-card-inner)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontWeight: '700', color: 'var(--accent)', textTransform: 'uppercase' }}>스타일: {gen.style}</span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{gen.created_at}</span>
                      </div>
                      <div style={{ fontSize: '0.9rem', color: 'var(--text-main)', marginBottom: '6px' }}>프롬프트: "{gen.prompt}"</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--primary)', fontFamily: 'monospace' }}>결과 ID: {gen.result_id || gen.task_id}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 모달 푸터 */}
        <div style={{ padding: '16px 20px', backgroundColor: 'var(--bg-card-inner)', borderTop: '1px solid var(--border-color)', textAlign: 'right' }}>
          <button onClick={onClose} className="btn btn-primary" style={{ padding: '8px 20px' }}>확인 닫기</button>
        </div>

      </div>
    </div>
  );
}
