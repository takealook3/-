// =====================================================================
// [StyleSelector.jsx: Streamlit 100% 동기화 스타일 및 프롬프트 설정]
// =====================================================================
import React, { useState } from 'react';
import { generateInteriorImage } from '../services/api';

const STYLES = [
  { id: 'modern', label: 'Modern', desc: '도시적이고 세련된 직선 스타일' },
  { id: 'minimal', label: 'Minimal', desc: '여백의 미를 살린 정돈된 공간' },
  { id: 'natural', label: 'Natural', desc: '따뜻한 우드와 자연 친화적 감성' },
  { id: 'vintage', label: 'Vintage', desc: '클래식하고 아늑한 레트로 스타일' },
  { id: 'scandinavian', label: 'Scandinavian', desc: '실용적이고 화사한 북유럽 디자인' },
];

export default function StyleSelector({ 
  imageId, 
  sessionId, 
  onGenerateSuccess, 
  onError 
}) {
  const [selectedStyle, setSelectedStyle] = useState('modern');
  const [prompt, setPrompt] = useState('밝고 미니멀한 거실로 바꿔줘');
  const [generating, setGenerating] = useState(false);

  // Streamlit 100% 동기화: 사진 등록 ID가 없으면 설정 창을 완전히 숨깁니다.
  if (!imageId) return null;

  const handleGenerateSubmit = async (e) => {
    e?.preventDefault();

    if (!prompt || !prompt.trim()) {
      onError({
        errorCode: "PROMPT_REQUIRED",
        message: "인테리어 변환을 위한 프롬프트(요구사항)를 입력해 주세요."
      });
      return;
    }

    onError(null);
    setGenerating(true);

    const res = await generateInteriorImage({
      imageId,
      sessionId,
      style: selectedStyle,
      prompt: prompt.trim()
    });

    setGenerating(false);

    if (res.success) {
      const gData = res.data || {};
      onGenerateSuccess({
        resultId: gData.result_id,
        resultImageUrl: gData.result_image_url,
        style: gData.style,
        prompt: gData.prompt,
        processingTime: gData.processing_time,
        status: gData.status || "completed"
      });
    } else {
      onError({
        errorCode: res.errorCode || "PROCESSING_FAILED",
        message: res.message
      });
    }
  };

  return (
    <div className="card">
      <div className="card-title">🎨 3. 인테리어 스타일 및 프롬프트 설정</div>
      <div className="card-desc">원하는 디자인 스타일을 선택하고 리모델링 요구사항을 입력하세요.</div>

      {/* Streamlit 동기화: 드롭다운(selectbox) + 카드 동시 지원 */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <label style={{ fontSize: '0.9rem', fontWeight: '600', color: '#e2e8f0' }}>
            디자인 스타일 선택 (Streamlit Selectbox 동기화):
          </label>
          <select
            value={selectedStyle}
            onChange={(e) => setSelectedStyle(e.target.value)}
            className="input-field"
            style={{ width: '220px', padding: '8px 12px' }}
          >
            {STYLES.map((st) => (
              <option key={st.id} value={st.id}>
                {st.label} ({st.id})
              </option>
            ))}
          </select>
        </div>

        <div className="grid-5">
          {STYLES.map((st) => (
            <button
              key={st.id}
              type="button"
              onClick={() => setSelectedStyle(st.id)}
              className={`style-btn ${selectedStyle === st.id ? 'active' : ''}`}
            >
              <div style={{ fontWeight: '700', fontSize: '0.9rem', marginBottom: '4px' }}>{st.label}</div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', lineHeight: '1.3' }}>{st.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 프롬프트 입력창 */}
      <form onSubmit={handleGenerateSubmit}>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '600', color: '#e2e8f0', marginBottom: '8px' }}>
            리모델링 요구사항 입력 (Prompt):
          </label>
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="예: 밝고 미니멀한 거실로 바꿔줘"
            className="input-field"
          />
        </div>

        <button
          type="submit"
          disabled={generating}
          className="btn btn-primary btn-full"
          style={{ padding: '14px', fontSize: '1rem' }}
        >
          {generating ? "✨ AI가 인테리어 리모델링 변환 중... (잠시만 기다려주세요)" : "✨ 이미지 변환 실행 (POST /api/image/generate)"}
        </button>
      </form>
    </div>
  );
}
