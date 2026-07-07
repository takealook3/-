// =====================================================================
// [StyleTransformer.jsx: AI 스타일 변환 및 인테리어 제안 요약소]
// =====================================================================
import React, { useState, useEffect } from 'react';
import { sendChatMessage, API_BASE_URL } from '../services/api';

export default function StyleTransformer({ 
  imageId, 
  sessionId, 
  originalImageUrl, 
  onGenerateSuccess, 
  onError,
  onResetImage,
  onResetResult,
  pendingPrompt,
  setPendingPrompt,
  globalLoading,
  globalResultImageUrl,
  globalRawAnswer,
  globalSummaryData,
  onSubmitTransform,
  globalProgress,
  bboxNormA,
  bboxNormB,
  onSwitchTab
}) {
  const [prompt, setPrompt] = useState('밝고 미니멀한 거실로 바꿔줘');

  // 부모의 상태를 Alias하여 마크업 무수정 연동 보장
  const loading = globalLoading;
  const resultImageUrl = globalResultImageUrl;
  const rawAnswer = globalRawAnswer;
  const summaryData = globalSummaryData;

  // 퀴즈 결과 프롬프트 주입 감지 및 인풋 갱신
  // 리액트 런타임 렌더링 충돌을 완벽하게 방지하기 위해 setTimeout으로 격리 실행합니다.
  React.useEffect(() => {
    if (pendingPrompt) {
      setPrompt(pendingPrompt);
      const timer = setTimeout(() => {
        setPendingPrompt('');
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [pendingPrompt, setPendingPrompt]);



  const getFullUrl = (url) => {
    if (!url) return "";
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    return `${API_BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
  };

  // AI 응답 텍스트를 분석하여 벽지, 자재, 스타일링으로 요약 분류하는 파서 헬퍼
  const parseInteriorRecommendation = (text) => {
    if (!text) return null;
    const lines = text.split('\n');
    
    const recs = {
      wallpaper: [],  // 벽지 추천
      materials: [],  // 자재 추천
      furniture: [],  // 가구/소품 추천
      general: []     // 종합 조언
    };

    lines.forEach(line => {
      const cleanLine = line.replace(/^[-*•\s\d.]+\s*/, '').trim();
      if (!cleanLine || cleanLine.length < 4) return;

      const lowerLine = cleanLine.toLowerCase();
      
      // 1. 벽지 관련 키워드 감지
      if (lowerLine.includes('벽지') || lowerLine.includes('도배') || lowerLine.includes('실크 벽지') || lowerLine.includes('페인트') || lowerLine.includes('벽면')) {
        recs.wallpaper.push(cleanLine);
      }
      // 2. 바닥 및 자재 관련 키워드 감지
      else if (lowerLine.includes('자재') || lowerLine.includes('바닥') || lowerLine.includes('마루') || lowerLine.includes('원목') || lowerLine.includes('타일') || lowerLine.includes('대리석') || lowerLine.includes('석재')) {
        recs.materials.push(cleanLine);
      }
      // 3. 가구 및 소품 스타일링 감지
      else if (lowerLine.includes('가구') || lowerLine.includes('소파') || lowerLine.includes('테이블') || lowerLine.includes('의자') || lowerLine.includes('조명') || lowerLine.includes('카펫') || lowerLine.includes('러그') || lowerLine.includes('식물') || lowerLine.includes('화분')) {
        recs.furniture.push(cleanLine);
      }
      // 4. 나머지 일반 조언
      else {
        recs.general.push(cleanLine);
      }
    });

    return recs;
  };

  const handleTransformSubmit = async (e) => {
    e?.preventDefault();
    if (!prompt || !prompt.trim() || loading) return;
    
    // 부모의 글로벌 비동기 격발 함수 실행!
    onSubmitTransform(prompt);
  };

  const STYLES_CHIPS = [
    { label: '따뜻한 우드톤', text: '포근하고 따뜻한 원목 감성의 우드톤 스타일로 바꿔줘' },
    { label: '미니멀 화이트', text: '깔끔하고 넓어 보이는 미니멀 화이트 인테리어로 변경해줘' },
    { label: '내추럴 플랜테리어', text: '싱그러운 식물들과 내추럴 우드가 조화로운 플랜테리어로 변경해줘' },
    { label: '모던 시크 다크', text: '차분하고 세련된 블랙/그레이 톤의 모던 시크 스타일로 변경해줘' }
  ];

  return (
    <div className="card" style={{ border: '1px solid var(--border-color)', fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif', padding: '28px' }}>
      {/* 상단 타이틀 바 - 대제목 제거 및 사진 변경 버튼 우측 단독 배치 */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '24px' }}>
        <button
          onClick={onResetImage}
          className="btn btn-secondary"
          style={{ fontSize: '0.8rem', padding: '6px 14px', borderRadius: '20px', fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif' }}
        >
          다른 사진으로 변경
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.48fr 1fr', gap: '24px', alignItems: 'start' }}>
        
        {/* 좌측: 리모델링 이미지 쇼룸 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="preview-box" style={{ 
            position: 'relative', 
            overflow: 'hidden', 
            borderRadius: '16px', 
            background: '#0f172a',
            border: resultImageUrl ? '2px solid var(--accent)' : '1px solid var(--border-color)',
            boxShadow: '0 12px 36px rgba(0, 0, 0, 0.08)',
            width: '100%',
            height: 'auto'
          }}>
            <img 
              src={resultImageUrl || getFullUrl(originalImageUrl)} 
              alt="인테리어 전후 비교" 
              style={{ width: '100%', height: 'auto', display: 'block' }}
            />
            
            {/* 1차 마스크 영역 박스 (동일 좌표 렌더링 유지) */}
            {bboxNormA && (
              <div
                style={{
                  position: 'absolute',
                  left: `${bboxNormA.x1 * 100}%`,
                  top: `${bboxNormA.y1 * 100}%`,
                  width: `${(bboxNormA.x2 - bboxNormA.x1) * 100}%`,
                  height: `${(bboxNormA.y2 - bboxNormA.y1) * 100}%`,
                  border: '3px solid #3B82F6',
                  borderRadius: '50%',
                  background: 'rgba(59, 130, 246, 0.15)',
                  boxShadow: '0 0 16px rgba(59, 130, 246, 0.5)',
                  pointerEvents: 'none'
                }}
              >
                <span style={{ 
                  position: 'absolute', top: '-22px', left: '50%', transform: 'translateX(-50%)', 
                  background: '#3B82F6', color: '#FCFAF7', fontSize: '0.7rem', fontWeight: '800', 
                  padding: '2px 8px', borderRadius: '4px', whiteSpace: 'nowrap', fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif' 
                }}>
                  가구 A (지정됨)
                </span>
              </div>
            )}
            
            {/* 2차 마스크 영역 박스 (동일 좌표 렌더링 유지) */}
            {bboxNormB && (
              <div
                style={{
                  position: 'absolute',
                  left: `${bboxNormB.x1 * 100}%`,
                  top: `${bboxNormB.y1 * 100}%`,
                  width: `${(bboxNormB.x2 - bboxNormB.x1) * 100}%`,
                  height: `${(bboxNormB.y2 - bboxNormB.y1) * 100}%`,
                  border: '3px solid #EC4899',
                  borderRadius: '50%',
                  background: 'rgba(236, 72, 153, 0.15)',
                  boxShadow: '0 0 16px rgba(236, 72, 153, 0.5)',
                  pointerEvents: 'none'
                }}
              >
                <span style={{ 
                  position: 'absolute', top: '-22px', left: '50%', transform: 'translateX(-50%)', 
                  background: '#EC4899', color: '#FCFAF7', fontSize: '0.7rem', fontWeight: '800', 
                  padding: '2px 8px', borderRadius: '4px', whiteSpace: 'nowrap', fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif' 
                }}>
                  가구 B (지정됨)
                </span>
              </div>
            )}
            
            {loading && (
              <div style={{ 
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, 
                background: 'rgba(15, 23, 42, 0.85)', 
                display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: '#fff',
                padding: '20px', textAlign: 'center'
              }}>
                <div style={{ fontWeight: '800', fontSize: '1.1rem', marginBottom: '8px', letterSpacing: '-0.02em' }}>이미지 변환 중...</div>
                <div style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.8)', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>
                  {globalProgress || '리모델링 엔진 연산을 대기 중입니다.'}
                </div>
              </div>
            )}

            {/* 비포 애프터 워터마크 태그 - 이모지 제거 */}
            <div style={{ 
              position: 'absolute', top: '16px', left: '16px', 
              background: resultImageUrl ? 'var(--primary)' : 'rgba(15,23,42,0.6)', 
              color: '#fff', fontSize: '0.75rem', fontWeight: '800', 
              padding: '4px 10px', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' 
            }}>
              {resultImageUrl ? "After (변환됨)" : "Before (원본)"}
            </div>
          </div>

          {/* 다운로드 - 이모지 제거 */}
          {resultImageUrl && (
            <a 
              href={resultImageUrl} 
              download="ZipPT_Remodeling_Result.jpg"
              target="_blank" 
              rel="noreferrer"
              className="btn btn-primary"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '12px', fontSize: '0.85rem', fontWeight: '700', borderRadius: '12px',
                textDecoration: 'none', fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif'
              }}
            >
              변환된 이미지 다운로드 (새 창)
            </a>
          )}
        </div>

        {/* 우측: 변환 요청 설정 폼 (글래스모피즘 플레이트) */}
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '16px',
          background: 'rgba(255, 255, 255, 0.45)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.45)',
          borderRadius: '20px',
          padding: '24px',
          boxShadow: '0 12px 36px rgba(46, 40, 36, 0.04)',
          boxSizing: 'border-box'
        }}>
          {loading ? (
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              height: '100%', 
              justifyContent: 'center', 
              alignItems: 'center',
              gap: '20px',
              padding: '10px 0'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', margin: 'auto', textAlign: 'center', padding: '0 10px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: 'var(--accent)', animation: 'pulse 1.2s infinite' }} />
                <span style={{ fontSize: '0.95rem', fontWeight: '800', color: 'var(--primary)', letterSpacing: '0.02em' }}>
                  이미지 변환 중...
                </span>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', whiteSpace: 'pre-wrap', lineHeight: '1.4', marginTop: '4px' }}>
                  {globalProgress || '작업을 로드 중입니다.'}
                </span>
              </div>

              <button
                disabled
                className="btn btn-primary"
                style={{ 
                  marginTop: 'auto',
                  width: '100%',
                  padding: '14px', fontSize: '0.95rem', fontWeight: '700',
                  background: 'rgba(43, 53, 48, 0.1)',
                  color: 'var(--text-muted)',
                  border: 'none', borderRadius: '12px'
                }}
              >
                이미지 변환 중...
              </button>
            </div>
          ) : resultImageUrl ? (
            /* 변환 완료 피드백 화면 */
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center', alignItems: 'stretch', gap: '20px', textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', margin: '0 auto' }}>🎉</div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--primary)', margin: '10px 0 4px', fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif' }}>스타일 변환 완료!</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-main)', lineHeight: '1.6', margin: '0 0 10px', fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif' }}>
                성공적으로 인테리어 스타일 변환이 완료되었습니다.<br />
                <strong>아래 Before / After 쇼룸</strong>에서 결과를 확인하고 맞춤 제안을 받아보세요!
              </p>
              <div style={{ display: 'flex', gap: '10px', marginTop: 'auto', flexWrap: 'nowrap' }}>
                <button
                  type="button"
                  onClick={onResetResult}
                  className="btn btn-secondary"
                  style={{
                    flex: 1,
                    padding: '14px 8px', fontSize: '0.85rem', fontWeight: '800', borderRadius: '12px',
                    border: '1px solid var(--border-color)', transition: 'all 0.2s',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif', cursor: 'pointer',
                    background: '#FFFFFF', whiteSpace: 'nowrap'
                  }}
                >
                  다른 스타일로 다시 하기
                </button>
                <button
                  type="button"
                  onClick={() => onSwitchTab && onSwitchTab('repair')}
                  className="btn btn-primary"
                  style={{
                    flex: 1,
                    padding: '14px 8px', fontSize: '0.85rem', fontWeight: '800', borderRadius: '12px',
                    border: 'none', transition: 'all 0.25s',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif', cursor: 'pointer',
                    background: 'var(--primary)', color: '#FCFAF7', whiteSpace: 'nowrap'
                  }}
                >
                  🛠️ 부분 가구 교체하기
                </button>
              </div>
            </div>
          ) : (
            /* 기존 폼 & 칩 뷰 */
            <form onSubmit={handleTransformSubmit} style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between', gap: '16px', margin: 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: '800', color: 'var(--primary)', fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif' }}>
                  원하는 공간 분위기 / 요구사항 입력:
                </label>
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="예: 화사하고 밝은 우드톤 거실로 변환해줘"
                  className="input-field"
                  style={{ 
                    padding: '14px 16px', 
                    fontSize: '0.9rem', 
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif',
                    borderRadius: '12px',
                    border: '1px solid var(--border-color)',
                    background: '#FFFFFF',
                    transition: 'all 0.3s ease'
                  }}
                />
              </div>



              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary"
                style={{ 
                  marginTop: 'auto',
                  padding: '14px', fontSize: '0.95rem', fontWeight: '700',
                  background: 'var(--primary)',
                  color: '#FCFAF7',
                  border: 'none', borderRadius: '12px', transition: 'all 0.25s ease',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif',
                  boxShadow: '0 8px 16px rgba(43, 53, 48, 0.15)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 12px 20px rgba(43, 53, 48, 0.25)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 8px 16px rgba(43, 53, 48, 0.15)';
                }}
              >
                AI 스타일 변환 실행
              </button>
            </form>
          )}
        </div>

      </div>

    </div>
  );
}
