// =====================================================================
// [App.jsx: Streamlit 100% 동기화 + 부분 수선 Inpainting 통합 지휘관]
// =====================================================================
import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import ErrorBanner from './components/ErrorBanner';
import ImageUploader from './components/ImageUploader';
import StyleSelector from './components/StyleSelector';
import ImageEditor from './components/ImageEditor';
import ComparisonGallery from './components/ComparisonGallery';
import SessionModal from './components/SessionModal';
import { checkHealth } from './services/api';

export default function App() {
  const [serverStatus, setServerStatus] = useState({ loading: true, online: false, error: null });
  
  const [imageId, setImageId] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [originalImageUrl, setOriginalImageUrl] = useState(null);
  const [resultData, setResultData] = useState(null);

  const [currentError, setCurrentError] = useState(null);
  const [showSessionModal, setShowSessionModal] = useState(false);

  const verifyServerHealth = useCallback(async () => {
    setServerStatus(prev => ({ ...prev, loading: true }));
    const res = await checkHealth();
    
    if (res.online) {
      setServerStatus({ loading: false, online: true, error: null });
      setCurrentError(prev => prev?.errorCode === "SERVER_CONNECTION_FAILED" ? null : prev);
    } else {
      setServerStatus({ loading: false, online: false, error: res.error });
      setCurrentError({
        errorCode: "SERVER_CONNECTION_FAILED",
        message: res.error
      });
    }
  }, []);

  useEffect(() => {
    verifyServerHealth();
  }, [verifyServerHealth]);

  const handleUploadSuccess = (data) => {
    setImageId(data.imageId);
    setSessionId(data.sessionId);
    setOriginalImageUrl(data.originalImageUrl);
    setResultData(null);
    setCurrentError(null);
  };

  const handleGenerateSuccess = (data) => {
    setResultData(data);
    setCurrentError(null);
  };

  return (
    <div className="app-layout">
      {/* 1. 좌측 사이드바 */}
      <Sidebar
        serverStatus={serverStatus}
        onRefreshHealth={verifyServerHealth}
        sessionId={sessionId}
        onOpenSessionModal={() => setShowSessionModal(true)}
      />

      {/* 2. 우측 메인 작업 영역 */}
      <main className="main-content">
        
        {/* 타이틀 영역 */}
        <div className="main-header">
          <h1 className="main-title">🏠 ZipPT Interior Transform MVP</h1>
          <p className="main-subtitle">
            거실, 방, 침실 사진을 업로드하여 <strong>전면 리모델링(스타일 변환)</strong>을 하거나, 
            마우스 드래그로 <strong>특정 가구만 선택 교체(부분 수선)</strong>할 수 있는 AI 인테리어 스튜디오입니다.
          </p>
        </div>

        {/* 에러 안내판 */}
        <ErrorBanner
          error={currentError}
          onClose={() => setCurrentError(null)}
          onRetry={currentError?.errorCode === "SERVER_CONNECTION_FAILED" ? verifyServerHealth : null}
        />

        {/* 1단계: 인테리어 사진 업로더 */}
        <ImageUploader
          imageId={imageId}
          sessionId={sessionId}
          originalImageUrl={originalImageUrl}
          onUploadSuccess={handleUploadSuccess}
          onError={setCurrentError}
        />

        {/* 2단계: 스타일 및 프롬프트 설정 (사진 등록 후 노출) */}
        <StyleSelector
          imageId={imageId}
          sessionId={sessionId}
          onGenerateSuccess={handleGenerateSuccess}
          onError={setCurrentError}
        />

        {/* 3단계: 부분 가구 교체 및 수선 - Image Inpainting (사진 등록 후 노출) */}
        <ImageEditor
          imageId={imageId}
          sessionId={sessionId}
          originalImageUrl={originalImageUrl}
          onError={setCurrentError}
        />

        {/* 4단계: Before / After 비교 쇼룸 */}
        <ComparisonGallery
          originalImageUrl={originalImageUrl}
          resultData={resultData}
          onError={setCurrentError}
        />

        {/* 하단 카피라이트 */}
        <footer style={{ borderTop: '1px solid #334155', paddingTop: '20px', textAlign: 'center', fontSize: '0.8rem', color: '#64748b' }}>
          ZipPT Interior Transform React MVP &copy; 2026
        </footer>
      </main>

      {/* 세션 장부 모달 */}
      {showSessionModal && (
        <SessionModal
          sessionId={sessionId}
          onClose={() => setShowSessionModal(false)}
        />
      )}
    </div>
  );
}
