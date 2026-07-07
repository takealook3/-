// =====================================================================
// [ComparisonGallery.jsx: Streamlit 100% 동기화 Before/After 쇼룸 + 요약 제안소]
// =====================================================================
import React from 'react';
import { API_BASE_URL } from '../services/api';

const FURNITURE_RECOMMENDATIONS = {
  modern: [
    {
      name: "아치 모던 벨벳 3인 소파",
      image: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=400&q=80",
      desc: "공간을 차분하고 고급스럽게 연출하는 부드러운 스톤그레이 벨벳 마감 소파입니다. (가구 정보 ↗)",
      url: "https://www.ikea.com/kr/ko/cat/sofas-so162/"
    },
    {
      name: "블랙 스틸 프레임 콘솔 램프",
      image: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=400&q=80",
      desc: "직선적인 라인과 미니멀한 디자인으로 현대적 서재나 거실에 어울리는 조명입니다. (가구 정보 ↗)",
      url: "https://www.ikea.com/kr/ko/cat/table-lamps-10732/"
    }
  ],
  minimal: [
    {
      name: "플랫 아이보리 친환경 패브릭 소파",
      image: "https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?auto=format&fit=crop&w=400&q=80",
      desc: "불필요한 디테일을 배제하고 안락함을 극대화한 로우타입 소파입니다. (가구 정보 ↗)",
      url: "https://www.ikea.com/kr/ko/cat/fabric-sofas-10661/"
    },
    {
      name: "스틸 무몰딩 미니멀 스탠드",
      image: "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=400&q=80",
      desc: "간결한 직선 구조로 어떠한 미니멀 공간에도 이질감 없이 녹아듭니다. (가구 정보 ↗)",
      url: "https://www.ikea.com/kr/ko/cat/floor-lamps-10731/"
    }
  ],
  natural: [
    {
      name: "노르딕 솔리드 오크 원목 체어",
      image: "https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?auto=format&fit=crop&w=400&q=80",
      desc: "자연 그대로의 결을 살린 화이트오크 원목과 린넨 패브릭 시트의 조화입니다. (가구 정보 ↗)",
      url: "https://www.ikea.com/kr/ko/cat/dining-chairs-14705/"
    },
    {
      name: "내추럴 라탄 케인 사이드 테이블",
      image: "https://images.unsplash.com/photo-1533090161767-e6ffed986c88?auto=format&fit=crop&w=400&q=80",
      desc: "수공예 라탄 위빙 마감으로 편안하고 아늑한 내추럴 무드를 연출합니다. (가구 정보 ↗)",
      url: "https://www.ikea.com/kr/ko/cat/coffee-side-tables-10710/"
    }
  ],
  vintage: [
    {
      name: "클래식 앤틱 브라운 가죽 암체어",
      image: "https://images.unsplash.com/photo-1580481072645-022f9a6dbf27?auto=format&fit=crop&w=400&q=80",
      desc: "은은한 광택과 에이징된 텍스처로 레트로 감성을 완성하는 암체어입니다. (가구 정보 ↗)",
      url: "https://www.ikea.com/kr/ko/cat/armchairs-chairs-fu003/"
    },
    {
      name: "레트로 러스틱 브론즈 펜던트 조명",
      image: "https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?auto=format&fit=crop&w=400&q=80",
      desc: "황동 헤어라인 마감으로 공간에 빈티지하고 따뜻한 포인트를 줍니다. (가구 정보 ↗)",
      url: "https://www.ikea.com/kr/ko/cat/pendant-lights-18750/"
    }
  ],
  scandinavian: [
    {
      name: "아늑한 파스텔 샌드 패브릭 카우치",
      image: "https://images.unsplash.com/photo-1581081127131-64a8a8f3c21a?auto=format&fit=crop&w=400&q=80",
      desc: "북유럽 특유의 화사하고 산뜻한 분위기를 연출하는 와이드 패브릭 카우치입니다. (가구 정보 ↗)",
      url: "https://www.ikea.com/kr/ko/cat/sofas-so162/"
    },
    {
      name: "스칸디나비안 우드 삼각 다리 조명",
      image: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=400&q=80",
      desc: "내추럴 자작나무 프레임과 패브릭 쉐이드가 자아내는 온화한 빛의 흐름입니다. (가구 정보 ↗)",
      url: "https://www.ikea.com/kr/ko/cat/floor-lamps-10731/"
    }
  ],
  repair: [
    {
      name: "피에르 장네레 오마주 체어",
      image: "https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?auto=format&fit=crop&w=400&q=80",
      desc: "수공예 케인 우드와 가죽 프레임으로 고급 공간의 중심을 잡는 프리미엄 디자이너 체어입니다. (가구 정보 ↗)",
      url: "https://www.ikea.com/kr/ko/cat/chairs-fu002/"
    },
    {
      name: "아치 바우하우스 황동 테이블 램프",
      image: "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=400&q=80",
      desc: "바우하우스 디자인 철학을 계승한 미니멀 디자인 램프로 섬세한 조도를 연출합니다. (가구 정보 ↗)",
      url: "https://www.ikea.com/kr/ko/cat/table-lamps-10732/"
    }
  ]
};

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

  const styleKey = (resultData.style || "modern").toLowerCase();
  const matchedFurniture = FURNITURE_RECOMMENDATIONS[styleKey] || FURNITURE_RECOMMENDATIONS.repair;

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
          <div style={{ fontSize: '0.9rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '10px', fontFamily: 'Outfit, sans-serif' }}>
            📸 Before (원본 공간)
          </div>
          <div className="preview-box" style={{ height: '340px', border: '1px solid var(--border-color)', borderRadius: '10px', overflow: 'hidden' }}>
            {fullOrig ? (
              <img src={fullOrig} alt="Before 원본" className="preview-img" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>원본 이미지 없음</div>
            )}
          </div>
        </div>

        {/* 우측 After */}
        <div>
          <div style={{ fontSize: '0.9rem', fontWeight: '800', color: 'var(--primary)', marginBottom: '10px', fontFamily: 'Outfit, sans-serif', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>🏠 After (AI 리모델링 변환 완료)</span>
            <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', background: 'var(--bg-card-inner)', padding: '4px 10px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              ⏱️ {resultData.processingTime}초 소요
            </span>
          </div>
          <div className="preview-box" style={{ height: '340px', border: '2px solid var(--primary)', borderRadius: '10px', overflow: 'hidden' }}>
            <img 
              src={fullRes} 
              alt="After 변환 완료" 
              onError={handleImageError}
              className="preview-img" 
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          </div>

          {/* =====================================================================
              [한글 주석: 선택지 A 적용 - AI 정량평가 지표 뱃지 표시부]
              비유: 조리대에서 완성된 음식에 찍혀 나오는 AI 품질 검사 도장 뱃지입니다.
             ===================================================================== */}
          {resultData.metrics && (
            <div style={{
              marginTop: '14px',
              padding: '12px 16px',
              background: 'linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%)',
              border: '1px solid #bfdbfe',
              borderRadius: '10px',
              display: 'flex',
              justifyContent: 'space-around',
              alignItems: 'center',
              boxShadow: '0 2px 6px rgba(0,0,0,0.06)'
            }}>
              {/* ① CLIP Score (프롬프트 일치도) */}
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: '#1e40af', fontWeight: '700' }}>🎯 CLIP 일치도</div>
                <div style={{ fontSize: '1.05rem', color: '#1d4ed8', fontWeight: '850', marginTop: '2px' }}>
                  {resultData.metrics.clip_score !== undefined && resultData.metrics.clip_score !== null 
                    ? `${(resultData.metrics.clip_score * 100).toFixed(0)}점` 
                    : 'N/A'}
                  <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#60a5fa', marginLeft: '4px' }}>
                    ({resultData.metrics.clip_score || 0})
                  </span>
                </div>
              </div>

              <div style={{ width: '1px', height: '30px', background: '#cbd5e1' }} />

              {/* ② PSNR (화질 손상/유지 변화량) - 보조 지표 */}
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: '#15803d', fontWeight: '700' }}>📐 화질 유지(PSNR)</div>
                <div style={{ fontSize: '1.05rem', color: '#16a34a', fontWeight: '850', marginTop: '2px' }}>
                  {resultData.metrics.psnr !== undefined && resultData.metrics.psnr !== null 
                    ? `${resultData.metrics.psnr} dB` 
                    : 'N/A'}
                </div>
              </div>

              <div style={{ width: '1px', height: '30px', background: '#cbd5e1' }} />

              {/* ③ SSIM (구조 유지도) */}
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: '#6b21a8', fontWeight: '700' }}>🏗️ 구조 유지(SSIM)</div>
                <div style={{ fontSize: '1.05rem', color: '#9333ea', fontWeight: '850', marginTop: '2px' }}>
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
        </div>
      </div>

      {/* 공간 맞춤 인테리어 제안 요약 영역 (변환 결과 하단에 렌더링) */}
      {resultData.recommendations && (
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '28px', marginTop: '16px' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--primary)', marginBottom: '20px', fontFamily: 'Outfit, sans-serif' }}>
            💡 공간 맞춤 인테리어 제안 요약
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            
            {/* 1. 벽지 추천 */}
            <div style={{ background: 'var(--bg-card-inner)', padding: '18px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontWeight: '850', fontSize: '0.88rem', color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px', fontFamily: 'Outfit, sans-serif' }}>
                🧱 벽지 추천
              </div>
              {resultData.recommendations.wallpaper && resultData.recommendations.wallpaper.length > 0 ? (
                <ul style={{ paddingLeft: '16px', margin: 0, fontSize: '0.82rem', color: 'var(--text-main)', display: 'flex', flexDirection: 'column', gap: '6px', lineHeight: '1.5' }}>
                  {summarizeList(resultData.recommendations.wallpaper).map((val, i) => <li key={i}>{val}</li>)}
                </ul>
              ) : (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>변환 스타일링 가이드에 기반하여 밝은 톤의 벽지 밸런스를 조율하는 것을 권장합니다.</div>
              )}
            </div>

            {/* 2. 자재 추천 */}
            <div style={{ background: 'var(--bg-card-inner)', padding: '18px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontWeight: '850', fontSize: '0.88rem', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px', fontFamily: 'Outfit, sans-serif' }}>
                자재 추천
              </div>
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
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>바닥재로 원목 마루나 포세린 타일을 사용하여 공간감의 톤앤매너를 유지하세요.</div>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
