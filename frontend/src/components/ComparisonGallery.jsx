// =====================================================================
// [ComparisonGallery.jsx: Streamlit 100% 동기화 Before/After 쇼룸 + 요약 제안소]
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

  // RAG 추천 항목 리스트를 2문장 이내 요약으로 가꾸는 헬퍼 함수
  const summarizeList = (linesArray) => {
    if (!linesArray || linesArray.length === 0) return [];
    return linesArray.map(line => {
      const firstSentence = line.split('.')[0];
      const clean = firstSentence.trim();
      return clean ? `${clean}.` : "";
    }).filter(Boolean).slice(0, 3); // 최대 3개 항목까지 렌더링하도록 확장
  };

  return (
    <div className="card" style={{ border: '1px solid var(--border-color)', fontFamily: 'Outfit, sans-serif' }}>
      <div className="card-title" style={{ fontSize: '1.25rem', fontWeight: '800', fontFamily: 'Outfit, sans-serif', color: 'var(--primary)', marginBottom: '16px' }}>
        ✨ 인테리어 이미지 변환 결과 (Before / After)
      </div>
      
      {/* 성공 알림 띠 */}
      <div className="success-banner" style={{ marginBottom: '20px', borderRadius: '8px' }}>
        <span>🎉</span>
        <span><strong>맞춤형 인테리어 이미지 변환 완료!</strong> 아래에서 시공 전후 모습을 비교해 보세요.</span>
      </div>

      {/* 좌우 나란히 비교 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '28px', alignItems: 'start', marginBottom: '28px' }}>
        {/* 좌측 Before */}
        <div>
          <div style={{ height: '32px', display: 'flex', alignItems: 'center', fontSize: '0.9rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '10px', fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif' }}>
            📸 Before (원본 공간)
          </div>
          <div className="preview-box" style={{ height: '340px', border: 'none', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.05)' }}>
            {fullOrig ? (
              <img src={fullOrig} alt="Before 원본" className="preview-img" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>원본 이미지 없음</div>
            )}
          </div>
        </div>

        {/* 우측 After */}
        <div>
          <div style={{ height: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem', fontWeight: '800', color: 'var(--primary)', marginBottom: '10px', fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif' }}>
            <span>🏠 After (AI 리모델링 변환 완료)</span>
            <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', background: 'var(--bg-card-inner)', padding: '4px 10px', borderRadius: '12px', border: '1px solid var(--border-color)', fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif' }}>
              ⏱️ {resultData.processingTime}초 소요
            </span>
          </div>
          <div className="preview-box" style={{ height: '340px', border: 'none', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.05)' }}>
            <img 
              src={fullRes} 
              alt="After 변환 완료" 
              onError={handleImageError}
              className="preview-img" 
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          </div>

          </div>
        </div>

      {/* AI 정량평가 지표 뱃지를 좌우 이미지 수평 대칭을 위해 2열 그리드 아래쪽으로 완전 분리 배치 */}
      {resultData.metrics && (
        <div style={{
          marginTop: '16px',
          marginBottom: '20px',
          padding: '12px 16px',
          background: 'linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%)',
          border: '1px solid #bfdbfe',
          borderRadius: '12px',
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
        }}>
          {/* ① CLIP Score (프롬프트 일치도) */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: '#1e40af', fontWeight: '700', fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif' }}>🎯 CLIP 일치도</div>
            <div style={{ fontSize: '1.05rem', color: '#1d4ed8', fontWeight: '850', marginTop: '2px', fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif' }}>
              {resultData.metrics.clip_score !== undefined && resultData.metrics.clip_score !== null 
                ? `${(resultData.metrics.clip_score * 100).toFixed(0)}점` 
                : 'N/A'}
              <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#60a5fa', marginLeft: '4px' }}>
                ({resultData.metrics.clip_score || 0})
              </span>
            </div>
          </div>

          <div style={{ width: '1px', height: '30px', background: '#cbd5e1' }} />

          {/* ② PSNR (화질 손상/유지 변화량) */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: '#15803d', fontWeight: '700', fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif' }}>📐 화질 유지(PSNR)</div>
            <div style={{ fontSize: '1.05rem', color: '#16a34a', fontWeight: '850', marginTop: '2px', fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif' }}>
              {resultData.metrics.psnr !== undefined && resultData.metrics.psnr !== null 
                ? `${resultData.metrics.psnr} dB` 
                : 'N/A'}
            </div>
          </div>

          <div style={{ width: '1px', height: '30px', background: '#cbd5e1' }} />

          {/* ③ SSIM (구조 유지도) */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: '#6b21a8', fontWeight: '700', fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif' }}>🏗️ 구조 유지(SSIM)</div>
            <div style={{ fontSize: '1.05rem', color: '#9333ea', fontWeight: '850', marginTop: '2px', fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif' }}>
              {resultData.metrics.ssim !== undefined && resultData.metrics.ssim !== null 
                ? `${(resultData.metrics.ssim * 100).toFixed(0)}%` 
                : 'N/A'}
              <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#c084fc', marginLeft: '4px' }}>
                ({resultData.metrics.ssim || 0})
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 공간 맞춤 인테리어 제안 요약 영역 (변환 결과 하단에 렌더링) */}
      {resultData.recommendations && (
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '28px', marginTop: '16px' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--primary)', marginBottom: '20px', fontFamily: 'Outfit, sans-serif' }}>
            💡 공간 맞춤 인테리어 제안 요약
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            
            {/* 1. 벽지 추천 */}
            <div style={{ background: 'var(--bg-card-inner)', padding: '18px', borderRadius: '10px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontWeight: '850', fontSize: '0.88rem', color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px', fontFamily: 'Outfit, sans-serif' }}>
                🧱 벽지 추천
              </div>
              
              {/* 벽지 실물 참고사진 (크고 정갈하게 렌더링) */}
              {resultData.recommendations.wallpaper_image_url && (
                <div style={{ width: '100%', height: '200px', borderRadius: '8px', overflow: 'hidden', marginBottom: '12px', border: '1px solid var(--border-color)', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
                  <img 
                    src={resultData.recommendations.wallpaper_image_url} 
                    alt="추천 벽지 참고사진" 
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} 
                  />
                </div>
              )}

              {resultData.recommendations.wallpaper && resultData.recommendations.wallpaper.length > 0 ? (
                <ul style={{ paddingLeft: '16px', margin: 0, fontSize: '0.82rem', color: 'var(--text-main)', display: 'flex', flexDirection: 'column', gap: '6px', lineHeight: '1.5', textAlign: 'left' }}>
                  {summarizeList(resultData.recommendations.wallpaper).map((val, i) => <li key={i}>{val}</li>)}
                </ul>
              ) : (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'left' }}>변환 스타일링 가이드에 기반하여 밝은 톤의 벽지 밸런스를 조율하는 것을 권장합니다.</div>
              )}
            </div>

            {/* 2. 자재 추천 */}
            <div style={{ background: 'var(--bg-card-inner)', padding: '18px', borderRadius: '10px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontWeight: '850', fontSize: '0.88rem', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px', fontFamily: 'Outfit, sans-serif' }}>
                자재 추천
              </div>
              
              {/* 바닥재 실물 참고사진 (크고 정갈하게 렌더링) */}
              {resultData.recommendations.floor_image_url && (
                <div style={{ width: '100%', height: '200px', borderRadius: '8px', overflow: 'hidden', marginBottom: '12px', border: '1px solid var(--border-color)', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
                  <img 
                    src={resultData.recommendations.floor_image_url} 
                    alt="추천 바닥재 참고사진" 
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} 
                  />
                </div>
              )}

              {resultData.recommendations.materials && resultData.recommendations.materials.length > 0 ? (
                (() => {
                  const cleanText = summarizeList(resultData.recommendations.materials)
                    .map(val => {
                      if (!val) return "";
                      const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F1E0}-\u{1F1FF}]/gu;
                      return val
                        .replace(emojiRegex, '')
                        .replace(/^[-*•\s\d.]+\s*/, '')
                        .trim();
                    })
                    .filter(Boolean)
                    .join(" ");
                  return (
                    <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-main)', lineHeight: '1.6', textAlign: 'left' }}>
                      {cleanText}
                    </p>
                  );
                })()
              ) : (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'left' }}>바닥재로 원목 마루나 포세린 타일을 사용하여 공간감의 톤앤매너를 유지하세요.</div>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
