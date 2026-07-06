// =====================================================================
// [ImageEditor.jsx: 부분 가구 교체 및 수선 (Image Inpainting) 창구]
// 비유: 사진 속에서 바꾸고 싶은 가구(예: 침대, 소파) 영역 위에
// 마우스로 빨간 테이프를 둘러 지정한 뒤, 새 가구로 교체해 달라고 의뢰하는 곳입니다.
// =====================================================================
import React, { useState, useRef } from 'react';
import { editImage, inpaintImage, API_BASE_URL } from '../services/api';


export default function ImageEditor({ imageId, sessionId, originalImageUrl, onError }) {
  // 드래그 마스킹 좌표 State (비율 0~100 및 픽셀)
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [bboxNorm, setBboxNorm] = useState(null); // { x1, y1, x2, y2 } (0~1 범위 비율)
  const [maskPixels, setMaskPixels] = useState(null); // [x1, y1, x2, y2] 실제 픽셀 좌표

  // 편집 폼 State
  const [prompt, setPrompt] = useState("하얀색 소파로 교체");
  const [editing, setEditing] = useState(false);
  const [editedResultUrl, setEditedResultUrl] = useState(null);

  const containerRef = useRef(null);
  const imgRef = useRef(null);

  if (!imageId) return null; // Streamlit 동기화: 사진 등록 전에는 숨김

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

    setBboxNorm({ x1: x1Norm, y1: y1Norm, x2: x2Norm, y2: y2Norm });
  };

  // 마우스 클릭 종료 (바운딩 박스 확정)
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

  // 쓰레기통(지우기) 클릭
  const handleClearMask = () => {
    setBboxNorm(null);
    setMaskPixels(null);
  };

  // 수정하기 실행
  const handleEditSubmit = async () => {
    if (!maskPixels) {
      onError({ errorCode: "MASK_REQUIRED", message: "수정할 가구 영역이 선택되지 않았습니다. 좌측 사진 위에서 마우스로 드래그하여 영역을 지정해 주세요." });
      return;
    }
    if (!prompt.trim()) {
      onError({ errorCode: "PROMPT_REQUIRED", message: "교체할 가구 설명 프롬프트를 입력해 주세요." });
      return;
    }
    onError(null);
    setEditing(true);

    // 신규 inpaintImage API 호출 (Realistic Vision V6.0 B1 기반 Inpainting)
    const res = await inpaintImage({
      imageId,
      sessionId,
      mask: maskPixels,
      bbox: maskPixels,
      prompt: prompt.trim(),
      mode: "inpainting"
    });

    setEditing(false);
    if (res.success) {
      const eUrl = res.result_image_url || res.data?.result_image_url || res.data?.edited_image_url || res.data?.editedImageUrl;
      setEditedResultUrl(eUrl);
    } else {
      onError({ errorCode: res.errorCode || "INPAINTING_FAILED", message: res.message });
    }
  };

  return (
    <div className="card">
      <div className="card-title">🛠️ 4. 부분 가구 교체 및 수선 (Image Inpainting)</div>
      <div className="card-desc">
        왼쪽 원본 사진에서 마우스로 드래그하여 바꾸고 싶은 가구 영역(예: 침대, 소파)을 박스로 치고 수선 프롬프트를 입력하세요.
      </div>

      <div className="grid-2">
        {/* 좌측: 마스킹 캔버스 및 도구모음 */}
        <div>
          <div
            ref={containerRef}
            className="canvas-container"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            style={{ cursor: 'crosshair' }}
          >
            <img
              ref={imgRef}
              src={fullOrigUrl}
              alt="부분 편집 원본"
              className="canvas-img"
              draggable={false}
            />
            {/* 드래그된 바운딩 박스 표시 */}
            {bboxNorm && (
              <div
                className="bbox-rect"
                style={{
                  left: `${bboxNorm.x1 * 100}%`,
                  top: `${bboxNorm.y1 * 100}%`,
                  width: `${(bboxNorm.x2 - bboxNorm.x1) * 100}%`,
                  height: `${(bboxNorm.y2 - bboxNorm.y1) * 100}%`
                }}
              />
            )}
          </div>

          {/* 하단 도구바 */}
          <div className="toolbar">
            <button type="button" className="toolbar-btn" title="다운로드" onClick={() => window.open(fullOrigUrl)}>📥</button>
            <button type="button" className="toolbar-btn" title="실행취소" onClick={handleClearMask}>↩️</button>
            <button type="button" className="toolbar-btn" title="다시실행">↪️</button>
            <button type="button" className="toolbar-btn" title="마스크 초기화" onClick={handleClearMask}>🗑️</button>
          </div>

          {/* 알림 박스 */}
          <div className="success-banner">
            <span>☑️</span>
            <span>
              {maskPixels
                ? `감지된 영역 (원본 픽셀 기준): [${maskPixels[0]}, ${maskPixels[1]}] ~ [${maskPixels[2]}, ${maskPixels[3]}]`
                : "위 사진에서 변경할 영역을 마우스로 드래그(드래그 앤 드롭)해 보세요!"}
            </span>
          </div>
        </div>

        {/* 우측: 수선 입력 및 완성 결과 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '600', color: '#e2e8f0', marginBottom: '8px' }}>
              가구 수선 요청사항 (Prompt):
            </label>
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="예: 하얀색 소파로 교체"
              className="input-field"
            />
          </div>

          <button
            type="button"
            onClick={handleEditSubmit}
            disabled={editing}
            className="btn btn-coral btn-full"
            style={{ padding: '14px', fontSize: '1rem', fontWeight: '700' }}
          >
            {editing ? "✨ 가구 수선 중... (잠시만 기다려주세요)" : "✨ 수정하기"}
          </button>

          <hr style={{ borderColor: '#334155', margin: '8px 0' }} />

          <div>
            <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#fff', marginBottom: '8px' }}>
              🎉 최신 편집 완료 결과
            </div>
            {editedResultUrl ? (
              <div>
                <div className="success-banner" style={{ marginBottom: '12px' }}>
                  <span>☑️</span>
                  <span>부분 가구 교체가 완료되었습니다! 원본 구조는 100% 보존되었습니다.</span>
                </div>
                {/* 요구사항 7번 준수: Before / After 좌우 비교 뷰 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <div style={{ fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '4px', fontWeight: '600', textAlign: 'center' }}>
                      🖼️ Before (원본 사진)
                    </div>
                    <div className="preview-box" style={{ height: '220px', border: '1px solid #475569' }}>
                      <img src={fullOrigUrl} alt="Before 원본" className="preview-img" />
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.85rem', color: '#f43f5e', marginBottom: '4px', fontWeight: '600', textAlign: 'center' }}>
                      ✨ After (가구 교체 완료)
                    </div>
                    <div className="preview-box" style={{ height: '220px', border: '2px solid #f43f5e' }}>
                      <img src={getFullUrl(editedResultUrl)} alt="After 부분 수정 결과" className="preview-img" />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ padding: '24px', background: '#0f172a', borderRadius: '10px', textAlign: 'center', color: '#64748b' }}>
                아직 수선된 결과가 없습니다. 좌측에 영역을 잡고 [✨ 수정하기] 버튼을 눌러주세요.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
