// =====================================================================
// [ImageEditor.jsx: 단일 영역 원형 드래그 마스킹 (Circle Inpainting) 편집소]
// 비유: 사진 속에서 바꾸고 싶은 가구 영역을 동그란 네온 링(Circle) 스티커로 지정하고
// 원하는 가구를 입력해 마스크 픽셀 이미지를 백엔드로 직접 송신하여 수선하는 컴포넌트입니다.
// =====================================================================
import React, { useState, useRef } from 'react';
import { editImage, API_BASE_URL } from '../services/api';

export default function ImageEditor({ imageId, sessionId, originalImageUrl, onError }) {
  // 드래그 원형 마스킹 좌표 (정규화된 비율값)
  const [bboxNorm, setBboxNorm] = useState(null); // { x1, y1, x2, y2 }
  const [maskPixels, setMaskPixels] = useState(null); // [x1, y1, x2, y2]
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // 가구 교체 프롬프트
  const [promptText, setPromptText] = useState("현대적이고 고급스러운 가죽 소파");
  const [editing, setEditing] = useState(false);
  const [editedResultUrl, setEditedResultUrl] = useState(null);

  const containerRef = useRef(null);
  const imgRef = useRef(null);

  if (!imageId) return null;

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
    setBboxNorm(null);
    setMaskPixels(null);
  };

  // 마우스 드래그 중 (원형 선택 박스 생성)
  const handleMouseMove = (e) => {
    if (!isDragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const currentX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const currentY = Math.max(0, Math.min(e.clientY - rect.top, rect.height));

    const x1Norm = Math.min(dragStart.x, currentX) / rect.width;
    const y1Norm = Math.min(dragStart.y, currentY) / rect.height;
    const x2Norm = Math.max(dragStart.x, currentX) / rect.width;
    const y2Norm = Math.max(dragStart.y, currentY) / rect.height;

    setBboxNorm({ x1: x1Norm, y1: y1Norm, x2: x2Norm, y2: y2Norm });
  };

  // 마우스 클릭 종료 (정밀 좌표 확정)
  const handleMouseUp = () => {
    if (!isDragging) return;
    setIsDragging(false);

    if (bboxNorm && imgRef.current) {
      const natW = imgRef.current.naturalWidth || 800;
      const natH = imgRef.current.naturalHeight || 600;
      const px1 = Math.round(bboxNorm.x1 * natW);
      const py1 = Math.round(bboxNorm.y1 * natH);
      const px2 = Math.round(bboxNorm.x2 * natW);
      const py2 = Math.round(bboxNorm.y2 * natH);
      setMaskPixels([px1, py1, px2, py2]);
    }
  };

  // 마스크 영역 지우기
  const handleClear = () => {
    setBboxNorm(null);
    setMaskPixels(null);
    setEditedResultUrl(null);
    onError(null);
  };

  // 인페인팅 제출 (캔버스 이미지 추출 연동 설계 적용)
  const handleEditSubmit = async () => {
    if (!promptText.trim()) {
      onError({ errorCode: "PROMPT_REQUIRED", message: "교체할 가구 명칭 및 연출할 스타일 프롬프트를 입력해 주세요." });
      return;
    }
    if (!bboxNorm || !imgRef.current) {
      onError({ errorCode: "MASK_REQUIRED", message: "캔버스에 편집할 가구 영역을 드래그하여 원형으로 지정해 주세요." });
      return;
    }
    
    onError(null);
    setEditing(true);

    try {
      // 1. 원본 이미지 해상도와 1:1 대응하는 오프스크린 캔버스 동적 빌드
      const canvas = document.createElement('canvas');
      const natW = imgRef.current.naturalWidth;
      const natH = imgRef.current.naturalHeight;
      canvas.width = natW;
      canvas.height = natH;

      const ctx = canvas.getContext('2d');
      // 2. 캔버스 배경 검은색 충진 (0 = 마스킹 안됨)
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, natW, natH);

      // 3. 사용자가 드래그한 타원(원) 영역 내부에 흰색 붓 칠하기 (255 = 마스킹 됨)
      const x = bboxNorm.x1 * natW;
      const y = bboxNorm.y1 * natH;
      const w = (bboxNorm.x2 - bboxNorm.x1) * natW;
      const h = (bboxNorm.y2 - bboxNorm.y1) * natH;

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      const cx = x + w / 2;
      const cy = y + h / 2;
      const rx = w / 2;
      const ry = h / 2;
      ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
      ctx.fill();

      // 4. 캔버스로부터 Base64 PNG 추출
      const base64Mask = canvas.toDataURL('image/png');

      // 5. 백엔드 전송
      const res = await editImage({
        imageId,
        sessionId,
        mask: base64Mask, // Base64 마스크 이미지 통으로 송신!
        selected_object: "furniture",
        prompt: promptText.trim()
      });

      if (res.success) {
        const eUrl = res.data?.edited_image_url || res.data?.editedImageUrl;
        setEditedResultUrl(eUrl);
      } else {
        onError({ errorCode: res.errorCode || "PROCESSING_FAILED", message: res.message });
      }
    } catch (err) {
      console.error(err);
      onError({ errorCode: "CANVAS_ERROR", message: `마스크 이미지 추출 중 장애가 발생했습니다: ${err.message}` });
    } finally {
      setEditing(false);
    }
  };

  return (
    <div className="card" style={{ border: '1px solid #334155' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div className="card-title" style={{ fontSize: '1.25rem', fontWeight: '800' }}>
          🛠️ 4. AI 가구 영역 부분 교체 (원형 인페인팅)
        </div>
        <button 
          onClick={handleClear}
          className="toolbar-btn" 
          style={{ fontSize: '0.8rem', padding: '6px 12px', background: '#334155', color: '#cbd5e1', borderRadius: '6px' }}
        >
          영역 초기화 🗑️
        </button>
      </div>
      <div className="card-desc" style={{ marginBottom: '16px' }}>
        마우스 드래그를 통해 변경하고 싶은 가구 영역을 <strong>원형(Circle)</strong>으로 지정한 뒤, 원하는 새로운 스타일이나 가구 지시 프롬프트를 입력하여 감쪽같이 교체해 보세요.
      </div>

      <div className="grid-2">
        {/* 좌측: 마스킹 캔버스 */}
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
              border: `2px dashed #38bdf8`,
              overflow: 'hidden'
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
            {/* 원형 마스크 영역 인디케이터 (네온 블루 서클) */}
            {bboxNorm && (
              <div
                style={{
                  position: 'absolute',
                  left: `${bboxNorm.x1 * 100}%`,
                  top: `${bboxNorm.y1 * 100}%`,
                  width: `${(bboxNorm.x2 - bboxNorm.x1) * 100}%`,
                  height: `${(bboxNorm.y2 - bboxNorm.y1) * 100}%`,
                  border: '3px solid #38bdf8',
                  borderRadius: '50%', // 이 핵심 속성이 사각형을 타원/원형 네온 스티커로 변형합니다.
                  background: 'rgba(56, 189, 248, 0.25)',
                  boxShadow: '0 0 12px #38bdf8',
                  pointerEvents: 'none'
                }}
              >
                <span style={{ position: 'absolute', top: '-24px', left: '50%', transform: 'translateX(-50%)', background: '#38bdf8', color: '#0f172a', fontSize: '0.75rem', fontWeight: '800', padding: '2px 8px', borderRadius: '4px', whiteSpace: 'nowrap' }}>
                  타겟 영역
                </span>
              </div>
            )}
          </div>

          <div className="success-banner" style={{ marginTop: '12px', background: '#1e293b', fontSize: '0.8rem', color: '#cbd5e1' }}>
            {maskPixels ? (
              <div>🎯 <strong>지정된 원형 영역:</strong> [가로 {maskPixels[0]}~{maskPixels[2]} px, 세로 {maskPixels[1]}~{maskPixels[3]} px]</div>
            ) : (
              <div>🎯 <strong>마스킹 대기:</strong> 사진 위를 마우스 드래그하여 가구 주변을 원형으로 감싸주세요.</div>
            )}
          </div>
        </div>

        {/* 우측: 수선 지시 폼 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.95rem', fontWeight: '700', color: '#38bdf8', marginBottom: '8px' }}>
              🎨 교체할 가구 및 인테리어 지시어 (Prompt):
            </label>
            <input
              type="text"
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder="예: 현대적이고 세련된 브라운 가죽 소파"
              className="input-field"
              style={{ borderColor: '#0284c7' }}
            />
          </div>

          <button
            type="button"
            onClick={handleEditSubmit}
            disabled={editing || !maskPixels}
            className="btn btn-coral btn-full"
            style={{ 
              padding: '14px', 
              fontSize: '1rem', 
              fontWeight: '700',
              cursor: (!maskPixels || editing) ? 'not-allowed' : 'pointer',
              background: (!maskPixels) ? '#334155' : 'linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              transition: 'all 0.3s',
              boxShadow: maskPixels ? '0 4px 12px rgba(56, 189, 248, 0.3)' : 'none'
            }}
          >
            {editing ? "✨ AI 원형 마스킹 인페인팅 적용 중..." : "✨ AI 가구 영역 교체 실행"}
          </button>

          <hr style={{ borderColor: '#334155', margin: '4px 0' }} />

          <div>
            <div style={{ fontSize: '1.05rem', fontWeight: '800', color: '#fff', marginBottom: '8px' }}>
              🎉 인페인팅 수선 결과
            </div>
            {editedResultUrl ? (
              <div>
                <div className="success-banner" style={{ marginBottom: '12px', background: '#022c22', border: '1px solid #059669' }}>
                  <span>☑️</span>
                  <span>가구 영역이 성공적으로 편집되었습니다! 아래 프리뷰에서 모습을 확인해 보세요.</span>
                </div>
                <div className="preview-box" style={{ height: '260px', border: '2px solid #10b981', position: 'relative', overflow: 'hidden', borderRadius: '8px' }}>
                  <img src={getFullUrl(editedResultUrl)} alt="편집 완료 이미지" className="preview-img" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </div>
              </div>
            ) : (
              <div style={{ padding: '35px 24px', background: '#0f172a', borderRadius: '10px', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
                아직 수선 완료된 결과가 없습니다. 좌측 화면에 원형 영역을 지정하고 가구 변경 단추를 눌러주세요.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
