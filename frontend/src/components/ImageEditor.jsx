// =====================================================================
// [ImageEditor.jsx: 2단계 릴레이 가구 수선 (2-Step Inpainting) 통합 지휘소]
// 비유: 사진 속에서 바꾸고 싶은 가구 2개(예: 화분과 소파)의 영역을 각각 
// 네온 블루(A)와 네온 핑크(B) 스티커로 지정한 뒤, 동시에 수선을 의뢰하는 공간입니다.
// =====================================================================
import React, { useState, useRef } from 'react';
import { editImage, API_BASE_URL } from '../services/api';

export default function ImageEditor({ imageId, sessionId, originalImageUrl, onError }) {
  // 마스크 모드: 'A' (1차 가구 수선) 또는 'B' (2차 가구 수선)
  const [maskMode, setMaskMode] = useState('A');

  // 드래그 마스킹 좌표 (A 영역 - 네온 블루)
  const [bboxNormA, setBboxNormA] = useState(null); // { x1, y1, x2, y2 }
  const [maskPixelsA, setMaskPixelsA] = useState(null); // [x1, y1, x2, y2]

  // 드래그 마스킹 좌표 (B 영역 - 네온 핑크)
  const [bboxNormB, setBboxNormB] = useState(null); // { x1, y1, x2, y2 }
  const [maskPixelsB, setMaskPixelsB] = useState(null); // [x1, y1, x2, y2]

  // 마우스 드래그 상태
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // 1차/2차 수선 프롬프트
  const [promptA, setPromptA] = useState("하얀색 도자기 화분");
  const [promptB, setPromptB] = useState("현대적인 가죽 소파");

  const [editing, setEditing] = useState(false);
  const [editedResultUrl, setEditedResultUrl] = useState(null);

  const containerRef = useRef(null);
  const imgRef = useRef(null);

  if (!imageId) return null; // 사진 등록 전에는 렌더링하지 않음

  const getFullUrl = (url) => {
    if (!url) return "";
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    return `${API_BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
  };

  const fullOrigUrl = getFullUrl(originalImageUrl);

  // 마우스 클릭 시작
  const handleMouseDown = (e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setIsDragging(true);
    setDragStart({ x, y });

    if (maskMode === 'A') {
      setBboxNormA(null);
      setMaskPixelsA(null);
    } else {
      setBboxNormB(null);
      setMaskPixelsB(null);
    }
  };

  // 마우스 드래그 중
  const handleMouseMove = (e) => {
    if (!isDragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const currentX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const currentY = Math.max(0, Math.min(e.clientY - rect.top, rect.height));

    const x1Norm = Math.min(dragStart.x, currentX) / rect.width;
    const y1Norm = Math.min(dragStart.y, currentY) / rect.height;
    const x2Norm = Math.max(dragStart.x, currentX) / rect.width;
    const y2Norm = Math.max(dragStart.y, currentY) / rect.height;

    const coords = { x1: x1Norm, y1: y1Norm, x2: x2Norm, y2: y2Norm };

    if (maskMode === 'A') {
      setBboxNormA(coords);
    } else {
      setBboxNormB(coords);
    }
  };

  // 마우스 클릭 종료 (좌표 확정)
  const handleMouseUp = () => {
    if (!isDragging) return;
    setIsDragging(false);

    const activeBboxNorm = maskMode === 'A' ? bboxNormA : bboxNormB;

    if (activeBboxNorm && imgRef.current) {
      const natW = imgRef.current.naturalWidth || 800;
      const natH = imgRef.current.naturalHeight || 600;
      const px1 = Math.round(activeBboxNorm.x1 * natW);
      const py1 = Math.round(activeBboxNorm.y1 * natH);
      const px2 = Math.round(activeBboxNorm.x2 * natW);
      const py2 = Math.round(activeBboxNorm.y2 * natH);

      if (maskMode === 'A') {
        setMaskPixelsA([px1, py1, px2, py2]);
      } else {
        setMaskPixelsB([px1, py1, px2, py2]);
      }
    }
  };

  // 특정 마스크 영역 리셋
  const handleClearActiveMask = () => {
    if (maskMode === 'A') {
      setBboxNormA(null);
      setMaskPixelsA(null);
    } else {
      setBboxNormB(null);
      setMaskPixelsB(null);
    }
  };

  // 전체 마스크 리셋
  const handleClearAll = () => {
    setBboxNormA(null);
    setMaskPixelsA(null);
    setBboxNormB(null);
    setMaskPixelsB(null);
    setEditedResultUrl(null);
    onError(null);
  };

  // 수정하기 호출
  const handleEditSubmit = async () => {
    if (!promptA.trim()) {
      onError({ errorCode: "PROMPT_REQUIRED", message: "1차 교체 가구 설명(A)을 입력해 주세요." });
      return;
    }
    
    onError(null);
    setEditing(true);

    const res = await editImage({
      imageId,
      sessionId,
      mask: maskPixelsA,
      mask_b: maskPixelsB,
      prompt: promptA.trim(),
      prompt_b: maskPixelsB ? promptB.trim() : null
    });

    setEditing(false);
    if (res.success) {
      const eUrl = res.data?.edited_image_url || res.data?.editedImageUrl;
      setEditedResultUrl(eUrl);
    } else {
      onError({ errorCode: res.errorCode || "PROCESSING_FAILED", message: res.message });
    }
  };

  return (
    <div className="card" style={{ border: '1px solid #334155' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div className="card-title" style={{ fontSize: '1.25rem', fontWeight: '800' }}>
          🛠️ 4. 2단계 릴레이 가구 수선 (Double Inpainting)
        </div>
        <button 
          onClick={handleClearAll}
          className="toolbar-btn" 
          style={{ fontSize: '0.8rem', padding: '6px 12px', background: '#334155', color: '#cbd5e1', borderRadius: '6px' }}
        >
          전체 리셋 🗑️
        </button>
      </div>
      <div className="card-desc" style={{ marginBottom: '16px' }}>
        마우스 드래그를 이용해 사진 속의 1차 교체 가구(A)와 2차 교체 가구(B) 영역을 지정하고, 각각의 요구사항을 입력해 인페인팅을 동시 의뢰합니다.
      </div>

      {/* 수선 타겟 편집 탭 */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
        <button
          type="button"
          onClick={() => setMaskMode('A')}
          style={{
            flex: 1,
            padding: '10px',
            borderRadius: '8px',
            fontWeight: '700',
            fontSize: '0.9rem',
            cursor: 'pointer',
            transition: 'all 0.2s',
            background: maskMode === 'A' ? '#075985' : '#1e293b',
            border: `2px solid ${maskMode === 'A' ? '#38bdf8' : '#334155'}`,
            color: maskMode === 'A' ? '#e0f2fe' : '#94a3b8',
            boxShadow: maskMode === 'A' ? '0 0 10px rgba(56, 189, 248, 0.2)' : 'none'
          }}
        >
          🔵 1차 가구 수선 (A 영역 설정)
        </button>
        <button
          type="button"
          onClick={() => setMaskMode('B')}
          style={{
            flex: 1,
            padding: '10px',
            borderRadius: '8px',
            fontWeight: '700',
            fontSize: '0.9rem',
            cursor: 'pointer',
            transition: 'all 0.2s',
            background: maskMode === 'B' ? '#831843' : '#1e293b',
            border: `2px solid ${maskMode === 'B' ? '#f43f5e' : '#334155'}`,
            color: maskMode === 'B' ? '#ffe4e6' : '#94a3b8',
            boxShadow: maskMode === 'B' ? '0 0 10px rgba(244, 63, 94, 0.2)' : 'none'
          }}
        >
          🔴 2차 가구 수선 (B 영역 설정)
        </button>
      </div>

      <div className="grid-2">
        {/* 좌측: 마스킹 캔버스 및 개별 초기화 */}
        <div>
          <div
            ref={containerRef}
            className="canvas-container"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            style={{ 
              cursor: 'crosshair', 
              position: 'relative',
              borderRadius: '8px',
              border: `2px dashed ${maskMode === 'A' ? '#38bdf8' : '#f43f5e'}`
            }}
          >
            <img
              ref={imgRef}
              src={fullOrigUrl}
              alt="부분 편집 원본"
              className="canvas-img"
              draggable={false}
              style={{ width: '100%', height: 'auto', display: 'block', borderRadius: '6px' }}
            />
            {/* 1차 마스크 영역 박스 (블루) */}
            {bboxNormA && (
              <div
                style={{
                  position: 'absolute',
                  left: `${bboxNormA.x1 * 100}%`,
                  top: `${bboxNormA.y1 * 100}%`,
                  width: `${(bboxNormA.x2 - bboxNormA.x1) * 100}%`,
                  height: `${(bboxNormA.y2 - bboxNormA.y1) * 100}%`,
                  border: '3px solid #38bdf8',
                  background: 'rgba(56, 189, 248, 0.25)',
                  boxShadow: '0 0 8px #38bdf8',
                  pointerEvents: 'none'
                }}
              >
                <span style={{ position: 'absolute', top: '-22px', left: '-3px', background: '#38bdf8', color: '#0f172a', fontSize: '0.7rem', fontWeight: '800', padding: '1px 5px', borderRadius: '3px 3px 0 0' }}>
                  가구 A
                </span>
              </div>
            )}
            {/* 2차 마스크 영역 박스 (핑크) */}
            {bboxNormB && (
              <div
                style={{
                  position: 'absolute',
                  left: `${bboxNormB.x1 * 100}%`,
                  top: `${bboxNormB.y1 * 100}%`,
                  width: `${(bboxNormB.x2 - bboxNormB.x1) * 100}%`,
                  height: `${(bboxNormB.y2 - bboxNormB.y1) * 100}%`,
                  border: '3px solid #f43f5e',
                  background: 'rgba(244, 63, 94, 0.25)',
                  boxShadow: '0 0 8px #f43f5e',
                  pointerEvents: 'none'
                }}
              >
                <span style={{ position: 'absolute', top: '-22px', left: '-3px', background: '#f43f5e', color: '#fff', fontSize: '0.7rem', fontWeight: '800', padding: '1px 5px', borderRadius: '3px 3px 0 0' }}>
                  가구 B
                </span>
              </div>
            )}
          </div>

          {/* 도구바 */}
          <div className="toolbar" style={{ marginTop: '10px' }}>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              현재 설정 모드: {maskMode === 'A' ? '🔵 1차 가구' : '🔴 2차 가구'}
            </span>
            <button
              type="button"
              className="toolbar-btn"
              onClick={handleClearActiveMask}
              style={{ fontSize: '0.8rem', padding: '4px 10px', background: '#475569', borderRadius: '4px' }}
            >
              선택 영역 지우기 🧹
            </button>
          </div>

          {/* 감지 정보 배너 */}
          <div className="success-banner" style={{ marginTop: '12px', background: '#1e293b', fontSize: '0.8rem', color: '#cbd5e1' }}>
            <div>
              {maskPixelsA ? (
                <div>🔵 <strong>가구 A 영역:</strong> [x: {maskPixelsA[0]}~{maskPixelsA[2]}, y: {maskPixelsA[1]}~{maskPixelsA[3]}] ({promptA})</div>
              ) : (
                <div>🔵 <strong>가구 A 영역:</strong> 캔버스에 영역을 드래그해 주세요 (필수)</div>
              )}
              {maskPixelsB ? (
                <div style={{ marginTop: '4px' }}>🔴 <strong>가구 B 영역:</strong> [x: {maskPixelsB[0]}~{maskPixelsB[2]}, y: {maskPixelsB[1]}~{maskPixelsB[3]}] ({promptB})</div>
              ) : (
                <div style={{ marginTop: '4px', color: '#64748b' }}>🔴 <strong>가구 B 영역:</strong> 추가 변경이 필요하면 모드 전환 후 지정하세요 (선택)</div>
              )}
            </div>
          </div>
        </div>

        {/* 우측: 수선 지시 양식 및 결과 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '700', color: '#38bdf8', marginBottom: '6px' }}>
              🔵 1차 가구 수선 요청 (Prompt A):
            </label>
            <input
              type="text"
              value={promptA}
              onChange={(e) => setPromptA(e.target.value)}
              placeholder="예: 하얀색 도자기 화분"
              className="input-field"
              style={{ borderColor: '#0284c7' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '700', color: '#f43f5e', marginBottom: '6px', opacity: maskPixelsB ? 1 : 0.5 }}>
              🔴 2차 가구 수선 요청 (Prompt B):
            </label>
            <input
              type="text"
              value={promptB}
              onChange={(e) => setPromptB(e.target.value)}
              placeholder="예: 현대적인 가죽 소파"
              className="input-field"
              disabled={!maskPixelsB}
              style={{ 
                borderColor: maskPixelsB ? '#be123c' : '#334155',
                opacity: maskPixelsB ? 1 : 0.5,
                cursor: maskPixelsB ? 'text' : 'not-allowed'
              }}
            />
          </div>

          <button
            type="button"
            onClick={handleEditSubmit}
            disabled={editing || !maskPixelsA}
            className="btn btn-coral btn-full"
            style={{ 
              padding: '14px', 
              fontSize: '1rem', 
              fontWeight: '700',
              cursor: (!maskPixelsA || editing) ? 'not-allowed' : 'pointer',
              background: (!maskPixelsA) ? '#334155' : 'linear-gradient(135deg, #f43f5e 0%, #be123c 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              transition: 'all 0.3s'
            }}
          >
            {editing ? "✨ AI 릴레이 수선 작업 중... (잠시만 기다려주세요)" : "✨ 2단계 릴레이 수선하기 실행"}
          </button>

          <hr style={{ borderColor: '#334155', margin: '4px 0' }} />

          <div>
            <div style={{ fontSize: '1.05rem', fontWeight: '800', color: '#fff', marginBottom: '8px' }}>
              🎉 최신 수선 완료 결과
            </div>
            {editedResultUrl ? (
              <div>
                <div className="success-banner" style={{ marginBottom: '12px', background: '#022c22', border: '1px solid #059669' }}>
                  <span>☑️</span>
                  <span>릴레이 편집 결과가 생성되었습니다! 아래에서 합성된 모습을 확인해 보세요.</span>
                </div>
                <div className="preview-box" style={{ height: '240px', border: '2px solid #10b981', position: 'relative', overflow: 'hidden', borderRadius: '8px' }}>
                  <img src={getFullUrl(editedResultUrl)} alt="편집 완료 이미지" className="preview-img" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </div>
              </div>
            ) : (
              <div style={{ padding: '30px 24px', background: '#0f172a', borderRadius: '10px', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
                아직 수선된 결과가 없습니다. 좌측 캔버스에 영역을 선택하고 [✨ 2단계 릴레이 수선하기] 버튼을 클릭해 주세요.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
