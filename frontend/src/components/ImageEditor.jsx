// ==============================================================
// [ImageEditor.jsx: 자동 가구 인식 + 클릭 선택 (Auto-Detect Double Inpainting) 통합 편집소]
// 비유: 사진이 올라오면 AI가 방 안의 모든 가구에 미리 견출지(라벨)를 붙여둡니다.
// 사용자는 드래그할 필요 없이, 바꾸고 싶은 가구의 견출지를 클릭(A: 블루 / B: 핑크)하고
// 원하는 스타일 프롬프트만 입력하면 백엔드로 송신되어 1차 단독 혹은 2차 동시 수선이 진행됩니다.
// ==============================================================
import React, { useState, useRef, useEffect } from 'react';
import { searchProducts, embedCropImage, API_BASE_URL } from '../services/api';

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

  // 🪑 [자동 전체 가구 인식 상태] 탭 진입(이미지 준비) 시 사진 속 모든 가구를 미리 인식해 보관
  // detectedObjects: 인식된 오브젝트 목록 [{id, label, label_ko, confidence, bbox_norm, bbox_px, mask}]
  const [detectedObjects, setDetectedObjects] = useState([]);
  const [detectingAll, setDetectingAll] = useState(false);
  const [detectError, setDetectError] = useState(null);
  // 사용자가 클릭으로 선택한 오브젝트 id (A: 1차 교체 대상 / B: 2차 교체 대상)
  const [selectedIdA, setSelectedIdA] = useState(null);
  const [selectedIdB, setSelectedIdB] = useState(null);

  // 1차/2차 수선 프롬프트 복원
  const [promptA, setPromptA] = useState("");
  const [promptB, setPromptB] = useState("");
  const [editing, setEditing] = useState(false);
  const [editedResultUrl, setEditedResultUrl] = useState(null);
  // 부분 가구 교체 실행 시 스타일 변환과 동일하게 아래에 실시간 진행 상황을 보여주기 위한 상태
  const [editProgress, setEditProgress] = useState('');

  // 유사 가구 검색 상태 변수
  const [searchingProducts, setSearchingProducts] = useState(false);
  const [productsListA, setProductsListA] = useState([]);
  const [productsListB, setProductsListB] = useState([]);

  // 🎨 [산디과 코딩 가이드 - 실시간 CLIP 임베딩 상태 등록]
  // 비유: 클릭으로 선택된 소파나 테이블의 512차원 특징값(임베딩)과 추출 진행 상태를 각각 담는 레이어(State)입니다.
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

  // 선택된 오브젝트 정보를 목록에서 파생 (라벨/마스크/신뢰도 접근용)
  const selectedObjA = detectedObjects.find((o) => o.id === selectedIdA) || null;
  const selectedObjB = detectedObjects.find((o) => o.id === selectedIdB) || null;

  // 🪑 이미지 전체에서 모든 가구/사물을 한 번에 인식 (부분 가구 교체 탭 진입 시 자동 실행)
  const fetchAllObjects = async () => {
    if (!imageId) return;
    setDetectingAll(true);
    setDetectError(null);
    setDetectedObjects([]);
    setSelectedIdA(null);
    setSelectedIdB(null);
    setBboxNormA(null);
    setMaskPixelsA(null);
    setBboxNormB(null);
    setMaskPixelsB(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/image/detect_all_objects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_id: imageId })
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.data?.objects)) {
        setDetectedObjects(data.data.objects);
        if (data.data.objects.length === 0) {
          setDetectError("사진에서 인식된 가구/사물이 없습니다. 다른 사진을 사용해 보세요.");
        }
      } else {
        setDetectError(data.message || "가구 자동 인식에 실패했습니다.");
      }
    } catch (err) {
      console.error("전체 가구 인식 실패:", err);
      setDetectError(`가구 인식 통신 오류: ${err.message}`);
    } finally {
      setDetectingAll(false);
    }
  };

  // 이미지가 준비되면(업로드/변경 시) 즉시 전체 가구 인식을 미리 수행해 둔다
  useEffect(() => {
    fetchAllObjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageId]);

  if (!imageId || !originalImageUrl) return null;

  const getFullUrl = (url) => {
    if (!url) return "";
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    return `${API_BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
  };

  const fullOrigUrl = getFullUrl(originalImageUrl);

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
    setCurrentStep("1. 선택 가구 좌표 획득 완료 (분석 개시)");

    // 실시간 진행 단계 가상 시뮬레이션 (유저 편의성 극대화)
    const stepMessages = [
      "1. 선택 가구 좌표 획득 완료 (분석 개시)",
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

  // 🖱️ 미리 인식된 가구 박스 클릭 시 선택/해제 처리 (현재 활성 모드 A/B 슬롯에 배정)
  const handleSelectObject = (obj) => {
    const pixels = obj.bbox_px;
    const norm = obj.bbox_norm;

    if (maskMode === 'A') {
      // 같은 오브젝트를 다시 클릭하면 선택 해제
      if (selectedIdA === obj.id) {
        setSelectedIdA(null);
        setBboxNormA(null);
        setMaskPixelsA(null);
        setEmbeddingA(null);
        return;
      }
      // B 슬롯에 이미 배정된 오브젝트라면 B에서 해제 후 A로 이동
      if (selectedIdB === obj.id) {
        setSelectedIdB(null);
        setBboxNormB(null);
        setMaskPixelsB(null);
        setEmbeddingB(null);
      }
      setSelectedIdA(obj.id);
      setBboxNormA(norm);
      setMaskPixelsA(pixels);
      // 선택 즉시 실시간 CLIP 임베딩 트리거 (유사 상품 검색 준비)
      triggerClipEmbedding('A', pixels);
    } else {
      if (selectedIdB === obj.id) {
        setSelectedIdB(null);
        setBboxNormB(null);
        setMaskPixelsB(null);
        setEmbeddingB(null);
        return;
      }
      if (selectedIdA === obj.id) {
        setSelectedIdA(null);
        setBboxNormA(null);
        setMaskPixelsA(null);
        setEmbeddingA(null);
      }
      setSelectedIdB(obj.id);
      setBboxNormB(norm);
      setMaskPixelsB(pixels);
      triggerClipEmbedding('B', pixels);
    }
  };

  // 개별 마스크 영역 클리어
  const handleClearActiveMask = () => {
    if (maskMode === 'A') {
      setSelectedIdA(null);
      setBboxNormA(null);
      setMaskPixelsA(null);
      setEmbeddingA(null);
      setEmbeddingModelA("");
      setEmbeddingStepsA([]);
      setEmbeddingCurrentStepA("");
      setProductsListA([]);
      setPromptA("");
    } else {
      setSelectedIdB(null);
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
    setSelectedIdA(null);
    setBboxNormA(null);
    setMaskPixelsA(null);
    setEmbeddingA(null);
    setEmbeddingModelA("");
    setEmbeddingStepsA([]);
    setEmbeddingCurrentStepA("");
    setPromptA("");

    setSelectedIdB(null);
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

  // 캔버스 드로잉을 통한 마스크 PNG 추출 헬퍼 함수 (둥근 사각형 렌더링 고정)
  const generateBase64Mask = (bbox, width, height) => {
    if (!bbox) return null;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    
    // 검은색 칠하기
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);
    
    const x = bbox.x1 * width;
    const y = bbox.y1 * height;
    const w = (bbox.x2 - bbox.x1) * width;
    const h = (bbox.y2 - bbox.y1) * height;
    
    // 둥근 사각형(roundRect) 마스크 칠하기 (모서리 잔재 보존 및 가구 경계 정합 향상)
    ctx.fillStyle = '#ffffff';
    const radius = Math.min(w, h) * 0.12; // 12% 수준의 자연스러운 둥근 라운딩 처리
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(x, y, w, h, radius);
    } else {
      ctx.rect(x, y, w, h);
    }
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
      onError({ errorCode: "MASK_REQUIRED", message: "사진 속 인식된 가구 중 교체할 가구(A)를 클릭하여 먼저 선택해 주세요." });
      return;
    }
    
    onError(null);
    setEditing(true);
    setEditProgress('부분 가구 교체 준비 중...');

    const finishSuccess = (data) => {
      const eUrl = data?.edited_image_url || data?.editedImageUrl;
      // 브라우저 캐시 방지를 위해 타임스탬프 쿼리 파라미터 추가
      const cacheBustedUrl = eUrl ? `${eUrl}?t=${Date.now()}` : eUrl;
      setEditedResultUrl(cacheBustedUrl);

      if (onGenerateSuccess) {
        onGenerateSuccess({
          resultId: data?.result_id || data?.edit_id || imageId,
          resultImageUrl: getFullUrl(cacheBustedUrl),
          style: "repair",
          prompt: promptA.trim(),
          processingTime: data?.processing_time || 0.42,
          status: "completed",
          metrics: data?.metrics || null // 한글 주석: 부분 인페인팅 정량평가 점수 전달
        });
      }

      // 수선 성공 시, 다음 단계 교체를 용이하게 하기 위해 선택 상태 및 폼 인풋 리셋
      setSelectedIdA(null);
      setSelectedIdB(null);
      setBboxNormA(null);
      setMaskPixelsA(null);
      setBboxNormB(null);
      setMaskPixelsB(null);
      setPromptA("");
      setPromptB("");
    };

    try {
      const natW = imgRef.current.naturalWidth || 800;
      const natH = imgRef.current.naturalHeight || 600;

      // 마스크 1 (A): 자동 인식 단계에서 백엔드가 만들어 둔 오브젝트 마스크를 우선 사용하고,
      // 없을 경우(예외 상황) 선택 박스 좌표 기반 사각형 마스크로 자연스럽게 폴백한다.
      const base64MaskA = selectedObjA?.mask || generateBase64Mask(bboxNormA, natW, natH);

      // 마스크 2 (B) 렌더링 (선택적) - 동일하게 자동 인식 마스크 우선
      const base64MaskB = bboxNormB ? (selectedObjB?.mask || generateBase64Mask(bboxNormB, natW, natH)) : null;

      const requestBody = {
        image_id: imageId,
        session_id: sessionId,
        mask: base64MaskA,           // ComfyUI 인페인팅용 Base64 PNG 마스크
        mask_b: base64MaskB,
        mask_pixels_a: maskPixelsA,  // mock 폴백용 픽셀 좌표 배열 [x1,y1,x2,y2]
        mask_pixels_b: maskPixelsB ? maskPixelsB : null,
        selected_object: selectedObjA?.label || null,  // 자동 인식된 가구 클래스명 전달
        prompt: promptA.trim(),
        prompt_b: base64MaskB ? promptB.trim() : null
      };

      // 스타일 변환과 동일하게 실시간 진행 상황(SSE)을 아래에 표시하며 진행
      const response = await fetch(`${API_BASE_URL}/api/image/edit/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok || !response.body) {
        throw new Error(`HTTP 통신 실패 (Status: ${response.status})`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let finished = false;

      while (!finished) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const rawData = line.slice(6).trim();
            if (!rawData) continue;
            const item = JSON.parse(rawData);

            if (item.status === "error") {
              onError({ errorCode: "PROCESSING_FAILED", message: item.message || "가구 교체에 실패했습니다." });
              finished = true;
              break;
            } else if (item.status === "completed" && item.result_data) {
              // result_data가 포함된 completed만 최종 완료로 간주 (ComfyUI 자체 완료 신호와 구분)
              finishSuccess(item.result_data);
              finished = true;
              break;
            } else {
              setEditProgress(item.message || '처리 중...');
            }
          } catch (jsonErr) {
            console.error("SSE JSON Parse Error:", jsonErr);
          }
        }
      }
    } catch (err) {
      console.error(err);
      onError({ errorCode: "CANVAS_ERROR", message: `마스크 분석 또는 통신 중 오류가 발생했습니다: ${err.message}` });
    } finally {
      setEditing(false);
      setEditProgress('');
    }
  };

  // 유사 가구 쇼핑 정보 검색 (A와 B 다중 영역 병렬 검색)
  const handleSearchProducts = async () => {
    if (!maskPixelsA && !maskPixelsB) {
      onError({ errorCode: "MASK_REQUIRED", message: "유사 가구를 검색할 가구(A 또는 B)를 사진에서 최소 한 개 이상 클릭하여 선택해 주세요." });
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
            style={{
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

            {/* 🪑 자동 인식된 전체 가구/사물 박스 오버레이 (클릭으로 A/B 선택) */}
            {/* 백엔드가 큰 가구부터 정렬해 주므로, 뒤에 렌더링되는 작은 박스가 위에 올라와 클릭 가능 */}
            {detectedObjects.map((obj) => {
              const isA = obj.id === selectedIdA;
              const isB = obj.id === selectedIdB;
              const isSelected = isA || isB;
              const color = isA ? '#3B82F6' : isB ? '#EC4899' : 'rgba(255, 255, 255, 0.9)';
              return (
                <div
                  key={obj.id}
                  onClick={() => handleSelectObject(obj)}
                  style={{
                    position: 'absolute',
                    left: `${obj.bbox_norm.x1 * 100}%`,
                    top: `${obj.bbox_norm.y1 * 100}%`,
                    width: `${(obj.bbox_norm.x2 - obj.bbox_norm.x1) * 100}%`,
                    height: `${(obj.bbox_norm.y2 - obj.bbox_norm.y1) * 100}%`,
                    border: isSelected ? `3px solid ${color}` : '2px dashed rgba(255, 255, 255, 0.75)',
                    borderRadius: '10px',
                    background: isA
                      ? 'rgba(59, 130, 246, 0.18)'
                      : isB
                        ? 'rgba(236, 72, 153, 0.18)'
                        : 'rgba(255, 255, 255, 0.04)',
                    boxShadow: isA
                      ? '0 0 16px rgba(59, 130, 246, 0.5)'
                      : isB
                        ? '0 0 16px rgba(236, 72, 153, 0.5)'
                        : 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = maskMode === 'A' ? '#3B82F6' : '#EC4899';
                      e.currentTarget.style.background = maskMode === 'A' ? 'rgba(59, 130, 246, 0.12)' : 'rgba(236, 72, 153, 0.12)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.75)';
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                    }
                  }}
                >
                  <span style={{
                    position: 'absolute', top: '-22px', left: '50%', transform: 'translateX(-50%)',
                    background: isA ? '#3B82F6' : isB ? '#EC4899' : 'rgba(15, 23, 42, 0.85)',
                    color: '#FCFAF7', fontSize: '0.68rem', fontWeight: '700',
                    padding: '2px 8px', borderRadius: '4px', whiteSpace: 'nowrap', pointerEvents: 'none',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif'
                  }}>
                    {isA ? 'A · ' : isB ? 'B · ' : ''}{obj.label_ko || obj.label} {Math.round((obj.confidence || 0) * 100)}%
                  </span>
                </div>
              );
            })}

            {/* 자동 인식 진행 중 오버레이 */}
            {detectingAll && (
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: '12px',
                background: 'rgba(15, 23, 42, 0.55)', backdropFilter: 'blur(2px)'
              }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '50%',
                  border: '3px solid rgba(255,255,255,0.25)', borderTopColor: '#FCFAF7',
                  animation: 'spin 0.9s linear infinite'
                }} />
                <span style={{ color: '#FCFAF7', fontSize: '0.85rem', fontWeight: '600', fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif' }}>
                  AI가 사진 속 가구를 인식하고 있습니다...
                </span>
              </div>
            )}
          </div>

          {/* 인식 결과 요약 및 다시 인식 버튼 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.78rem', color: detectError ? '#EF4444' : '#7A6C62', fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif' }}>
              {detectingAll
                ? '가구 인식 중...'
                : detectError
                  ? detectError
                  : `${detectedObjects.length}개의 가구/사물이 인식되었습니다. 교체할 가구를 클릭해 선택하세요.`}
            </span>
            <button
              type="button"
              onClick={fetchAllObjects}
              disabled={detectingAll}
              style={{
                fontSize: '0.72rem', padding: '5px 12px', borderRadius: '14px', whiteSpace: 'nowrap',
                border: '1px solid var(--border-color)', background: '#fff',
                cursor: detectingAll ? 'not-allowed' : 'pointer', color: '#7A6C62',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif'
              }}
            >
              가구 다시 인식
            </button>
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
                  교체할 가구 선택 (사진에서 클릭)
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
                    1순위: 가구 A {selectedObjA ? `· ${selectedObjA.label_ko || selectedObjA.label}` : '선택'}
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
                    2순위: 가구 B {selectedObjB ? `· ${selectedObjB.label_ko || selectedObjB.label}` : '(선택)'}
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

                {/* 스타일 변환과 동일한 실시간 진행 상황 표시 (부분 가구 교체 실행 시) */}
                {editing && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    background: 'rgba(16, 185, 129, 0.08)',
                    border: '1px solid rgba(16, 185, 129, 0.25)'
                  }}>
                    <div style={{ width: '9px', height: '9px', borderRadius: '50%', backgroundColor: '#10B981', animation: 'pulse 1.2s infinite', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-main)', lineHeight: '1.4' }}>
                      {editProgress || 'AI 엔진 연산을 대기 중입니다.'}
                    </span>
                  </div>
                )}

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
                    href={getFullUrl(editedResultUrl)} 
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
                          {item.purchase_link && (
                            <a 
                              href={item.purchase_link} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              onClick={(e) => e.stopPropagation()} 
                              style={{ 
                                fontSize: '0.6rem', 
                                color: '#1E40AF', 
                                background: '#E0F2FE', 
                                border: '1px solid #BAE6FD',
                                padding: '2px 6px', 
                                borderRadius: '4px', 
                                fontWeight: '600', 
                                textDecoration: 'none',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                transition: 'all 0.2s ease',
                                cursor: 'pointer',
                                fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#0284C7';
                                e.currentTarget.style.color = '#FFFFFF';
                                e.currentTarget.style.borderColor = '#0284C7';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = '#E0F2FE';
                                e.currentTarget.style.color = '#1E40AF';
                                e.currentTarget.style.borderColor = '#BAE6FD';
                              }}
                            >
                              구매 링크 🔗
                            </a>
                          )}
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
                          {item.purchase_link && (
                            <a 
                              href={item.purchase_link} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              onClick={(e) => e.stopPropagation()} 
                              style={{ 
                                fontSize: '0.6rem', 
                                color: '#1E40AF', 
                                background: '#E0F2FE', 
                                border: '1px solid #BAE6FD',
                                padding: '2px 6px', 
                                borderRadius: '4px', 
                                fontWeight: '600', 
                                textDecoration: 'none',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                transition: 'all 0.2s ease',
                                cursor: 'pointer',
                                fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#0284C7';
                                e.currentTarget.style.color = '#FFFFFF';
                                e.currentTarget.style.borderColor = '#0284C7';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = '#E0F2FE';
                                e.currentTarget.style.color = '#1E40AF';
                                e.currentTarget.style.borderColor = '#BAE6FD';
                              }}
                            >
                              구매 링크 🔗
                            </a>
                          )}
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
