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

  // 파일 선택 시 자동으로 업로드 실행
  useEffect(() => {
    if (selectedFile) {
      handleUploadSubmit(selectedFile);
    }
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

  const handleUploadSubmit = async (file) => {
    if (!file) return;
    setUploading(true);
    onError(null);

    const res = await uploadImage(file, sessionId);
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
    <div className="card" style={{ fontFamily: 'Outfit, "Noto Sans KR", sans-serif' }}>
      <div className="card-title" style={{ fontFamily: 'Outfit, "Noto Sans KR", sans-serif', fontSize: '1.35rem', fontWeight: '800', color: 'var(--primary)', letterSpacing: '-0.02em' }}>📸 사진 업로드</div>
      <div className="card-desc" style={{ fontFamily: 'Outfit, "Noto Sans KR", sans-serif', lineHeight: '1.6', opacity: 0.9 }}>거실, 방, 주방 등 스타일을 바꾸고 싶은 공간의 원본 사진을 선택해 주세요. 이미지를 등록하면 자동으로 서버에 업로드됩니다. (지원 형식: JPG, JPEG, PNG)</div>

      {/* Streamlit 동기화: 등록 완료 초록색 알림 띠 */}
      {imageId && (
        <div className="success-banner" style={{ marginBottom: '20px', fontFamily: 'Outfit, "Noto Sans KR", sans-serif' }}>
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

      <div style={{ position: 'relative' }}>
        {!previewUrl ? (
          <label htmlFor="file-upload-input" className="dropzone" style={{ width: '100%', minHeight: '180px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
            {/* 📂 폴더 이모지 제거 */}
            <div style={{ fontWeight: '600', color: '#fff', marginBottom: '6px' }}>클릭하여 공간 사진 업로드</div>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>JPG, JPEG, PNG 이미지 선택</div>
          </label>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
            <div className="preview-box" style={{ height: 'auto', marginBottom: '15px', position: 'relative', width: '100%', maxHeight: '400px', display: 'flex', justifyContent: 'center', background: '#0f172a', borderRadius: '10px' }}>
              <img src={previewUrl} alt="원본 미리보기" style={{ width: '100%', height: 'auto', maxHeight: '400px', objectFit: 'contain', borderRadius: '10px' }} />
              {uploading && (
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.75)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', borderRadius: '10px', color: '#fff' }}>
                  {/* 🚀 로켓 이모지 제거 */}
                  <div style={{ fontWeight: '600' }}>서버 등록 중...</div>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '0 10px' }}>
              {/* 📦 박스 이모지 제거 */}
              <span style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>{selectedFile?.name} ({roundSize(selectedFile?.size)})</span>
              <label htmlFor="file-upload-input" className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                사진 변경
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function roundSize(bytes) {
  if (!bytes) return "0 KB";
  return `${Math.round(bytes / 1024 * 10) / 10} KB`;
}
