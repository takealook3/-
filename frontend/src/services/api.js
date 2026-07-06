// =====================================================================
// [API 통신 배달원 모듈]
// 비유: 프론트엔드 홀과 백엔드 주방(8000번 포트) 사이를 오가며
// 주문(API 요청)을 전달하고 결과(응답 JSON)를 받아오는 우직한 배달원입니다.
// =====================================================================

export const API_BASE_URL = "http://localhost:8000";

/**
 * 1번 창구: 서버 상태 확인 (GET /health)
 */
export async function checkHealth() {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    if (!response.ok) {
      throw new Error(`HTTP 에러: ${response.status}`);
    }
    const data = await response.json();
    return { online: true, data };
  } catch (error) {
    return { online: false, error: error.message };
  }
}

/**
 * 2번 창구: 이미지 업로드 (POST /api/images/upload)
 * @param {File} file - 업로드할 이미지 파일 객체
 * @param {string|null} sessionId - 기존 세션 ID (없으면 자동 생성됨)
 */
export async function uploadImage(file, sessionId = null) {
  try {
    const formData = new FormData();
    // 백엔드 파라미터명 규격: image
    formData.append("image", file);
    if (sessionId) {
      formData.append("session_id", sessionId);
    }

    const response = await fetch(`${API_BASE_URL}/api/images/upload`, {
      method: "POST",
      body: formData,
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      return {
        success: false,
        errorCode: data.error_code || "UPLOAD_FAILED",
        message: data.message || "이미지 업로드 중 오류가 발생했습니다."
      };
    }
    return data;
  } catch (error) {
    return {
      success: false,
      errorCode: "SERVER_CONNECTION_FAILED",
      message: `서버 통신 실패: ${error.message}`
    };
  }
}

/**
 * 3번 창구: 인테리어 이미지 변환 실행 (POST /api/image/generate)
 */
export async function generateInteriorImage({ imageId, sessionId, style = "modern", prompt = "", mode = "style_transform" }) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/image/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        image_id: imageId,
        session_id: sessionId,
        style: style,
        prompt: prompt,
        mode: mode
      }),
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      return {
        success: false,
        errorCode: data.error_code || "PROCESSING_FAILED",
        message: data.message || "이미지 변환 중 오류가 발생했습니다."
      };
    }
    return data;
  } catch (error) {
    return {
      success: false,
      errorCode: "SERVER_CONNECTION_FAILED",
      message: `서버 통신 실패: ${error.message}`
    };
  }
}

/**
 * 8번 창구: 세션별 활동 내역 조회 (GET /api/sessions/{session_id})
 */
export async function getSessionHistory(sessionId) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}`);
    const data = await response.json();
    if (!response.ok || !data.success) {
      return {
        success: false,
        errorCode: data.error_code || "SESSION_NOT_FOUND",
        message: data.message || "세션 기록을 불러오지 못했습니다."
      };
    }
    return data;
  } catch (error) {
    return {
      success: false,
      errorCode: "SERVER_CONNECTION_FAILED",
      message: `서버 통신 실패: ${error.message}`
    };
  }
}

/**
 * 7번 창구: 부분 가구 수선 및 편집 (POST /api/image/edit)
 * 비유: 사진에서 특정 침대나 소파 영역만 마우스로 칠해서 새 가구로 교체해 달라고 요청합니다.
 */
export async function editImage({ imageId, sessionId, mask = null, selectedObject = null, prompt = "하얀색 소파로 교체" }) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/image/edit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        image_id: imageId,
        session_id: sessionId,
        mask: mask,
        selected_object: selectedObject,
        prompt: prompt
      }),
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      return {
        success: false,
        errorCode: data.error_code || "PROCESSING_FAILED",
        message: data.message || "부분 편집 수선 처리 중 오류가 발생했습니다."
      };
    }
    return data;
  } catch (error) {
    return {
      success: false,
      errorCode: "SERVER_CONNECTION_FAILED",
      message: `서버 통신 실패: ${error.message}`
    };
  }
}

/**
 * 9번 창구: 부분 가구 교체 및 수선 인페인팅 (POST /api/image/inpaint)
 * 비유: 선택한 영역(bbox 또는 mask) 내 가구만 지정한 프롬프트대로 교체해 줍니다.
 */
export async function inpaintImage({ imageId, sessionId, prompt = "하얀색 소파로 교체", mask = null, bbox = null, mode = "inpainting" }) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/image/inpaint`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        image_id: imageId,
        session_id: sessionId,
        prompt: prompt,
        mask: mask,
        bbox: bbox,
        mode: mode
      }),
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      return {
        success: false,
        errorCode: data.error_code || "INPAINTING_FAILED",
        message: data.message || "부분 가구 수정 중 오류가 발생했습니다."
      };
    }
    return data;
  } catch (error) {
    return {
      success: false,
      errorCode: "SERVER_CONNECTION_FAILED",
      message: `서버 통신 실패: ${error.message}`
    };
  }
}


/**
 * 6번 창구: AI 인테리어 취향 & 추구미 상담 챗봇 호출 (POST /api/chat)
 * 비유: 내 공간에 어울리는 스타일이나 가구 컬러, 취향 상담 지시서를 AI 스타일리스트에게 전달합니다.
 */
export async function sendChatMessage({ sessionId, question }) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        session_id: sessionId || "session_default",
        question: question
      }),
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      return {
        success: false,
        errorCode: data.error_code || "CHAT_FAILED",
        message: data.message || "AI 취향 상담 답변을 가져오는 데 실패했습니다."
      };
    }
    return data;
  } catch (error) {
    return {
      success: false,
      errorCode: "SERVER_CONNECTION_FAILED",
      message: `서버 통신 실패: ${error.message}`
    };
  }
}
