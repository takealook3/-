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
      <div className="card" style={{ textAlign: 'center', padding: '40px 20px', borderStyle: 'dashed', borderColor: 'var(--border-color)' }}>
        <div style={{ fontSize: '2rem', marginBottom: '12px' }}>💡</div>
        <div style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--text-main)', fontFamily: 'Outfit, sans-serif' }}>아직 변환 결과가 없습니다.</div>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>위에서 사진 등록 후 [✨ 이미지 변환 실행] 버튼을 눌러주세요!</div>
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
      
      {/* Streamlit 동기화: 성공 알림 띠 */}
      <div className="success-banner" style={{ marginBottom: '16px' }}>
        <span>🎉</span>
        <span><strong>맞춤형 인테리어 이미지 변환 완료!</strong> 아래에서 시공 전후 모습을 비교해 보세요.</span>
      </div>

      {/* 불필요한 메트릭(결과 ID, 스타일, 상태) 및 지저분한 파일 경로 정보를 완전히 제거하여 심플하고 정돈된 프리미엄 스타일로 구성합니다. */}

      {/* 좌우 나란히 비교 (Before & After) */}
      <div className="grid-2">
        {/* 좌측 Before */}
        <div>
          <div style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--text-main)', marginBottom: '10px', fontFamily: 'Outfit, sans-serif' }}>
            📷 Before (원본 공간)
          </div>
          <div className="preview-box" style={{ height: '340px', border: '1px solid var(--border-color)' }}>
            {fullOrig ? (
              <img src={fullOrig} alt="Before 원본" className="preview-img" />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>원본 이미지 없음</div>
            )}
          </div>
        </div>

        {/* 우측 After */}
        <div>
          <div style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--primary)', marginBottom: '10px', fontFamily: 'Outfit, sans-serif', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>🏠 After (AI 리모델링 변환 완료)</span>
            <span style={{ fontSize: '0.8rem', fontWeight: '500', color: 'var(--text-muted)', background: 'var(--bg-card-inner)', padding: '4px 10px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              ⏱️ {resultData.processingTime}초 소요
            </span>
          </div>
          <div className="preview-box" style={{ height: '340px', border: '2px solid var(--primary)' }}>
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
