// =====================================================================
// [ImageEditor.jsx: 1/2차 원형 마스킹 (Circle Double Inpainting) 통합 편집소]
// 비유: 사진 속에서 바꾸고 싶은 가구 영역들을 각각 블루(A)와 핑크(B) 원형 스티커로
// 동그랗게 지정하여 흑백 이미지 파일로 개별 캔버스 추출한 뒤, 백엔드로 송신하여 
// 1차 단독 혹은 2차 동시 수선을 의뢰하는 프리미엄 편집 컴포넌트입니다.
// =====================================================================
import React, { useState, useRef } from 'react';
import { editImage, searchProducts, API_BASE_URL } from '../services/api';

export default function ImageEditor({ imageId, sessionId, originalImageUrl, onGenerateSuccess, onError }) {
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

  if (!imageId || !originalImageUrl) return null;

  const getFullUrl = (url) => {
    if (!url) return "";
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    return `${API_BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
  };

  const fullOrigUrl = getFullUrl(originalImageUrl);

  // 마우스 클릭 시작
  const handleMouseDown = (e) => {
    if (!imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
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
    if (!isDragging || !imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
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

    if (!imgRef.current) return;

    const rect = imgRef.current.getBoundingClientRect();
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

        if (onGenerateSuccess) {
          onGenerateSuccess({
            resultId: res.data?.result_id || imageId,
            resultImageUrl: getFullUrl(cacheBustedUrl),
            style: "repair",
            prompt: promptA.trim(),
            processingTime: res.data?.processing_time || 0.42,
            status: "completed"
          });
        }
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
        prompt: activePromptText.trim()
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
    <div className="card" style={{ border: '1px solid var(--border-color)', fontFamily: 'Outfit, sans-serif' }}>
      {/* 헤더 영역 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div className="card-title" style={{ fontSize: '1.35rem', fontWeight: '800', fontFamily: 'Outfit, sans-serif', color: 'var(--primary)', margin: 0, letterSpacing: '-0.02em' }}>
          🛠️ AI 가구 부분 교체
        </div>
        <button 
          onClick={handleClearAll}
          className="btn btn-secondary" 
          style={{ fontSize: '0.8rem', padding: '6px 14px', borderRadius: '20px', fontFamily: 'Outfit, sans-serif' }}
        >
          전체 리셋 🗑️
        </button>
      </div>

      {/* 수선 타겟 편집 탭 */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', fontFamily: 'Outfit, sans-serif' }}>
        <button
          type="button"
          onClick={() => setMaskMode('A')}
          style={{
            flex: 1,
            padding: '12px',
            borderRadius: '8px',
            fontWeight: '700',
            fontSize: '0.9rem',
            cursor: 'pointer',
            transition: 'all 0.25s ease',
            background: maskMode === 'A' ? '#8B7E74' : 'var(--bg-card-inner)',
            border: `1.5px solid ${maskMode === 'A' ? '#8B7E74' : 'var(--border-color)'}`,
            color: maskMode === 'A' ? '#FCFAF7' : 'var(--text-muted)',
            fontFamily: 'Outfit, sans-serif',
            boxShadow: maskMode === 'A' ? '0 4px 15px rgba(139, 126, 116, 0.15)' : 'none'
          }}
        >
          🔵 A 영역
        </button>
        <button
          type="button"
          onClick={() => setMaskMode('B')}
          style={{
            flex: 1,
            padding: '12px',
            borderRadius: '8px',
            fontWeight: '700',
            fontSize: '0.9rem',
            cursor: 'pointer',
            transition: 'all 0.25s ease',
            background: maskMode === 'B' ? '#C7B7AE' : 'var(--bg-card-inner)',
            border: `1.5px solid ${maskMode === 'B' ? '#C7B7AE' : 'var(--border-color)'}`,
            color: maskMode === 'B' ? 'var(--primary)' : 'var(--text-muted)',
            fontFamily: 'Outfit, sans-serif',
            boxShadow: maskMode === 'B' ? '0 4px 15px rgba(199, 183, 174, 0.15)' : 'none'
          }}
        >
          🔴 B 영역 (선택)
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '28px', alignItems: 'start' }}>
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
              borderRadius: '12px',
              border: `2px dashed ${maskMode === 'A' ? '#8B7E74' : '#C7B7AE'}`,
              overflow: 'hidden',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.08)'
            }}
          >
            <img
              ref={imgRef}
              src={fullOrigUrl}
              alt="부분 편집 원본"
              className="canvas-img"
              draggable={false}
              style={{ width: '100%', height: 'auto', display: 'block' }}
            />
            {/* 1차 마스크 영역 박스 (토프 브라운 원형) */}
            {bboxNormA && (
              <div
                style={{
                  position: 'absolute',
                  left: `${bboxNormA.x1 * 100}%`,
                  top: `${bboxNormA.y1 * 100}%`,
                  width: `${(bboxNormA.x2 - bboxNormA.x1) * 100}%`,
                  height: `${(bboxNormA.y2 - bboxNormA.y1) * 100}%`,
                  border: '3px solid #8B7E74',
                  borderRadius: '50%',
                  background: 'rgba(139, 126, 116, 0.2)',
                  boxShadow: '0 0 12px #8B7E74',
                  pointerEvents: 'none'
                }}
              >
                <span style={{ position: 'absolute', top: '-22px', left: '50%', transform: 'translateX(-50%)', background: '#8B7E74', color: '#FCFAF7', fontSize: '0.7rem', fontWeight: '800', padding: '1px 6px', borderRadius: '3px', whiteSpace: 'nowrap', fontFamily: 'Outfit, sans-serif' }}>
                  A 영역
                </span>
              </div>
            )}
            {/* 2차 마스크 영역 박스 (베이지 원형) */}
            {bboxNormB && (
              <div
                style={{
                  position: 'absolute',
                  left: `${bboxNormB.x1 * 100}%`,
                  top: `${bboxNormB.y1 * 100}%`,
                  width: `${(bboxNormB.x2 - bboxNormB.x1) * 100}%`,
                  height: `${(bboxNormB.y2 - bboxNormB.y1) * 100}%`,
                  border: '3px solid #C7B7AE',
                  borderRadius: '50%',
                  background: 'rgba(199, 183, 174, 0.2)',
                  boxShadow: '0 0 12px #C7B7AE',
                  pointerEvents: 'none'
                }}
              >
                <span style={{ position: 'absolute', top: '-22px', left: '50%', transform: 'translateX(-50%)', background: '#C7B7AE', color: 'var(--primary)', fontSize: '0.7rem', fontWeight: '800', padding: '1px 6px', borderRadius: '3px', whiteSpace: 'nowrap', fontFamily: 'Outfit, sans-serif' }}>
                  B 영역
                </span>
              </div>
            )}
          </div>

          {/* 도구바 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600', fontFamily: 'Outfit, sans-serif' }}>
              {maskMode === 'A' ? '🔵 A 영역 지정 모드' : '🔴 B 영역 지정 모드'}
            </span>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleClearActiveMask}
              style={{ fontSize: '0.78rem', padding: '6px 12px', borderRadius: '6px', fontFamily: 'Outfit, sans-serif' }}
            >
              선택 영역 지우기 🧹
            </button>
          </div>
        </div>

        {/* 우측: 수선 지시 양식 및 결과 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '8px', fontFamily: 'Outfit, sans-serif' }}>
              🔵 A 영역 교체 스타일 입력:
            </label>
            <input
              type="text"
              value={promptA}
              onChange={(e) => setPromptA(e.target.value)}
              placeholder="예: 현대적이고 고급스러운 가죽 소파"
              className="input-field"
              style={{ padding: '12px 16px', fontSize: '0.9rem', fontFamily: 'Outfit, sans-serif' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '8px', opacity: maskPixelsB ? 1 : 0.6, fontFamily: 'Outfit, sans-serif' }}>
              🔴 B 영역 교체 스타일 입력 (선택):
            </label>
            <input
              type="text"
              value={promptB}
              onChange={(e) => setPromptB(e.target.value)}
              placeholder="예: 아늑한 우드 사이드 테이블"
              className="input-field"
              disabled={!maskPixelsB}
              style={{ 
                padding: '12px 16px',
                fontSize: '0.9rem',
                opacity: maskPixelsB ? 1 : 0.6,
                cursor: maskPixelsB ? 'text' : 'not-allowed',
                fontFamily: 'Outfit, sans-serif'
              }}
            />
          </div>

          {/* 주요 작업 실행 버튼들 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
            <button
              type="button"
              onClick={handleEditSubmit}
              disabled={editing || !maskPixelsA}
              className="btn btn-primary btn-full"
              style={{ 
                padding: '14px', 
                fontSize: '0.95rem', 
                fontWeight: '700',
                cursor: (!maskPixelsA || editing) ? 'not-allowed' : 'pointer',
                background: (!maskPixelsA) ? 'var(--bg-card-inner)' : 'var(--primary)',
                color: (!maskPixelsA) ? 'var(--text-muted)' : '#FCFAF7',
                border: 'none',
                borderRadius: '8px',
                transition: 'all 0.25s ease',
                fontFamily: 'Outfit, sans-serif'
              }}
            >
              {editing ? "✨ AI 부분 교체 적용 중..." : "✨ AI 가구 편집/수선 실행"}
            </button>

            <button
              type="button"
              onClick={handleSearchProducts}
              disabled={searchingProducts || (maskMode === 'A' ? !maskPixelsA : !maskPixelsB)}
              className="btn btn-secondary btn-full"
              style={{ 
                padding: '14px', 
                fontSize: '0.95rem', 
                fontWeight: '700',
                cursor: (((maskMode === 'A' ? !maskPixelsA : !maskPixelsB) || searchingProducts) ? 'not-allowed' : 'pointer'),
                background: (maskMode === 'A' ? !maskPixelsA : !maskPixelsB) ? 'var(--bg-card-inner)' : 'var(--bg-card-inner)',
                color: 'var(--text-main)',
                border: (maskMode === 'A' ? !maskPixelsA : !maskPixelsB) ? '1px solid var(--border-color)' : '1px solid var(--primary)',
                borderRadius: '8px',
                transition: 'all 0.25s ease',
                fontFamily: 'Outfit, sans-serif'
              }}
            >
              {searchingProducts ? "🛍️ 유사 가구 쇼핑 정보 찾는 중..." : `🛍️ 유사 가구 쇼핑 정보 검색`}
            </button>
          </div>

          <hr style={{ borderColor: 'var(--border-color)', margin: '4px 0' }} />

          {/* 쇼핑 정보 카드 리스트 */}
          {productsList.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <div style={{ fontSize: '1.02rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '12px', fontFamily: 'Outfit, sans-serif' }}>
                🛍️ 실시간 매칭 유사 상품 정보
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '250px', overflowY: 'auto', paddingRight: '4px' }}>
                {productsList.map((item, idx) => (
                  <div 
                    key={idx} 
                    style={{ 
                      display: 'flex', 
                      background: 'var(--bg-card-inner)', 
                      borderRadius: '8px', 
                      overflow: 'hidden', 
                      border: '1px solid var(--border-color)',
                      padding: '8px',
                      gap: '12px'
                    }}
                  >
                    <img 
                      src={item.image_url} 
                      alt={item.product_name} 
                      style={{ 
                        width: '72px', 
                        height: '72px', 
                        objectFit: 'cover', 
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)'
                      }} 
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: 1 }}>
                      <div>
                        <div style={{ fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-main)', lineHeight: '1.25', marginBottom: '2px' }}>
                          {item.product_name}
                        </div>
                        <div style={{ fontSize: '0.88rem', fontWeight: '800', color: 'var(--text-main)' }}>
                          {item.price}
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.05)', padding: '2px 6px', borderRadius: '4px' }}>
                          유사도 {Math.round(item.similarity * 100)}%
                        </span>
                        <a 
                          href={item.purchase_link} 
                          target="_blank" 
                          rel="noreferrer"
                          style={{ 
                            fontSize: '0.72rem', 
                            fontWeight: '700', 
                            color: '#fff', 
                            background: 'var(--primary)', 
                            padding: '4px 10px', 
                            borderRadius: '4px',
                            textDecoration: 'none'
                          }}
                        >
                          구매 링크 ↗
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
