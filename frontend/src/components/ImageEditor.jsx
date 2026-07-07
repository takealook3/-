// ==============================================================
// [ImageEditor.jsx: 1/2차 원형 마스킹 (Circle Double Inpainting) 통합 편집소]
// 비유: 사진 속에서 바꾸고 싶은 가구 영역들을 각각 블루(A)와 핑크(B) 원형 스티커로
// 동그랗게 지정하여 흑백 이미지 파일로 개별 캔버스 추출한 뒤, 백엔드로 송신하여 
// 1차 단독 혹은 2차 동시 수선을 의뢰하는 프리미엄 편집 컴포넌트입니다.
// ==============================================================
import React, { useState, useRef } from 'react';
import { editImage, searchProducts, embedCropImage, API_BASE_URL } from '../services/api';

export default function ImageEditor({ 
  imageId, 
  sessionId, 
  originalImageUrl, 
  onGenerateSuccess, 
  onError,
  bboxNormA,
  setBboxNormA,
  maskPixelsA,
  setMaskPixelsA,
  bboxNormB,
  setBboxNormB,
  maskPixelsB,
  setMaskPixelsB,
  onResetImage
}) {
  // 마스크 모드: 'A' (1차 가구 수선) 또는 'B' (2차 가구 수선)
  const [maskMode, setMaskMode] = useState('A');

  // 마우스 드래그 상태
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  // 드래그 중 현재 좌표를 ref로 추적 (mouseUp에서 최신값 동기적으로 읽기 위함)
  const dragCurrentRef = useRef({ x: 0, y: 0 });

  // 1차/2차 수선 프롬프트 복원
  const [promptA, setPromptA] = useState("");
  const [promptB, setPromptB] = useState("");
  const [editing, setEditing] = useState(false);
  const [editedResultUrl, setEditedResultUrl] = useState(null);

  // 유사 가구 검색 상태 변수
  const [searchingProducts, setSearchingProducts] = useState(false);
  const [productsListA, setProductsListA] = useState([]);
  const [productsListB, setProductsListB] = useState([]);

  // 🎨 [산디과 코딩 가이드 - 실시간 CLIP 임베딩 상태 등록]
  // 비유: 드래그가 끝난 소파나 테이블의 512차원 특징값(임베딩)과 추출 진행 상태를 각각 담는 레이어(State)입니다.
  const [embeddingA, setEmbeddingA] = useState(null);
  const [isEmbeddingA, setIsEmbeddingA] = useState(false);
  const [embeddingModelA, setEmbeddingModelA] = useState("");
  const [embeddingStepsA, setEmbeddingStepsA] = useState([]);
  const [embeddingCurrentStepA, setEmbeddingCurrentStepA] = useState("");

  const [embeddingB, setEmbeddingB] = useState(null);
  const [isEmbeddingB, setIsEmbeddingB] = useState(false);
  const [embeddingModelB, setEmbeddingModelB] = useState("");
  const [embeddingStepsB, setEmbeddingStepsB] = useState([]);
  const [embeddingCurrentStepB, setEmbeddingCurrentStepB] = useState("");

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
      setEmbeddingA(null);
    } else {
      setBboxNormB(null);
      setMaskPixelsB(null);
      setEmbeddingB(null);
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

  // 🎨 [산디과 코딩 가이드 - 실시간 CLIP 임베딩 비동기 트리거 함수]
  // 비유: 백엔드 주방에 좌표를 보내 그 영역만 크롭하고, 분석 완료된 임베딩(특징벡터)을 받아오는 비동기 주문 작업입니다.
  const triggerClipEmbedding = async (mode, pixels) => {
    if (!imageId || !pixels || pixels.length !== 4) return;
    
    let setSteps, setCurrentStep, setIsEmbedding, setEmbedding, setModel;
    if (mode === 'A') {
      setSteps = setEmbeddingStepsA;
      setCurrentStep = setEmbeddingCurrentStepA;
      setIsEmbedding = setIsEmbeddingA;
      setEmbedding = setEmbeddingA;
      setModel = setEmbeddingModelA;
    } else {
      setSteps = setEmbeddingStepsB;
      setCurrentStep = setEmbeddingCurrentStepB;
      setIsEmbedding = setIsEmbeddingB;
      setEmbedding = setEmbeddingB;
      setModel = setEmbeddingModelB;
    }

    setIsEmbedding(true);
    setEmbedding(null);
    setModel("");
    setSteps([]);
    setCurrentStep("1. 드래그 영역 좌표 획득 완료 (분석 개시)");

    // 실시간 진행 단계 가상 시뮬레이션 (유저 편의성 극대화)
    const stepMessages = [
      "1. 드래그 영역 좌표 획득 완료 (분석 개시)",
      "2. 지정 영역 이미지 크롭(Crop) 수행 중...",
      "3. 인코더 입력을 위한 크기 조정(224x224) 및 텐서 변환 중...",
      "4. CLIP 심층 신경망을 활용한 다차원 이미지 특징 분석 중..."
    ];

    let messageIdx = 0;
    const intervalId = setInterval(() => {
      if (messageIdx < stepMessages.length - 1) {
        messageIdx++;
        setCurrentStep(stepMessages[messageIdx]);
      }
    }, 300);

    try {
      const res = await embedCropImage({
        imageId,
        maskPixels: pixels
      });
      
      clearInterval(intervalId);

      if (res.success && res.data?.embedding) {
        console.log(`🧠 [CLIP Embedding ${mode}] 추출 성공 (차원: ${res.data.dimension})`, res.data.embedding);
        
        const backendSteps = res.data.status_steps || [];
        setSteps(backendSteps);
        setModel(res.data.model_name || "openai/clip-vit-base-patch32 (오리지널 CLIP)");
        setCurrentStep(`분석 완료! 사용 모델: ${res.data.model_name || "openai/clip-vit-base-patch32"}`);
        setEmbedding(res.data.embedding);
      } else {
        console.error(`⚠️ [CLIP Embedding ${mode}] 추출 오류:`, res.message);
        setCurrentStep("⚠️ CLIP 분석 에러 발생");
        setSteps([`오류: ${res.message || "추출에 실패했습니다."}`]);
      }
    } catch (err) {
      clearInterval(intervalId);
      console.error(`❌ [CLIP Embedding ${mode}] API 통신 에러:`, err);
      setCurrentStep("❌ API 통신 실패");
      setSteps([`오류: ${err.message}`]);
    } finally {
      setIsEmbedding(false);
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

    const targetPixels = [px1, py1, px2, py2];

    if (maskMode === 'A') {
      setBboxNormA(finalCoords);
      setMaskPixelsA(targetPixels);
      // 드래그 완료 후 즉시 실시간 임베딩 트리거
      triggerClipEmbedding('A', targetPixels);
    } else {
      setBboxNormB(finalCoords);
      setMaskPixelsB(targetPixels);
      // 드래그 완료 후 즉시 실시간 임베딩 트리거
      triggerClipEmbedding('B', targetPixels);
    }
  };

  // 개별 마스크 영역 클리어
  const handleClearActiveMask = () => {
    if (maskMode === 'A') {
      setBboxNormA(null);
      setMaskPixelsA(null);
      setEmbeddingA(null);
      setEmbeddingModelA("");
      setEmbeddingStepsA([]);
      setEmbeddingCurrentStepA("");
      setProductsListA([]);
      setPromptA("");
    } else {
      setBboxNormB(null);
      setMaskPixelsB(null);
      setEmbeddingB(null);
      setEmbeddingModelB("");
      setEmbeddingStepsB([]);
      setEmbeddingCurrentStepB("");
      setProductsListB([]);
      setPromptB("");
    }
  };

  // 전체 마스크 영역 클리어
  const handleClearAll = () => {
    setBboxNormA(null);
    setMaskPixelsA(null);
    setEmbeddingA(null);
    setEmbeddingModelA("");
    setEmbeddingStepsA([]);
    setEmbeddingCurrentStepA("");
    setPromptA("");
    
    setBboxNormB(null);
    setMaskPixelsB(null);
    setEmbeddingB(null);
    setEmbeddingModelB("");
    setEmbeddingStepsB([]);
    setEmbeddingCurrentStepB("");
    setPromptB("");
    
    setEditedResultUrl(null);
    setProductsListA([]);
    setProductsListB([]);
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

  // AI 가구 부분 교체 실행
  const handleEditSubmit = async () => {
    if (!promptA.trim()) {
      onError({ errorCode: "PROMPT_REQUIRED", message: "1차 수선 스타일(Prompt A)을 입력해 주세요." });
      return;
    }
    if (!maskPixelsA) {
      onError({ errorCode: "MASK_REQUIRED", message: "수선할 가구 영역(A)을 마우스 드래그로 먼저 지정해 주세요." });
      return;
    }
    
    onError(null);
    setEditing(true);

    try {
      const natW = imgRef.current.naturalWidth || 800;
      const natH = imgRef.current.naturalHeight || 600;

      // 마스크 1 (A) 렌더링 및 Base64 인코딩
      const base64MaskA = generateCircularBase64Mask(bboxNormA, natW, natH);
      
      // 마스크 2 (B) 렌더링 (선택적)
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
            status: "completed",
            metrics: res.data?.metrics || null // 한글 주석: 부분 인페인팅 정량평가 점수 전달
          });
        }
        
        // 수선 성공 시, 다음 단계 교체를 용이하게 하기 위해 드래그 영역 및 폼 인풋 리셋
        setBboxNormA(null);
        setMaskPixelsA(null);
        setBboxNormB(null);
        setMaskPixelsB(null);
        setPromptA("");
        setPromptB("");
      } else {
        onError({ errorCode: res.errorCode || "PROCESSING_FAILED", message: res.message });
      }
    } catch (err) {
      console.error(err);
      onError({ errorCode: "CANVAS_ERROR", message: `마스크 분석 캔버스 생성 중 오류가 발생했습니다: ${err.message}` });
    } finally {
      setEditing(false);
    }
  };

  // 유사 가구 쇼핑 정보 검색 (A와 B 다중 영역 병렬 검색)
  const handleSearchProducts = async () => {
    if (!maskPixelsA && !maskPixelsB) {
      onError({ errorCode: "MASK_REQUIRED", message: "유사 가구를 검색할 영역(A영역 또는 B영역)을 최소 한 개 이상 드래그하여 원형으로 지정해 주세요." });
      return;
    }
    
    onError(null);
    setSearchingProducts(true);
    setProductsListA([]);
    setProductsListB([]);

    try {
      const promises = [];

      if (maskPixelsA) {
        promises.push((async () => {
          const res = await searchProducts({
            imageId,
            sessionId,
            maskPixels: maskPixelsA,
            prompt: ""
          });
          if (res.success) {
            setProductsListA(res.data?.products || []);
          } else {
            console.warn("A 영역 상품 검색 실패:", res.message);
          }
        })());
      }

      if (maskPixelsB) {
        promises.push((async () => {
          const res = await searchProducts({
            imageId,
            sessionId,
            maskPixels: maskPixelsB,
            prompt: ""
          });
          if (res.success) {
            setProductsListB(res.data?.products || []);
          } else {
            console.warn("B 영역 상품 검색 실패:", res.message);
          }
        })());
      }

      await Promise.all(promises);
    } catch (err) {
      console.error(err);
      onError({ errorCode: "SEARCH_ERROR", message: `상품 검색 중 장애가 발생했습니다: ${err.message}` });
    } finally {
      setSearchingProducts(false);
    }
  };



  return (
    /* 아이폰6 시스템 폰트(Helvetica Neue)를 최상단 카드 컨테이너에 적용 */
    <div className="card" style={{ border: '1px solid var(--border-color)', fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif', padding: '28px' }}>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
      {/* 헤더 영역 - 대제목 제거 및 사진 변경/초기화 버튼 우측 배치 */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            onClick={onResetImage}
            className="btn btn-secondary" 
            style={{ fontSize: '0.8rem', padding: '8px 16px', borderRadius: '20px', fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif', border: '1px solid var(--border-color)', background: '#fff', cursor: 'pointer' }}
          >
            다른 사진 변경
          </button>
          <button 
            onClick={handleClearAll}
            className="btn btn-secondary" 
            style={{ fontSize: '0.8rem', padding: '8px 16px', borderRadius: '20px', fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif', border: '1px solid var(--border-color)', background: '#fff', cursor: 'pointer' }}
          >
            전체 초기화
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.48fr 1fr', gap: '24px', alignItems: 'start' }}>
        {/* /좌측: 순수 마스킹 캔버스 영역 (글씨나 불필요한 컨트롤 제외) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div
            ref={containerRef}
            className="canvas-container"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            style={{ 
              cursor: 'crosshair', 
              position: 'relative',
              borderRadius: '16px',
              border: `2px dashed ${maskMode === 'A' ? '#3B82F6' : '#EC4899'}`,
              overflow: 'hidden',
              boxShadow: '0 12px 36px rgba(0, 0, 0, 0.08)',
              transition: 'border-color 0.3s ease',
              backgroundColor: '#0f172a'
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
            
            {/* 1차 마스크 영역 박스 (디지털 블루 네온 원형) */}
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
                  가구 A (선택됨)
                </span>
              </div>
            )}
            
            {/* 2차 마스크 영역 박스 (로즈 핑크 네온 원형) - 이모지 제거 */}
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
                  가구 B (선택됨)
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 우측: 모든 글씨, 모드 스위처, 양식 및 실행 컨트롤 패널 */}
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


              {/* 수선 영역 탭 스위처 - 파스텔 색상 배경 & 이모지 및 가이드 문구 삭제, 탭 대제목 굵기 복구 (두껍게) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ display: 'block', fontSize: '0.9rem', fontWeight: '700', color: '#7A6C62', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  지정할 가구 선택
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setMaskMode('A')}
                    style={{
                      flex: 1,
                      padding: '10px 6px',
                      borderRadius: '10px',
                      fontWeight: '500',
                      fontSize: '0.8rem',
                      whiteSpace: 'nowrap',
                      cursor: 'pointer',
                      transition: 'all 0.25s cubic-bezier(0.25, 0.8, 0.25, 1)',
                      background: '#e0f2fe',
                      border: `2px solid ${maskMode === 'A' ? '#3B82F6' : 'transparent'}`,
                      color: '#0369a1',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif',
                      boxShadow: maskMode === 'A' ? '0 4px 12px rgba(59, 130, 246, 0.15)' : 'none'
                    }}
                  >
                    1순위: 가구 A 지정
                  </button>
                  <button
                    type="button"
                    onClick={() => setMaskMode('B')}
                    style={{
                      flex: 1,
                      padding: '10px 6px',
                      borderRadius: '10px',
                      fontWeight: '500',
                      fontSize: '0.8rem',
                      whiteSpace: 'nowrap',
                      cursor: 'pointer',
                      transition: 'all 0.25s cubic-bezier(0.25, 0.8, 0.25, 1)',
                      background: '#ffe4e6',
                      border: `2px solid ${maskMode === 'B' ? '#EC4899' : 'transparent'}`,
                      color: '#be185d',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif',
                      boxShadow: maskMode === 'B' ? '0 4px 12px rgba(236, 72, 153, 0.15)' : 'none'
                    }}
                  >
                    2순위: 가구 B 지정 (선택)
                  </button>
                </div>
                {/* 띠 박스 제거 대신 여백을 거의 먹지 않는 초경량 텍스트 정렬로 지우기 기능 유지 */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2px' }}>
                  <button
                    type="button"
                    onClick={handleClearActiveMask}
                    style={{ 
                      fontSize: '0.72rem', 
                      background: 'transparent',
                      border: 'none',
                      color: '#EF4444',
                      textDecoration: 'underline',
                      fontWeight: '400',
                      cursor: 'pointer',
                      padding: 0,
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif'
                    }}
                  >
                    현재 선택 지우기
                  </button>
                </div>
              </div>

              {/* 인풋 영역 A - 교체 스타일 입력 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ 
                  fontSize: '0.82rem', 
                  fontWeight: '700', 
                  color: '#075985', 
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif',
                }}>
                  가구 A 교체 스타일 입력 (필수)
                </label>
                <input
                  type="text"
                  value={promptA}
                  onChange={(e) => setPromptA(e.target.value)}
                  placeholder="교체할 가구 A의 스타일을 입력해 주세요 (예: 모던한 패브릭 소파)"
                  disabled={!maskPixelsA}
                  style={{ 
                    padding: '10px 12px', 
                    fontSize: '0.85rem', 
                    opacity: maskPixelsA ? 1 : 0.6,
                    cursor: maskPixelsA ? 'text' : 'not-allowed',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif',
                    border: `1.5px solid ${maskMode === 'A' ? '#3B82F6' : 'var(--border-color)'}`,
                    borderRadius: '10px',
                    background: maskPixelsA ? '#FFFFFF' : '#F8FAFC',
                    outline: 'none',
                    transition: 'all 0.3s'
                  }}
                />
              </div>

              {/* 인풋 영역 B - 교체 스타일 입력 (선택) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ 
                  fontSize: '0.82rem', 
                  fontWeight: '700', 
                  color: '#9D174D', 
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif',
                  opacity: maskPixelsB ? 1 : 0.6,
                }}>
                  가구 B 교체 스타일 입력 (선택)
                </label>
                <input
                  type="text"
                  value={promptB}
                  onChange={(e) => setPromptB(e.target.value)}
                  placeholder="교체할 가구 B의 스타일을 입력해 주세요 (선택, 예: 원목 협탁)"
                  disabled={!maskPixelsB}
                  style={{ 
                    padding: '10px 12px',
                    fontSize: '0.85rem',
                    opacity: maskPixelsB ? 1 : 0.6,
                    cursor: maskPixelsB ? 'text' : 'not-allowed',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif',
                    border: `1.5px solid ${maskMode === 'B' ? '#EC4899' : 'var(--border-color)'}`,
                    borderRadius: '10px',
                    background: maskPixelsB ? '#FFFFFF' : '#F8FAFC',
                    outline: 'none',
                    transition: 'all 0.3s'
                  }}
                />
              </div>

              {/* 주요 작업 실행 버튼들 - 가구 부분 교체와 유사 검색 배치 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                <button
                  type="button"
                  onClick={handleEditSubmit}
                  disabled={editing || !maskPixelsA}
                  className="btn btn-success btn-full"
                  style={{ 
                    padding: '14px', 
                    fontSize: '0.95rem', 
                    fontWeight: '600', 
                    cursor: (!maskPixelsA || editing) ? 'not-allowed' : 'pointer', 
                    background: (!maskPixelsA || editing) ? '#E2E8F0' : '#10B981', 
                    color: (!maskPixelsA || editing) ? '#94A3B8' : '#FCFAF7', 
                    border: 'none', 
                    borderRadius: '12px', 
                    transition: 'all 0.25s ease', 
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif',
                    boxShadow: !maskPixelsA ? 'none' : '0 6px 18px rgba(16, 185, 129, 0.15)'
                  }}
                  onMouseEnter={(e) => { 
                    if (maskPixelsA && !editing) { 
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 8px 20px rgba(16, 185, 129, 0.25)';
                    }
                  }}
                  onMouseLeave={(e) => { 
                    if (maskPixelsA && !editing) { 
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 6px 18px rgba(16, 185, 129, 0.15)';
                    }
                  }}
                >
                  {editing ? "AI 가구 교체 적용 중..." : "AI 가구 부분 교체 실행"}
                </button>

                <button
                  type="button"
                  onClick={handleSearchProducts}
                  disabled={searchingProducts || (!maskPixelsA && !maskPixelsB)}
                  className="btn btn-primary btn-full"
                  style={{ 
                    padding: '14px', 
                    fontSize: '0.95rem', 
                    fontWeight: '600', 
                    cursor: ((!maskPixelsA && !maskPixelsB) || searchingProducts) ? 'not-allowed' : 'pointer', 
                    background: ((!maskPixelsA && !maskPixelsB) || searchingProducts) ? '#E2E8F0' : 'var(--primary)', 
                    color: ((!maskPixelsA && !maskPixelsB) || searchingProducts) ? '#94A3B8' : '#FCFAF7', 
                    border: 'none', 
                    borderRadius: '12px', 
                    transition: 'all 0.25s ease', 
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif',
                    boxShadow: (!maskPixelsA && !maskPixelsB) ? 'none' : '0 6px 18px rgba(43, 53, 48, 0.12)'
                  }}
                  onMouseEnter={(e) => { 
                    if ((maskPixelsA || maskPixelsB) && !searchingProducts) { 
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 8px 20px rgba(43, 53, 48, 0.2)';
                    }
                  }}
                  onMouseLeave={(e) => { 
                    if ((maskPixelsA || maskPixelsB) && !searchingProducts) { 
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 6px 18px rgba(43, 53, 48, 0.12)';
                    }
                  }}
                >
                  {searchingProducts ? "유사 가구 쇼핑 정보 찾는 중..." : "유사 가구 쇼핑 정보 검색"}
                </button>

                {/* 가구 부분 교체 완료 후 결과 이미지 다운로드 버튼 연동 */}
                {editedResultUrl && (
                  <a 
                    href={editedResultUrl} 
                    download="ZipPT_Repair_Result.jpg"
                    target="_blank" 
                    rel="noreferrer"
                    className="btn btn-primary"
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: '14px', fontSize: '0.9rem', fontWeight: '700', borderRadius: '12px',
                      textDecoration: 'none', fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif',
                      background: 'var(--accent)', color: '#1C1714', border: 'none', transition: 'all 0.25s ease',
                      marginTop: '8px', boxShadow: '0 6px 18px rgba(199, 153, 114, 0.25)'
                    }}
                    onMouseEnter={(e) => { 
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 8px 20px rgba(199, 153, 114, 0.35)';
                    }}
                    onMouseLeave={(e) => { 
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 6px 18px rgba(199, 153, 114, 0.25)';
                    }}
                  >
                    변환된 이미지 다운로드 (새 창)
                  </a>
                )}
              </div>

        </div>  {/* 우측 패널의 닫기 태그 */}
      </div>    {/* 상단 1.25fr 1fr 그리드 레이아웃의 닫기 태그 */}

      {(productsListA.length > 0 || productsListB.length > 0) && (
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '28px', marginTop: '28px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ fontSize: '1.02rem', fontWeight: '700', color: 'var(--text-main)', marginBottom: '4px', fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif' }}>
            실시간 매칭 유사 상품 정보
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            
            {/* A 영역 추천 리스트 */}
            {productsListA.length > 0 && (
              <div style={{ width: '100%' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: '500', color: '#8B7E74', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px', fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif' }}>
                  <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#8B7E74' }}></span>
                  A 영역 매칭 상품
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', width: '100%' }}>
                  {productsListA.map((item, idx) => (
                    <div 
                      key={`A-${idx}`} 
                      onClick={() => item.purchase_link && window.open(item.purchase_link, '_blank')}
                      style={{ 
                        display: 'flex', 
                        flexDirection: 'column',
                        background: '#FFFFFF', 
                        borderRadius: '12px', 
                        border: '1px solid var(--border-color)',
                        padding: '12px',
                        gap: '10px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif',
                        boxSizing: 'border-box',
                        width: '100%',
                        justifyContent: 'space-between',
                        cursor: item.purchase_link ? 'pointer' : 'default',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        if (item.purchase_link) {
                          e.currentTarget.style.transform = 'translateY(-3px)';
                          e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.08)';
                          e.currentTarget.style.borderColor = 'var(--accent)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (item.purchase_link) {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.02)';
                          e.currentTarget.style.borderColor = 'var(--border-color)';
                        }
                      }}
                    >
                      <img 
                        src={item.image_url} 
                        alt={item.product_name} 
                        style={{ 
                          width: '100%', 
                          height: '140px', 
                          objectFit: 'cover', 
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          flexShrink: 0
                        }} 
                      />
                      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '6px' }}>
                        <div>
                          <div style={{ 
                            fontSize: '0.78rem', 
                            fontWeight: '500', 
                            color: 'var(--text-main)', 
                            lineHeight: '1.3', 
                            marginBottom: '4px', 
                            fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif', 
                            textAlign: 'left',
                            display: '-webkit-box',
                            WebkitLineClamp: '2',
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            height: '2.6em'
                          }}>
                            {item.product_name}
                          </div>
                          <div style={{ fontSize: '0.88rem', fontWeight: '700', color: 'var(--accent)', fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif', textAlign: 'left' }}>
                            {item.price}
                          </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                          <span style={{ fontSize: '0.62rem', color: '#1E40AF', background: '#EFF6FF', padding: '2px 6px', borderRadius: '4px', fontWeight: '400', fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif', whiteSpace: 'nowrap' }}>
                            유사도 {Math.round(item.similarity * 100)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* B 영역 추천 리스트 */}
            {productsListB.length > 0 && (
              <div style={{ width: '100%' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: '500', color: '#C7B7AE', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px', fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif' }}>
                  <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#C7B7AE' }}></span>
                  B 영역 매칭 상품
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', width: '100%' }}>
                  {productsListB.map((item, idx) => (
                    <div 
                      key={`B-${idx}`} 
                      onClick={() => item.purchase_link && window.open(item.purchase_link, '_blank')}
                      style={{ 
                        display: 'flex', 
                        flexDirection: 'column',
                        background: '#FFFFFF', 
                        borderRadius: '12px', 
                        border: '1px solid var(--border-color)',
                        padding: '12px',
                        gap: '10px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif',
                        boxSizing: 'border-box',
                        width: '100%',
                        justifyContent: 'space-between',
                        cursor: item.purchase_link ? 'pointer' : 'default',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        if (item.purchase_link) {
                          e.currentTarget.style.transform = 'translateY(-3px)';
                          e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.08)';
                          e.currentTarget.style.borderColor = 'var(--accent)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (item.purchase_link) {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.02)';
                          e.currentTarget.style.borderColor = 'var(--border-color)';
                        }
                      }}
                    >
                      <img 
                        src={item.image_url} 
                        alt={item.product_name} 
                        style={{ 
                          width: '100%', 
                          height: '140px', 
                          objectFit: 'cover', 
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          flexShrink: 0
                        }} 
                      />
                      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '6px' }}>
                        <div>
                          <div style={{ 
                            fontSize: '0.78rem', 
                            fontWeight: '500', 
                            color: 'var(--text-main)', 
                            lineHeight: '1.3', 
                            marginBottom: '4px', 
                            fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif', 
                            textAlign: 'left',
                            display: '-webkit-box',
                            WebkitLineClamp: '2',
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            height: '2.6em'
                          }}>
                            {item.product_name}
                          </div>
                          <div style={{ fontSize: '0.88rem', fontWeight: '700', color: 'var(--accent)', fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif', textAlign: 'left' }}>
                            {item.price}
                          </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                          <span style={{ fontSize: '0.62rem', color: '#1E40AF', background: '#EFF6FF', padding: '2px 6px', borderRadius: '4px', fontWeight: '400', fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif', whiteSpace: 'nowrap' }}>
                            유사도 {Math.round(item.similarity * 100)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
