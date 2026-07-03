// =====================================================================
// [ImageEditor.jsx: 1/2차 원형 마스킹 (Circle Double Inpainting) 통합 편집소]
// 비유: 사진 속에서 바꾸고 싶은 가구 영역들을 각각 블루(A)와 핑크(B) 원형 스티커로
// 동그랗게 지정하여 흑백 이미지 파일로 개별 캔버스 추출한 뒤, 백엔드로 송신하여 
// 1차 단독 혹은 2차 동시 수선을 의뢰하는 프리미엄 편집 컴포넌트입니다.
// =====================================================================
import React, { useState, useRef } from 'react';
import { editImage, searchProducts, API_BASE_URL } from '../services/api';

export default function ImageEditor({ imageId, sessionId, originalImageUrl, onError }) {
  // 마스크 모드: 'A' (1차 가구 수선) 또는 'B' (2차 가구 수선)
  const [maskMode, setMaskMode] = useState('A');

  // 드래그 원형 마스킹 좌표 (A 영역 - 네온 블루)
  const [bboxNormA, setBboxNormA] = useState(null); // { x1, y1, x2, y2 }
  const [maskPixelsA, setMaskPixelsA] = useState(null); // [x1, y1, x2, y2]

  // 드래그 원형 마스킹 좌표 (B 영역 - 네온 핑크)
  const [bboxNormB, setBboxNormB] = useState(null); // { x1, y1, x2, y2 }
  const [maskPixelsB, setMaskPixelsB] = useState(null); // [x1, y1, x2, y2]

  // 마우스 드래그 상태
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  // 드래그 중 현재 좌표를 ref로 추적 (mouseUp에서 최신값 동기적으로 읽기 위함)
  const dragCurrentRef = useRef({ x: 0, y: 0 });

  // 1차/2차 수선 프롬프트
  const [promptA, setPromptA] = useState("현대적이고 고급스러운 가죽 소파");
  const [promptB, setPromptB] = useState("아늑한 우드 사이드 테이블");

  const [editing, setEditing] = useState(false);
  const [editedResultUrl, setEditedResultUrl] = useState(null);

  // 유사 가구 검색 상태 변수
  const [searchingProducts, setSearchingProducts] = useState(false);
  const [productsList, setProductsList] = useState([]);

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

    // ref에도 동기적으로 저장 (mouseUp에서 최신 좌표를 즉시 읽기 위함)
    dragCurrentRef.current = { x: currentX, y: currentY };

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

  // 마우스 클릭 종료 (정밀 픽셀 좌표 바인딩)
  const handleMouseUp = (e) => {
    if (!isDragging) return;
    setIsDragging(false);

    if (!containerRef.current || !imgRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    // React state 비동기 갱신 대신 ref에서 최신 좌표를 즉시 동기적으로 읽음
    const currentX = dragCurrentRef.current.x;
    const currentY = dragCurrentRef.current.y;

    const x1Norm = Math.min(dragStart.x, currentX) / rect.width;
    const y1Norm = Math.min(dragStart.y, currentY) / rect.height;
    const x2Norm = Math.max(dragStart.x, currentX) / rect.width;
    const y2Norm = Math.max(dragStart.y, currentY) / rect.height;

    const finalCoords = { x1: x1Norm, y1: y1Norm, x2: x2Norm, y2: y2Norm };

    const natW = imgRef.current.naturalWidth || 800;
    const natH = imgRef.current.naturalHeight || 600;
    const px1 = Math.round(x1Norm * natW);
    const py1 = Math.round(y1Norm * natH);
    const px2 = Math.round(x2Norm * natW);
    const py2 = Math.round(y2Norm * natH);

    if (maskMode === 'A') {
      setBboxNormA(finalCoords);
      setMaskPixelsA([px1, py1, px2, py2]);
    } else {
      setBboxNormB(finalCoords);
      setMaskPixelsB([px1, py1, px2, py2]);
    }
  };
  // 개별 마스크 영역 클리어
  const handleClearActiveMask = () => {
    if (maskMode === 'A') {
      setBboxNormA(null);
      setMaskPixelsA(null);
    } else {
      setBboxNormB(null);
      setMaskPixelsB(null);
    }
  };

  // 전체 마스크 영역 클리어
  const handleClearAll = () => {
    setBboxNormA(null);
    setMaskPixelsA(null);
    setBboxNormB(null);
    setMaskPixelsB(null);
    setEditedResultUrl(null);
    setProductsList([]);
    onError(null);
  };

  // 캔버스 드로잉을 통한 원형 마스크 PNG 추출 헬퍼 함수
  const generateCircularBase64Mask = (bbox, width, height) => {
    if (!bbox) return null;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    
    // 검은색 칠하기
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);
    
    // 흰색 타원 칠하기
    const x = bbox.x1 * width;
    const y = bbox.y1 * height;
    const w = (bbox.x2 - bbox.x1) * width;
    const h = (bbox.y2 - bbox.y1) * height;
    
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    const cx = x + w / 2;
    const cy = y + h / 2;
    const rx = w / 2;
    const ry = h / 2;
    ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
    ctx.fill();
    
    return canvas.toDataURL('image/png');
  };

  // 수선하기 요청 제출
  const handleEditSubmit = async () => {
    if (!promptA.trim()) {
      onError({ errorCode: "PROMPT_REQUIRED", message: "1차 가구 수선 요청사항(Prompt A)을 입력해 주세요." });
      return;
    }
    if (!maskPixelsA) {
      onError({ errorCode: "MASK_REQUIRED", message: "1차 가구 수선 영역(A)을 지정해 주세요 (필수)" });
      return;
    }
    
    onError(null);
    setEditing(true);

    try {
      const natW = imgRef.current.naturalWidth;
      const natH = imgRef.current.naturalHeight;

      // 마스크 1 (A) 원형 캔버스 추출
      const base64MaskA = generateCircularBase64Mask(bboxNormA, natW, natH);
      
      // 마스크 2 (B) 원형 캔버스 추출 (지정된 경우에만)
      const base64MaskB = bboxNormB ? generateCircularBase64Mask(bboxNormB, natW, natH) : null;

      const res = await editImage({
        imageId,
        sessionId,
        mask: base64MaskA,           // ComfyUI 인페인팅용 Base64 PNG 마스크
        mask_b: base64MaskB,
        mask_pixels_a: maskPixelsA,  // mock 폴백용 픽셀 좌표 배열 [x1,y1,x2,y2]
        mask_pixels_b: maskPixelsB ? maskPixelsB : null,
        prompt: promptA.trim(),
        prompt_b: base64MaskB ? promptB.trim() : null
      });

      if (res.success) {
        const eUrl = res.data?.edited_image_url || res.data?.editedImageUrl;
        // 브라우저 캐시 방지를 위해 타임스탬프 쿼리 파라미터 추가
        const cacheBustedUrl = eUrl ? `${eUrl}?t=${Date.now()}` : eUrl;
        setEditedResultUrl(cacheBustedUrl);
      } else {
        onError({ errorCode: res.errorCode || "PROCESSING_FAILED", message: res.message });
      }
    } catch (err) {
      console.error(err);
      onError({ errorCode: "CANVAS_ERROR", message: `마스크 픽셀 캔버스 렌더링 중 오류: ${err.message}` });
    } finally {
      setEditing(false);
    }
  };

  // 유사 가구 쇼핑 정보 검색
  const handleSearchProducts = async () => {
    const activeMaskPixels = maskMode === 'A' ? maskPixelsA : maskPixelsB;
    const activePromptText = maskMode === 'A' ? promptA : promptB;

    if (!activeMaskPixels) {
      onError({ errorCode: "MASK_REQUIRED", message: `캔버스에 검색할 가구 영역(${maskMode === 'A' ? '가구 A' : '가구 B'})을 드래그하여 원형으로 지정해 주세요.` });
      return;
    }
    
    onError(null);
    setSearchingProducts(true);
    setProductsList([]);

    try {
      const res = await searchProducts({
        imageId,
        sessionId,
        maskPixels: activeMaskPixels,
        prompt: activePromptText.trim() // 한글 주석: 사용자가 입력한 가구 스타일 텍스트 전달 추가
      });

      if (res.success) {
        setProductsList(res.data?.products || []);
      } else {
        onError({ errorCode: res.errorCode || "SEARCH_FAILED", message: res.message });
      }
    } catch (err) {
      console.error(err);
      onError({ errorCode: "SEARCH_ERROR", message: `상품 검색 중 장애가 발생했습니다: ${err.message}` });
    } finally {
      setSearchingProducts(false);
    }
  };

  return (
    <div className="card" style={{ border: '1px solid #334155' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div className="card-title" style={{ fontSize: '1.25rem', fontWeight: '800' }}>
          🛠️ 4. AI 가구 영역 부분 교체 (1단계 단독 / 2단계 동시 지원)
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
        마우스 드래그를 이용해 사진 속의 1차 수선 가구(A)와 2차 수선 가구(B) 영역을 각각 <strong>원형(Circle)</strong>으로 지정해 보세요. (2차 수선 영역은 생략 가능합니다.)
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
            boxShadow: maskMode === 'A' ? '0 0 10px rgba(56, 189, 248, 0.25)' : 'none'
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
            boxShadow: maskMode === 'B' ? '0 0 10px rgba(244, 63, 94, 0.25)' : 'none'
          }}
        >
          🔴 2차 가구 수선 (B 영역 설정 - 선택)
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
              border: `2px dashed ${maskMode === 'A' ? '#38bdf8' : '#f43f5e'}`,
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
            {/* 1차 마스크 영역 박스 (블루 원형) */}
            {bboxNormA && (
              <div
                style={{
                  position: 'absolute',
                  left: `${bboxNormA.x1 * 100}%`,
                  top: `${bboxNormA.y1 * 100}%`,
                  width: `${(bboxNormA.x2 - bboxNormA.x1) * 100}%`,
                  height: `${(bboxNormA.y2 - bboxNormA.y1) * 100}%`,
                  border: '3px solid #38bdf8',
                  borderRadius: '50%',
                  background: 'rgba(56, 189, 248, 0.25)',
                  boxShadow: '0 0 8px #38bdf8',
                  pointerEvents: 'none'
                }}
              >
                <span style={{ position: 'absolute', top: '-22px', left: '50%', transform: 'translateX(-50%)', background: '#38bdf8', color: '#0f172a', fontSize: '0.7rem', fontWeight: '800', padding: '1px 5px', borderRadius: '3px', whiteSpace: 'nowrap' }}>
                  가구 A
                </span>
              </div>
            )}
            {/* 2차 마스크 영역 박스 (핑크 원형) */}
            {bboxNormB && (
              <div
                style={{
                  position: 'absolute',
                  left: `${bboxNormB.x1 * 100}%`,
                  top: `${bboxNormB.y1 * 100}%`,
                  width: `${(bboxNormB.x2 - bboxNormB.x1) * 100}%`,
                  height: `${(bboxNormB.y2 - bboxNormB.y1) * 100}%`,
                  border: '3px solid #f43f5e',
                  borderRadius: '50%',
                  background: 'rgba(244, 63, 94, 0.25)',
                  boxShadow: '0 0 8px #f43f5e',
                  pointerEvents: 'none'
                }}
              >
                <span style={{ position: 'absolute', top: '-22px', left: '50%', transform: 'translateX(-50%)', background: '#f43f5e', color: '#fff', fontSize: '0.7rem', fontWeight: '800', padding: '1px 5px', borderRadius: '3px', whiteSpace: 'nowrap' }}>
                  가구 B
                </span>
              </div>
            )}
          </div>

          {/* 도구바 */}
          <div className="toolbar" style={{ marginTop: '10px' }}>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              현재 설정 모드: {maskMode === 'A' ? '🔵 1차 가구 (A)' : '🔴 2차 가구 (B)'}
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
                <div>🔵 <strong>가구 A 원형 영역:</strong> [x: {maskPixelsA[0]}~{maskPixelsA[2]}, y: {maskPixelsA[1]}~{maskPixelsA[3]}] ({promptA})</div>
              ) : (
                <div>🔵 <strong>가구 A 영역:</strong> 캔버스에 마우스를 드래그해 주세요 (필수)</div>
              )}
              {maskPixelsB ? (
                <div style={{ marginTop: '4px' }}>🔴 <strong>가구 B 원형 영역:</strong> [x: {maskPixelsB[0]}~{maskPixelsB[2]}, y: {maskPixelsB[1]}~{maskPixelsB[3]}] ({promptB})</div>
              ) : (
                <div style={{ marginTop: '4px', color: '#64748b' }}>🔴 <strong>가구 B 영역:</strong> 추가 변경 가구가 필요하면 모드 전환 후 영역 지정 (선택)</div>
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
              placeholder="예: 현대적이고 고급스러운 가죽 소파"
              className="input-field"
              style={{ borderColor: '#0284c7' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '700', color: '#f43f5e', marginBottom: '6px', opacity: maskPixelsB ? 1 : 0.5 }}>
              🔴 2차 가구 수선 요청 (Prompt B - 선택):
            </label>
            <input
              type="text"
              value={promptB}
              onChange={(e) => setPromptB(e.target.value)}
              placeholder="예: 아늑한 우드 사이드 테이블"
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
            {editing ? "✨ AI 원형 인페인팅 적용 작업 중... (대기)" : "✨ AI 가구 편집/수선 실행"}
          </button>

          <button
            type="button"
            onClick={handleSearchProducts}
            disabled={searchingProducts || (maskMode === 'A' ? !maskPixelsA : !maskPixelsB)}
            className="btn btn-full"
            style={{ 
              padding: '14px', 
              fontSize: '1rem', 
              fontWeight: '700',
              cursor: (((maskMode === 'A' ? !maskPixelsA : !maskPixelsB) || searchingProducts) ? 'not-allowed' : 'pointer'),
              background: (maskMode === 'A' ? !maskPixelsA : !maskPixelsB) ? '#334155' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              transition: 'all 0.3s',
              boxShadow: (maskMode === 'A' ? maskPixelsA : maskPixelsB) ? '0 4px 12px rgba(16, 185, 129, 0.3)' : 'none',
              marginTop: '4px'
            }}
          >
            {searchingProducts ? "🛍️ AI 유사 가구 정보 수집 중..." : `🛍️ 유사 가구 쇼핑 정보 검색 (${maskMode === 'A' ? '가구 A' : '가구 B'})`}
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
                  <span>가구 교체 결과가 생성되었습니다! 아래에서 합성된 모습을 확인해 보세요.</span>
                </div>
                <div className="preview-box" style={{ height: '240px', border: '2px solid #10b981', position: 'relative', overflow: 'hidden', borderRadius: '8px' }}>
                  <img src={getFullUrl(editedResultUrl)} alt="편집 완료 이미지" className="preview-img" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </div>
                <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                  <a 
                    href={getFullUrl(editedResultUrl)} 
                    download={`ZipPT_Upscaled_Result.jpg`}
                    target="_blank" 
                    rel="noreferrer"
                    className="btn"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '10px 16px',
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      color: '#fff',
                      borderRadius: '6px',
                      textDecoration: 'none',
                      fontSize: '0.85rem',
                      fontWeight: '700',
                      flex: 1,
                      boxShadow: '0 4px 10px rgba(16, 185, 129, 0.25)',
                      textAlign: 'center'
                    }}
                  >
                    💾 1.5배 고화질 이미지 다운로드 (새 창)
                  </a>
                </div>
              </div>
            ) : (
              <div style={{ padding: '30px 24px', background: '#0f172a', borderRadius: '10px', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
                아직 수선된 결과가 없습니다. 좌측 캔버스에 영역을 선택하고 [AI 가구 편집/수선 실행] 버튼을 클릭해 주세요.
              </div>
            )}
          </div>

          {/* 쇼핑 정보 카드 리스트 출력 영역 */}
          {productsList.length > 0 && (
            <div style={{ marginTop: '20px', borderTop: '1px solid #334155', paddingTop: '16px' }}>
              <div style={{ fontSize: '1.05rem', fontWeight: '800', color: '#38bdf8', marginBottom: '12px' }}>
                🛍️ 실시간 매칭 유사 상품 정보 (Gemini 검색)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {productsList.map((item, idx) => (
                  <div 
                    key={idx} 
                    style={{ 
                      display: 'flex', 
                      background: '#1e293b', 
                      borderRadius: '8px', 
                      overflow: 'hidden', 
                      border: '1px solid #334155',
                      padding: '8px',
                      gap: '12px'
                    }}
                  >
                    <img 
                      src={item.image_url} 
                      alt={item.product_name} 
                      style={{ 
                        width: '80px', 
                        height: '80px', 
                        objectFit: 'cover', 
                        borderRadius: '6px',
                        border: '1px solid #475569'
                      }} 
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: 1 }}>
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#f8fafc', lineHeight: '1.2', marginBottom: '4px' }}>
                          {item.product_name}
                        </div>
                        <div style={{ fontSize: '0.9rem', fontWeight: '800', color: '#38bdf8' }}>
                          {item.price}
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                        <span style={{ fontSize: '0.7rem', color: '#94a3b8', background: '#334155', padding: '2px 6px', borderRadius: '4px' }}>
                          유사도 {Math.round(item.similarity * 100)}%
                        </span>
                        <a 
                          href={item.purchase_link} 
                          target="_blank" 
                          rel="noreferrer"
                          style={{ 
                            fontSize: '0.75rem', 
                            fontWeight: '700', 
                            color: '#fff', 
                            background: '#0284c7', 
                            padding: '4px 10px', 
                            borderRadius: '4px',
                            textDecoration: 'none'
                          }}
                        >
                          구매하러 가기 ↗
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
