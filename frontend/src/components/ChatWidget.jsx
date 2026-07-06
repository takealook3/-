// =====================================================================
// [ChatWidget.jsx: AI 인테리어 취향 & 추구미 상담소 메신저 컴포넌트]
// 비유: 내 방의 분위기와 취향을 찰떡같이 파악하고 맞춤 컬러와 가구 스타일링을
// 조언해 주는 1:1 전담 인테리어 스타일리스트 카카오톡 채팅창입니다!
// =====================================================================
import React, { useState, useRef, useEffect } from 'react';
import { sendChatMessage, API_BASE_URL } from '../services/api';

const QUICK_QUESTIONS = [
  "✨ 화사하고 밝은 미니멀 거실에 어울리는 소파 컬러는?",
  "🌿 따뜻한 내추럴 우드 침실을 위한 아늑한 스타일링 팁",
  "🛋️ 북유럽 스타일 공간에 어울리는 조명과 러그 조합 추천",
  "🕶️ 차분하고 도시적인 모던 서재 공간 꾸미는 가이드"
];

export default function ChatWidget({ sessionId, imageId, onGenerateSuccess, onError, pendingPrompt, setPendingPrompt }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      sender: 'ai',
      text: "안녕하세요! 🎨 나만의 인테리어 취향(추구미), 공간별 컬러 조합, 가구 스타일링 팁에 대해 무엇이든 편하게 물어보세요. AI 인테리어 스타일리스트가 맞춤 조언을 드립니다!",
      references: ["ZipPT 5대 인테리어 취향 데이터베이스", "공간 감성 컬러 매칭 가이드"]
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const [activeImageUrl, setActiveImageUrl] = useState(null);

  // 취향 퀴즈 프롬프트 주입 시 자동 전송 및 채팅 위젯 활성화
  useEffect(() => {
    if (pendingPrompt) {
      setIsOpen(true);
      handleSend(pendingPrompt);
      setPendingPrompt('');
    }
  }, [pendingPrompt]);

  // 채팅이 추가될 때마다 자동으로 스크롤을 맨 아래로 이동
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, loading]);

  const getFullUrl = (url) => {
    if (!url) return null;
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    return `${API_BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
  };

  const handleSend = async (questionText) => {
    const q = questionText || input;
    if (!q || !q.trim() || loading) return;

    const userMsg = { sender: 'user', text: q.trim() };
    setMessages((prev) => [...prev, userMsg]);
    if (!questionText) setInput('');
    setLoading(true);
    if (onError) onError(null);

    const res = await sendChatMessage({
      sessionId: sessionId || "session_default",
      question: q.trim(),
      imageId: imageId || null
    });

    setLoading(false);

    if (res.success) {
      const respData = res.data || {};
      const fullImgUrl = getFullUrl(respData.image_url);
      
      setMessages((prev) => [
        ...prev,
        {
          sender: 'ai',
          text: respData.answer || res.message || "답변이 도착했습니다.",
          references: respData.references || [],
          image_url: fullImgUrl
        }
      ]);

      // 만약 이미지 변환 결과 메타데이터가 응답 봉투에 들어있으면 ComparisonGallery 갱신 콜백 발동
      if (respData.result_id && onGenerateSuccess) {
        onGenerateSuccess({
          resultId: respData.result_id,
          resultImageUrl: fullImgUrl,
          style: respData.style,
          prompt: respData.prompt,
          processingTime: respData.processing_time || 0.42,
          status: "completed"
        });
      }
    } else {
      setMessages((prev) => [
        ...prev,
        {
          sender: 'ai',
          text: `⚠️ 죄송합니다. AI 취향 상담 연결 중 오류가 발생했습니다: ${res.message}`,
          isError: true
        }
      ]);
      if (onError) {
        onError({
          errorCode: res.errorCode || "PROCESSING_FAILED",
          message: res.message
        });
      }
    }
  };

  return (
    <>
      {/* 1. [플로팅 아이콘 버튼: 상시 렌더링 및 iOS 감성 작아짐 트랜지션] */}
      <button
        onClick={() => setIsOpen(true)}
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 9999,
          fontFamily: 'Outfit, sans-serif',
          backgroundColor: '#2B3530',
          color: '#FCFAF7',
          border: 'none',
          borderRadius: '50px',
          padding: '14px 26px',
          fontSize: '0.95rem',
          fontWeight: '600',
          cursor: 'pointer',
          boxShadow: '0 8px 24px rgba(43, 53, 48, 0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          opacity: isOpen ? 0 : 1, // 오픈 시 부드럽게 감춤
          transform: isOpen ? 'translateY(15px) scale(0.7)' : 'translateY(0) scale(1)', // 아래로 내려앉으며 작아짐
          visibility: isOpen ? 'hidden' : 'visible',
          pointerEvents: isOpen ? 'none' : 'auto',
          transition: 'transform 0.45s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.35s, visibility 0.45s, background-color 0.25s'
        }}
        onMouseEnter={(e) => { 
          e.currentTarget.style.backgroundColor = '#19201C';
        }}
        onMouseLeave={(e) => { 
          e.currentTarget.style.backgroundColor = '#2B3530';
        }}
      >
        <span style={{ fontSize: '1.2rem' }}>💬</span>
        <span>AI 인테리어 취향 상담</span>
      </button>

      {/* 2. [메신저 대화창 패널: 상시 렌더링 및 iOS 찰진 줌인 팝업 트랜지션] */}
      <div style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 9999,
        fontFamily: 'Outfit, sans-serif',
        width: '380px',
        height: '560px',
        backgroundColor: '#FCFAF7',
        border: '1px solid #CDBCB2',
        borderRadius: '20px',
        borderTopLeftRadius: '30px', /* 완만한 아치형 상단 게이트 */
        borderTopRightRadius: '30px',
        boxShadow: '0 16px 40px rgba(43, 53, 48, 0.12)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        opacity: isOpen ? 1 : 0, // 오픈 시 밝아짐
        transform: isOpen ? 'scale(1) translate3d(0, 0, 0)' : 'scale(0.12) translate3d(120px, 200px, 0)', // 우하단 기점에서 솟구침
        transformOrigin: 'bottom right', // 팝업 출발점을 우측 하단 버튼으로 세팅
        visibility: isOpen ? 'visible' : 'hidden',
        pointerEvents: isOpen ? 'auto' : 'none',
        transition: 'transform 0.48s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.38s cubic-bezier(0.16, 1, 0.3, 1), visibility 0.48s'
      }}>
        {/* 상단 헤더 바 */}
        <div style={{
          backgroundColor: '#2B3530',
          padding: '16px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid #CDBCB2'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.2rem' }}>🎨</span>
            <div>
              <div style={{ fontWeight: '700', fontSize: '0.95rem', color: '#FCFAF7', fontFamily: 'Outfit, sans-serif' }}>AI 취향 & 추구미 스타일리스트</div>
              <div style={{ fontSize: '0.75rem', color: '#C7B7AE' }}>나만의 인테리어 취향 맞춤 상담</div>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#C7B7AE',
              fontSize: '1.2rem',
              cursor: 'pointer',
              padding: '4px',
              transition: 'color 0.2s'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#FCFAF7'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#C7B7AE'; }}
            title="닫기"
          >
            ✕
          </button>
        </div>

        {/* 대화 목록 영역 */}
        <div style={{
          flex: 1,
          padding: '16px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          backgroundColor: '#F3EBE5'
        }}>
          {messages.map((msg, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                width: '100%'
              }}
            >
              <div style={{
                maxWidth: '85%',
                padding: '12px 16px',
                borderRadius: msg.sender === 'user' ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                backgroundColor: msg.sender === 'user' ? '#2B3530' : '#FCFAF7',
                color: msg.sender === 'user' ? '#FCFAF7' : '#2A2825',
                border: msg.sender === 'user' ? 'none' : '1px solid #CDBCB2',
                fontSize: '0.9rem',
                lineHeight: '1.5',
                boxShadow: '0 2px 6px rgba(43, 53, 48, 0.05)'
              }}>
                {msg.text}
              </div>

              {msg.image_url && (
                <div 
                  style={{
                    marginTop: '8px',
                    maxWidth: '85%',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    boxShadow: '0 4px 15px rgba(43, 53, 48, 0.1)',
                    border: '1px solid #CDBCB2',
                    cursor: 'pointer'
                  }}
                  onClick={() => setActiveImageUrl(msg.image_url)}
                  title="클릭하여 크게 보기"
                >
                  <img 
                    src={msg.image_url} 
                    alt="스타일 이미지" 
                    style={{
                      width: '100%',
                      height: 'auto',
                      display: 'block',
                      objectFit: 'cover',
                      transition: 'transform 0.25s ease'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.03)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>
          ))}

            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#7A6C62', fontSize: '0.85rem', paddingLeft: '8px' }}>
                <span>{imageId ? "✨ AI가 인테리어를 분석하고 새 스타일로 변환하는 중입니다..." : "✨ AI 스타일리스트가 공간 정보를 분석하고 있습니다..."}</span>
              </div>
            )}

          <div ref={messagesEndRef} />
        </div>

        {/* 추천 질문 칩 (Quick Chips) 영역 */}
        <div className="quick-chips-container">
          {QUICK_QUESTIONS.map((qText, qIdx) => (
            <button
              key={qIdx}
              onClick={() => handleSend(qText)}
              disabled={loading}
              style={{
                background: '#F3EBE5',
                border: '1px solid #CDBCB2',
                color: '#2A2825',
                padding: '6px 12px',
                borderRadius: '12px',
                fontSize: '0.75rem',
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'all 0.2s ease',
                fontWeight: '500'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#E2D7CF'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#F3EBE5'; }}
            >
              {qText}
            </button>
          ))}
        </div>

        {/* 하단 입력 영역 */}
        <form
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          style={{
            padding: '12px',
            backgroundColor: '#FCFAF7',
            borderTop: '1px solid #CDBCB2',
            display: 'flex',
            gap: '8px'
          }}
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="취향이나 스타일링 팁을 물어보세요..."
            disabled={loading}
            style={{
              flex: 1,
              backgroundColor: '#F3EBE5',
              border: '1px solid #CDBCB2',
              borderRadius: '8px',
              padding: '10px 12px',
              color: '#2A2825',
              fontSize: '0.85rem',
              outline: 'none',
              transition: 'border-color 0.2s'
            }}
            onFocus={(e) => e.target.style.borderColor = '#2B3530'}
            onBlur={(e) => e.target.style.borderColor = '#CDBCB2'}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            style={{
              backgroundColor: loading || !input.trim() ? '#C7B7AE' : '#2B3530',
              color: '#FCFAF7',
              border: 'none',
              borderRadius: '8px',
              padding: '0 18px',
              fontWeight: '600',
              fontSize: '0.85rem',
              cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => { if (!loading && input.trim()) e.currentTarget.style.backgroundColor = '#19201C'; }}
            onMouseLeave={(e) => { if (!loading && input.trim()) e.currentTarget.style.backgroundColor = '#2B3530'; }}
          >
            전송
          </button>
        </form>
      </div>

      {/* 이미지 확대 모달(라이트박스) */}
      {activeImageUrl && (
        <div
          onClick={() => setActiveImageUrl(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(42, 40, 37, 0.8)',
            backdropFilter: 'blur(5px)',
            zIndex: 100000,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            cursor: 'zoom-out'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              maxWidth: '90%',
              maxHeight: '90%',
              borderRadius: '20px',
              overflow: 'hidden',
              boxShadow: '0 24px 48px rgba(43, 53, 48, 0.25)',
              border: '1px solid #CDBCB2',
              backgroundColor: '#FCFAF7'
            }}
          >
            <img
              src={activeImageUrl}
              alt="확대 이미지"
              style={{
                display: 'block',
                maxWidth: '100%',
                maxHeight: '80vh',
                objectFit: 'contain'
              }}
            />
            <button
              onClick={() => setActiveImageUrl(null)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                width: '36px',
                height: '36px',
                borderRadius: '50px',
                backgroundColor: 'rgba(43, 53, 48, 0.6)',
                border: '1px solid #CDBCB2',
                color: 'white',
                fontSize: '1.1rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                boxShadow: '0 4px 6px rgba(0,0,0,0.15)',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#B05B48'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(43, 53, 48, 0.6)'; }}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </>
  );
}
