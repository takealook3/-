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
  pendingPrompt,
  setPendingPrompt
}) {
  const [prompt, setPrompt] = useState('밝고 미니멀한 거실로 바꿔줘');
  const [loading, setLoading] = useState(false);
  const [resultImageUrl, setResultImageUrl] = useState(null);
  const [rawAnswer, setRawAnswer] = useState('');
  const [summaryData, setSummaryData] = useState(null);

  // 퀴즈 결과 프롬프트 주입 감지 및 인풋 갱신
  useEffect(() => {
    if (pendingPrompt) {
      setPrompt(pendingPrompt);
      setPendingPrompt('');
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

    setLoading(true);
    setResultImageUrl(null);
    setRawAnswer('');
    setSummaryData(null);
    onError(null);

    // 사용자의 자연어 요구사항 프롬프트 전송
    const combinedQuestion = prompt.trim();

    try {
      const res = await sendChatMessage({
        sessionId: sessionId || "session_default",
        question: combinedQuestion,
        imageId: imageId
      });

      if (res.success) {
        const respData = res.data || {};
        const fullImg = getFullUrl(respData.image_url);
        setResultImageUrl(fullImg);
        setRawAnswer(respData.answer || "");
        
        // AI 코멘트 자재 요약 분석 실행
        const parsed = parseInteriorRecommendation(respData.answer);
        setSummaryData(parsed);

        if (respData.result_id && onGenerateSuccess) {
          onGenerateSuccess({
            resultId: respData.result_id,
            resultImageUrl: fullImg,
            style: respData.style || "modern",
            prompt: respData.prompt || prompt.trim(),
            processingTime: respData.processing_time || 0,
            status: "completed",
            recommendations: parsed
          });
        }
      } else {
        onError({
          errorCode: res.errorCode || "PROCESSING_FAILED",
          message: res.message || "스타일 변환 작업에 실패했습니다."
        });
      }
    } catch (err) {
      console.error(err);
      onError({
        errorCode: "SERVER_ERROR",
        message: `스타일 변환 통신 오류: ${err.message}`
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" style={{ border: '1px solid var(--border-color)', fontFamily: 'Outfit, sans-serif' }}>
      {/* 상단 타이틀 바 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div className="card-title" style={{ fontSize: '1.35rem', fontWeight: '800', fontFamily: 'Outfit, sans-serif', color: 'var(--primary)', margin: 0, letterSpacing: '-0.02em' }}>
          🎨 스타일 변환
        </div>
        <button
          onClick={onResetImage}
          className="btn btn-secondary"
          style={{ fontSize: '0.8rem', padding: '6px 14px', borderRadius: '20px', fontFamily: 'Outfit, sans-serif' }}
        >
          🔄 다른 사진으로 변경
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '28px', alignItems: 'start' }}>
        
        {/* 좌측: 리모델링 이미지 쇼룸 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="preview-box" style={{ 
            height: '340px', 
            position: 'relative', 
            overflow: 'hidden', 
            borderRadius: '12px', 
            background: '#0f172a',
            border: resultImageUrl ? '2px solid var(--accent)' : '1px solid var(--border-color)',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.08)'
          }}>
            <img 
              src={resultImageUrl || getFullUrl(originalImageUrl)} 
              alt="인테리어 전후 비교" 
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
            
            {/* 로딩 인디케이터 오버레이 */}
            {loading && (
              <div style={{ 
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, 
                background: 'rgba(15, 23, 42, 0.8)', 
                display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: '#fff' 
              }}>
                <div style={{ fontSize: '2rem', marginBottom: '10px', animation: 'spin 2s linear infinite' }}>⏳</div>
                <div style={{ fontWeight: '700', fontSize: '1rem' }}>공간 리모델링 및 자재 분석 중...</div>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '6px' }}>대략 5~10초 소요됩니다. 잠시만 기다려주세요.</div>
              </div>
            )}

            {/* 비포 애프터 워터마크 태그 */}
            <div style={{ 
              position: 'absolute', top: '12px', left: '12px', 
              background: resultImageUrl ? 'var(--primary)' : 'rgba(15,23,42,0.6)', 
              color: '#fff', fontSize: '0.75rem', fontWeight: '800', 
              padding: '4px 10px', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' 
            }}>
              {resultImageUrl ? "🎨 After (변환됨)" : "📸 Before (원본)"}
            </div>
          </div>

          {/* 다운로드 */}
          {resultImageUrl && (
            <a 
              href={resultImageUrl} 
              download="ZipPT_Remodeling_Result.jpg"
              target="_blank" 
              rel="noreferrer"
              className="btn btn-primary"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '12px', fontSize: '0.85rem', fontWeight: '700', borderRadius: '8px',
                textDecoration: 'none', fontFamily: 'Outfit, sans-serif'
              }}
            >
              💾 변환된 이미지 다운로드 (새 창)
            </a>
          )}
        </div>

        {/* 우측: 변환 요청 설정 폼 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* 프롬프트 입력 */}
          <form onSubmit={handleTransformSubmit}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '8px', fontFamily: 'Outfit, sans-serif' }}>
                원하는 공간 분위기 / 요구사항 입력:
              </label>
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="예: 화사하고 밝은 우드톤 거실로 변환해줘"
                className="input-field"
                style={{ padding: '12px 16px', fontSize: '0.9rem', fontFamily: 'Outfit, sans-serif' }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary btn-full"
              style={{ 
                padding: '14px', fontSize: '0.95rem', fontWeight: '700',
                background: loading ? 'var(--bg-card-inner)' : 'var(--primary)',
                color: loading ? 'var(--text-muted)' : '#FCFAF7',
                border: 'none', borderRadius: '8px', transition: 'all 0.25s ease',
                fontFamily: 'Outfit, sans-serif'
              }}
            >
              {loading ? "✨ 스타일 리모델링 변환 중..." : "✨ AI 스타일 변환 실행"}
            </button>
          </form>
        </div>

      </div>


    </div>
  );
}
