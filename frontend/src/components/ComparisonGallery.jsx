// =====================================================================
// [ComparisonGallery.jsx: Streamlit 100% 동기화 Before/After 쇼룸]
// =====================================================================
import React from 'react';
import { API_BASE_URL } from '../services/api';

export default function ComparisonGallery({ 
  originalImageUrl, 
  resultData, 
  onError 
}) {
  if (!resultData || !resultData.resultImageUrl) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '40px 20px', borderStyle: 'dashed' }}>
        <div style={{ fontSize: '2rem', marginBottom: '12px' }}>💡</div>
        <div style={{ fontSize: '1rem', fontWeight: '600', color: '#cbd5e1' }}>아직 변환 결과가 없습니다.</div>
        <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '4px' }}>위에서 사진 등록 후 [✨ 이미지 변환 실행] 버튼을 눌러주세요!</div>
      </div>
    );
  }

  const getFullUrl = (url) => {
    if (!url) return "";
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    return `${API_BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
  };

  const fullOrig = getFullUrl(originalImageUrl);
  const fullRes = getFullUrl(resultData.resultImageUrl);

  const handleImageError = () => {
    onError({
      errorCode: "RESULT_NOT_FOUND",
      message: "서버에서 변환된 결과 이미지 파일을 찾을 수 없습니다."
    });
  };

  return (
    <div className="card">
      <div className="card-title">✨ 5. 인테리어 이미지 변환 결과 (Before / After)</div>
      
      {/* Streamlit 동기화: 초록색 성공 알림 띠 */}
      <div className="success-banner" style={{ marginBottom: '16px' }}>
        <span>🎉</span>
        <span><strong>맞춤형 인테리어 이미지 변환 완료!</strong> 아래에서 시공 전후 모습을 비교해 보세요.</span>
      </div>

      {/* 4대 메트릭 성적표 4단 그리드 */}
      <div className="grid-4" style={{ marginBottom: '12px' }}>
        <div className="metric-card">
          <div className="metric-label">결과 ID</div>
          <div className="metric-value" style={{ color: '#818cf8', fontSize: '0.95rem' }}>{resultData.resultId}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">스타일</div>
          <div className="metric-value" style={{ color: '#f472b6', textTransform: 'uppercase' }}>{resultData.style}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">상태</div>
          <div className="metric-value" style={{ color: '#34d399' }}>{resultData.status}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">소요 시간</div>
          <div className="metric-value" style={{ color: '#facc15' }}>{resultData.processingTime}초</div>
        </div>
      </div>

      {/* Streamlit 동기화: 하단 프롬프트 및 결과 파일 서버 경로 표시 */}
      <div style={{ fontSize: '0.85rem', color: '#94a3b8', background: '#0f172a', padding: '10px 14px', borderRadius: '8px', border: '1px solid #334155', marginBottom: '24px', fontFamily: 'monospace' }}>
        프롬프트: <strong>'{resultData.prompt}'</strong> | 결과 경로: <code>{resultData.resultImageUrl}</code>
      </div>

      {/* 좌우 나란히 비교 (Before & After) */}
      <div className="grid-2">
        {/* 좌측 Before */}
        <div>
          <div style={{ fontSize: '1rem', fontWeight: '700', color: '#cbd5e1', marginBottom: '10px' }}>
            📷 Before (원본 공간)
          </div>
          <div className="preview-box" style={{ height: '340px', border: '1px solid #334155' }}>
            {fullOrig ? (
              <img src={fullOrig} alt="Before 원본" className="preview-img" />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b' }}>원본 이미지 없음</div>
            )}
          </div>
        </div>

        {/* 우측 After */}
        <div>
          <div style={{ fontSize: '1rem', fontWeight: '700', color: '#818cf8', marginBottom: '10px' }}>
            🏠 After ({resultData.style?.toUpperCase()} 스타일 리모델링)
          </div>
          <div className="preview-box" style={{ height: '340px', border: '2px solid #6366f1' }}>
            <img 
              src={fullRes} 
              alt="After 변환 완료" 
              onError={handleImageError}
              className="preview-img" 
            />
          </div>
        </div>
      </div>
    </div>
  );
}
