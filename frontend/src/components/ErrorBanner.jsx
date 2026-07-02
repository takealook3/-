// =====================================================================
// [ErrorBanner.jsx: 순수 Vanilla CSS 기반 에러 안내판]
// =====================================================================
import React from 'react';

export default function ErrorBanner({ error, onClose, onRetry }) {
  if (!error) return null;

  const getErrorGuide = (code) => {
    switch (code) {
      case "SERVER_CONNECTION_FAILED":
        return {
          title: "서버 연결 실패",
          cause: "백엔드 API 서버(http://localhost:8000)가 꺼져 있거나 통신이 불가능합니다.",
          solution: "잠시 후 아래 '다시 시도' 버튼을 누르거나 백엔드 서버가 실행 중인지 확인해 주세요."
        };
      case "INVALID_IMAGE_FORMAT":
        return {
          title: "업로드 실패 (잘못된 파일 형식)",
          cause: "지원되지 않는 확장자 파일이거나 손상된 파일입니다.",
          solution: ".jpg, .jpeg, .png 일반 이미지 파일만 고르실 수 있습니다."
        };
      case "UPLOAD_FAILED":
        return {
          title: "업로드 실패",
          cause: "파일 전송 중 백엔드 서버에서 오류가 발생했습니다.",
          solution: "잠시 후 다시 시도해 주세요."
        };
      case "PROMPT_REQUIRED":
        return {
          title: "프롬프트 없음",
          cause: "리모델링 요구사항(프롬프트)을 입력하지 않으셨습니다.",
          solution: "원하시는 인테리어 설명글을 입력란에 적어주세요."
        };
      case "PROCESSING_FAILED":
      case "SERVER_ERROR":
        return {
          title: "이미지 변환 실패",
          cause: "AI 인테리어 변환 처리 중 서버 내부 오류가 발생했습니다.",
          solution: "다른 스타일이나 프롬프트로 수정 후 다시 시도해 주세요."
        };
      case "RESULT_NOT_FOUND":
        return {
          title: "결과 이미지 없음",
          cause: "서버에서 변환된 결과 파일을 찾을 수 없습니다.",
          solution: "새로 변환을 실행해 주세요."
        };
      case "SESSION_NOT_FOUND":
      case "SESSION_FETCH_FAILED":
        return {
          title: "세션 조회 실패",
          cause: "요청하신 세션 ID의 기록이 존재하지 않습니다.",
          solution: "사진을 새로 업로드하여 새 세션을 생성해 주세요."
        };
      default:
        return {
          title: `오류 발생 (${code || "알 수 없음"})`,
          cause: error.message || "요청 처리 중 오류가 발생했습니다.",
          solution: "잠시 후 다시 시도해 주세요."
        };
    }
  };

  const guide = getErrorGuide(error.errorCode);

  return (
    <div className="error-banner">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <strong style={{ fontSize: '1.05rem', color: '#f87171' }}>🚨 {guide.title} [{error.errorCode}]</strong>
        {onClose && (
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
        )}
      </div>
      <p style={{ marginBottom: '6px' }}><strong>💡 원인:</strong> {guide.cause}</p>
      {error.message && error.message !== guide.cause && (
        <p style={{ fontSize: '0.85rem', color: '#fca5a5', marginBottom: '6px', fontFamily: 'monospace' }}>상세 메시지: {error.message}</p>
      )}
      <p style={{ color: '#a5b4fc', marginBottom: '12px' }}><strong>🛠️ 해결 방법:</strong> {guide.solution}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
          🔄 다시 시도
        </button>
      )}
    </div>
  );
}
