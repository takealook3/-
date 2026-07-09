// =====================================================================
// [ChatWidget.jsx: AI 인테리어 취향 & 추구미 상담소 메신저 컴포넌트]
// 비유: 내 방의 분위기와 취향을 찰떡같이 파악하고 맞춤 컬러와 가구 스타일링을
// 조언해 주는 1:1 전담 인테리어 스타일리스트 카카오톡 채팅창입니다!
// =====================================================================
import React, { useState, useRef, useEffect } from 'react';
import { sendChatMessage, API_BASE_URL } from '../services/api';


export default function ChatWidget({ sessionId, imageId, onError, pendingPrompt, setPendingPrompt }) {
  const [isOpen, setIsOpen] = useState(false);

  // [코너 스냅 배치] 챗봇 위젯은 화면 좌하단/우하단 두 곳에만 붙는다.
  // 자유 배치(dragPos) 대신 코너 상태만 관리 — 드래그 중 포인터가 화면 왼쪽 절반이면 좌하단,
  // 오른쪽 절반이면 우하단으로 실시간 스냅되어 본문 컨텐츠를 가리는 어중간한 위치를 방지한다.
  const [corner, setCorner] = useState('right'); // 'left' | 'right'
  const dragStateRef = useRef({ dragging: false, moved: false, lastX: 0, lastY: 0 });

  const handleDragMove = (e) => {
    if (!dragStateRef.current.dragging) return;
    const dx = e.clientX - dragStateRef.current.lastX;
    const dy = e.clientY - dragStateRef.current.lastY;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) dragStateRef.current.moved = true;
    dragStateRef.current.lastX = e.clientX;
    dragStateRef.current.lastY = e.clientY;
    setCorner(e.clientX < window.innerWidth / 2 ? 'left' : 'right');
  };

  const handleDragEnd = () => {
    dragStateRef.current.dragging = false;
    document.body.style.userSelect = '';
    window.removeEventListener('mousemove', handleDragMove);
    window.removeEventListener('mouseup', handleDragEnd);
  };

  const handleDragStart = (e) => {
    dragStateRef.current = { dragging: true, moved: false, lastX: e.clientX, lastY: e.clientY };
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleDragMove);
    window.addEventListener('mouseup', handleDragEnd);
  };

  useEffect(() => {
    return () => {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
    };
  }, []);
  const [messages, setMessages] = useState([
    {
      sender: 'ai',
      text: "안녕하세요! 🎨 나만의 인테리어 취향(추구미) 분석부터 공간별 자재/벽지 매칭, 시공 매뉴얼 등 다양한 인테리어 공간 정보에 대해 무엇이든 편하게 물어보세요. AI 큐레이터가 친절하게 맞춤 안내를 드립니다!",
      references: ["ZipPT 인테리어 취향 데이터베이스", "공간 자재 및 시공 가이드북"]
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
      imageId: null // 챗봇 창에서는 이미지 변환 프로세스를 유발하지 않도록 명시적 차단
    });

    setLoading(false);

    if (res.success) {
      const respData = res.data || {};
      
      setMessages((prev) => [
        ...prev,
        {
          sender: 'ai',
          text: respData.answer || res.message || "답변이 도착했습니다.",
          references: respData.references || [],
          imageUrl: respData.image_url
        }
      ]);
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
      {/* 카톡 말줄임표 애니메이션을 위한 스타일 [카톡 입력중 스타일] */}
      <style>{`
        @keyframes kakaoDot {
          0% { opacity: 0.3; transform: translateY(0); }
          50% { opacity: 1; transform: translateY(-4px); }
          100% { opacity: 0.3; transform: translateY(0); }
        }
        .kakao-dot {
          width: 6px;
          height: 6px;
          background-color: #7A6C62;
          border-radius: 50%;
          display: inline-block;
          animation: kakaoDot 1.4s infinite both;
        }
        .kakao-dot:nth-child(2) {
          animation-delay: .2s;
        }
        .kakao-dot:nth-child(3) {
          animation-delay: .4s;
        }
      `}</style>
      {/* 1. [플로팅 아이콘 버튼: 텍스트 없는 컴팩트 원형 FAB — 좌하단/우하단 코너 스냅] */}
      <button
        onMouseDown={handleDragStart}
        onClick={() => { if (!dragStateRef.current.moved) setIsOpen(true); }}
        title="AI 취향 & 인테리어 상담 (꾹 눌러 드래그하면 좌/우 하단으로 옮길 수 있어요)"
        aria-label="AI 취향 & 인테리어 정보 상담 열기"
        style={{
          position: 'fixed',
          bottom: '24px',
          ...(corner === 'left' ? { left: '24px' } : { right: '24px' }),
          zIndex: 9999,
          fontFamily: 'Outfit, sans-serif',
          backgroundColor: '#2B3530',
          color: '#FCFAF7',
          border: 'none',
          borderRadius: '50%',
          width: '56px',
          height: '56px',
          padding: 0,
          fontSize: '1.5rem',
          cursor: 'grab',
          boxShadow: '0 8px 24px rgba(43, 53, 48, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: isOpen ? 0 : 1, // 오픈 시 부드럽게 감춤
          transform: isOpen ? 'translateY(15px) scale(0.7)' : 'translateY(0) scale(1)', // 아래로 내려앉으며 작아짐
          visibility: isOpen ? 'hidden' : 'visible',
          pointerEvents: isOpen ? 'none' : 'auto',
          transition: 'transform 0.45s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.35s, visibility 0.45s, background-color 0.25s',
          touchAction: 'none'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#19201C';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = '#2B3530';
        }}
      >
        <span>💬</span>
      </button>

      {/* 2. [메신저 대화창 패널: 상시 렌더링 및 iOS 찰진 줌인 팝업 트랜지션 — 버튼과 같은 코너에 정렬] */}
      <div style={{
        position: 'fixed',
        bottom: '24px',
        ...(corner === 'left' ? { left: '24px' } : { right: '24px' }),
        zIndex: 9999,
        fontFamily: 'Outfit, sans-serif',
        width: '380px',
        maxWidth: 'calc(100vw - 48px)',
        height: '560px',
        maxHeight: 'calc(100vh - 48px)',
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
        transform: isOpen ? 'scale(1)' : 'scale(0.12)', // 코너 기점에서 솟구침
        transformOrigin: corner === 'left' ? 'bottom left' : 'bottom right', // 팝업 출발점 = 코너 버튼 위치
        visibility: isOpen ? 'visible' : 'hidden',
        pointerEvents: isOpen ? 'auto' : 'none',
        transition: 'transform 0.48s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.38s cubic-bezier(0.16, 1, 0.3, 1), visibility 0.48s'
      }}>
        {/* 상단 헤더 바 (꾹 눌러 드래그하면 위젯 전체를 원하는 위치로 옮길 수 있음) */}
        <div
          onMouseDown={handleDragStart}
          title="꾹 눌러서 드래그하면 위치를 옮길 수 있어요"
          style={{
            backgroundColor: '#2B3530',
            padding: '16px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid #CDBCB2',
            cursor: 'grab',
            touchAction: 'none',
            userSelect: 'none'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.2rem' }}>🎨</span>
            <div>
              <div style={{ fontWeight: '700', fontSize: '0.95rem', color: '#FCFAF7', fontFamily: 'Outfit, sans-serif' }}>AI 인테리어 상담</div>
              <div style={{ fontSize: '0.75rem', color: '#C7B7AE' }}>취향 분석 · 자재/시공 가이드</div>
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
              <div 
                style={{
                  maxWidth: '85%',
                  padding: '12px 16px',
                  borderRadius: msg.sender === 'user' ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                  backgroundColor: msg.sender === 'user' ? '#2B3530' : '#FCFAF7',
                  color: msg.sender === 'user' ? '#FCFAF7' : '#2A2825',
                  border: msg.sender === 'user' ? 'none' : '1px solid #CDBCB2',
                  fontSize: '0.9rem',
                  lineHeight: '1.5',
                  boxShadow: '0 2px 6px rgba(43, 53, 48, 0.05)',
                  cursor: 'default',
                  transition: 'all 0.2s ease'
                }}
              >
                {msg.text}
              </div>

              {msg.imageUrl && (
                <div 
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveImageUrl(getFullUrl(msg.imageUrl));
                  }}
                  style={{
                    marginTop: '8px',
                    maxWidth: '85%',
                    borderRadius: '12px',
                    border: '1px solid #CDBCB2',
                    overflow: 'hidden',
                    cursor: 'zoom-in',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                    backgroundColor: '#FCFAF7'
                  }}
                >
                  <img 
                    src={getFullUrl(msg.imageUrl)} 
                    alt="인테리어 추천 스타일 예시" 
                    style={{ width: '100%', maxHeight: '180px', objectFit: 'cover', display: 'block' }}
                  />
                </div>
              )}
            </div>
          ))}

            {loading && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                width: '100%',
                gap: '6px'
              }}>
                {/* 카톡 스타일의 입력 중 말풍선 [카톡 스타일 입력 중 말풍선] */}
                <div style={{
                  maxWidth: '85%',
                  padding: '12px 16px',
                  borderRadius: '16px 16px 16px 2px',
                  backgroundColor: '#FCFAF7',
                  border: '1px solid #CDBCB2',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  boxShadow: '0 2px 6px rgba(43, 53, 48, 0.05)'
                }}>
                  <div className="kakao-dot" />
                  <div className="kakao-dot" />
                  <div className="kakao-dot" />
                </div>
                <span style={{ color: '#7A6C62', fontSize: '0.78rem', paddingLeft: '4px', fontWeight: '500' }}>
                  {imageId ? "AI가 인테리어를 분석하고 새 스타일로 변환하는 중입니다..." : "AI 스타일리스트가 공간 정보를 분석하고 있습니다..."}
                </span>
              </div>
            )}

          <div ref={messagesEndRef} />
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
