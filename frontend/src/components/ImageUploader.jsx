// =====================================================================
// [ImageUploader.jsx: Streamlit 100% 동기화 사진 업로더]
// =====================================================================
import React, { useState, useRef, useEffect } from 'react';
import { uploadImage } from '../services/api';

export default function ImageUploader({ 
  imageId, 
  sessionId, 
  originalImageUrl, 
  onUploadSuccess, 
  onError 
}) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [selectedFile]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validExtensions = ['image/jpeg', 'image/jpg', 'image/png'];
    const fileNameLower = file.name.toLowerCase();
    const hasValidExt = fileNameLower.endsWith('.jpg') || fileNameLower.endsWith('.jpeg') || fileNameLower.endsWith('.png');

    if (!validExtensions.includes(file.type) && !hasValidExt) {
      onError({
        errorCode: "INVALID_IMAGE_FORMAT",
        message: "jpg, jpeg, png 형식의 이미지 파일만 업로드할 수 있습니다."
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    onError(null);
    setSelectedFile(file);
  };

  const handleUploadSubmit = async () => {
    if (!selectedFile) return;
    setUploading(true);
    onError(null);

    const res = await uploadImage(selectedFile, sessionId);
    setUploading(false);

    if (res.success) {
      const data = res.data || {};
      onUploadSuccess({
        imageId: data.image_id,
        sessionId: data.session_id,
        originalImageUrl: data.original_image_url
      });
    } else {
      onError({
        errorCode: res.errorCode || "UPLOAD_FAILED",
        message: res.message
      });
    }
  };

  return (
    <div className="card">
      <div className="card-title">📸 1. 변환할 인테리어 사진 업로드</div>
      <div className="card-desc">거실, 방, 주방 등 스타일을 바꾸고 싶은 공간의 원본 사진을 선택해 주세요. (지원 형식: JPG, JPEG, PNG)</div>

      {/* Streamlit 동기화: 등록 완료 초록색 알림 띠 */}
      {imageId && (
        <div className="success-banner" style={{ marginBottom: '20px' }}>
          <span>🎉</span>
          <span><strong>인테리어 사진 등록 완료!</strong> 아래 단계에서 스타일 변환이나 부분 가구 교체를 진행하실 수 있습니다.</span>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".jpg,.jpeg,.png"
        onChange={handleFileChange}
        style={{ display: 'none' }}
        id="file-upload-input"
      />

      <div className="grid-2">
        {/* 좌측: 파일 선택 및 미리보기 */}
        <div>
          {!previewUrl ? (
            <label htmlFor="file-upload-input" className="dropzone">
              <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>📂</div>
              <div style={{ fontWeight: '600', color: '#fff', marginBottom: '6px' }}>클릭하여 공간 사진 업로드</div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>JPG, JPEG, PNG 이미지 선택</div>
            </label>
          ) : (
            <div>
              <div className="preview-box" style={{ marginBottom: '10px' }}>
                <img src={previewUrl} alt="원본 미리보기" className="preview-img" />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>📦 {selectedFile?.name} ({roundSize(selectedFile?.size)})</span>
                <label htmlFor="file-upload-input" className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                  사진 변경
                </label>
              </div>
            </div>
          )}
        </div>

        {/* 우측: 서버 등록 및 ID 정보 표시 */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: '#0f172a', padding: '20px', borderRadius: '12px', border: '1px solid #334155' }}>
          <div>
            <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#fff', marginBottom: '8px' }}>📤 2. 사진 서버 공식 등록</div>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '16px' }}>
              버튼을 눌러 <code>POST /api/images/upload</code>를 호출하고 AI 가공을 위한 고유 ID를 발급받습니다.
            </p>

            {/* Streamlit 파일 선택 성공 알림 */}
            {selectedFile && !imageId && (
              <div className="success-banner">
                <span>📦</span>
                <span>파일 선택됨: {selectedFile.name} ({roundSize(selectedFile.size)})</span>
              </div>
            )}

            {imageId && (
              <div style={{ background: '#1e293b', padding: '16px', borderRadius: '10px', border: '1px solid #4f46e5', marginBottom: '16px' }}>
                <div style={{ fontSize: '0.85rem', color: '#34d399', fontWeight: '600', marginBottom: '10px' }}>🎉 발급 완료 ID 정보</div>
                <div className="grid-2" style={{ gap: '10px' }}>
                  <div className="metric-card">
                    <div className="metric-label">이미지 ID (image_id)</div>
                    <div className="metric-value" style={{ fontSize: '0.95rem', color: '#818cf8' }}>{imageId}</div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-label">세션 ID (session_id)</div>
                    <div className="metric-value" style={{ fontSize: '0.95rem', color: '#e2e8f0' }}>{sessionId}</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleUploadSubmit}
            disabled={!selectedFile || uploading}
            className="btn btn-primary btn-full"
          >
            {uploading ? "🚀 서버 등록 중..." : "🚀 인테리어 사진 등록"}
          </button>
        </div>
      </div>
    </div>
  );
}

function roundSize(bytes) {
  if (!bytes) return "0 KB";
  return `${Math.round(bytes / 1024 * 10) / 10} KB`;
}
