// ============================================================================
// AI 광학 문자 인식(OCR) 프론트엔드 시각화 스크립트 (ocr.js)
// 비유하자면, 사용자가 제출한 문서 사진을 백엔드의 'AI 속기사'에게 전달하고,
// 받아적은 글자 목록과 형광펜이 칠해진 사진을 예쁘게 정리해 보여주는 비서 역할을 합니다.
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    // 1. 화면의 각 제어 요소들을 변수로 연결합니다.
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const previewSection = document.getElementById('preview-section');
    const ocrImage = document.getElementById('ocr-image');
    const loadingSpinner = document.getElementById('loading-spinner');
    const resultSection = document.getElementById('result-section');
    const ocrSummary = document.getElementById('ocr-summary');
    const ocrItemsContainer = document.getElementById('ocr-items-container');
    const resetBtn = document.getElementById('reset-btn');
    const copyAllBtn = document.getElementById('copy-all-btn');

    // 추출된 텍스트 전체를 기억해 둘 변수 (복사 기능을 위해 보관)
    let extractedTextsList = [];

    // 2. 드래그 앤 드롭 및 파일 클릭 이벤트 처리
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            handleFile(e.dataTransfer.files[0]);
        }
    });

    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
            handleFile(fileInput.files[0]);
        }
    });

    // 리셋 버튼 클릭 시 처음 업로드 화면으로 복귀
    resetBtn.addEventListener('click', () => {
        previewSection.classList.add('hidden');
        resultSection.classList.add('hidden');
        dropZone.parentElement.classList.remove('hidden');
        fileInput.value = '';
        extractedTextsList = [];
    });

    // 전체 텍스트 복사 버튼 클릭 이벤트
    copyAllBtn.addEventListener('click', () => {
        if (extractedTextsList.length === 0) {
            alert('❌ 복사할 텍스트가 없습니다.');
            return;
        }
        // 추출된 텍스트들을 줄바꿈으로 연결하여 클립보드에 복사합니다.
        const allText = extractedTextsList.join('\n');
        navigator.clipboard.writeText(allText).then(() => {
            alert('📋 모든 텍스트가 클립보드에 성공적으로 복사되었습니다!\n원하는 곳에 붙여넣기(Ctrl+V) 해보세요.');
        }).catch(err => {
            alert('❌ 클립보드 복사에 실패했습니다: ' + err);
        });
    });

    // 3. 업로드된 파일을 처리하고 서버(/api/ocr)로 전송하는 함수
    function handleFile(file) {
        // 이미지 파일인지 검사합니다.
        if (!file.type.startsWith('image/')) {
            alert('❌ 이미지 파일(JPG, PNG 등)만 올려주세요!');
            return;
        }

        // 화면 전환: 업로드 창을 숨기고 로딩 스피너와 미리보기 영역을 띄웁니다.
        dropZone.parentElement.classList.add('hidden');
        previewSection.classList.remove('hidden');
        resultSection.classList.add('hidden');
        loadingSpinner.classList.remove('hidden');

        // 사용자가 업로드한 이미지를 브라우저에서 먼저 로컬로 읽어와 보여줍니다.
        const reader = new FileReader();
        reader.onload = (e) => {
            ocrImage.src = e.target.result;
        };
        reader.readAsDataURL(file);

        // 백엔드의 OCR API 창구로 사진을 전송합니다.
        sendToOcrApi(file);
    }

    // 4. FastAPI 백엔드 서버의 /api/ocr 창구로 요청을 보내는 함수
    function sendToOcrApi(file) {
        const formData = new FormData();
        formData.append('file', file);

        fetch('/api/ocr', {
            method: 'POST',
            body: formData
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(errData => {
                    throw new Error(errData.detail || '서버 분석 중 오류가 발생했습니다.');
                });
            }
            return response.json();
        })
        .then(data => {
            loadingSpinner.classList.add('hidden');
            
            // 서버에서 형광 테두리를 그려서 인코딩해 준 Base64 이미지로 교체합니다.
            if (data.image_base64) {
                ocrImage.src = data.image_base64;
            }

            // 하단에 텍스트 추출 결과 렌더링
            renderOcrResults(data.items || [], data.message);
        })
        .catch(error => {
            loadingSpinner.classList.add('hidden');
            alert('❌ 오류 발생: ' + error.message);
        });
    }

    // 5. 추출된 글자 목록을 예쁜 카드 형태로 화면에 출력하는 함수
    function renderOcrResults(items, message) {
        ocrItemsContainer.innerHTML = '';
        extractedTextsList = [];

        if (items.length === 0) {
            ocrSummary.innerHTML = '🤖 사진 속에서 판독 가능한 글자(텍스트)를 찾지 못했습니다.';
            ocrSummary.style.color = '#ffaa00';
            resultSection.classList.remove('hidden');
            return;
        }

        // 안내 메시지 표시
        ocrSummary.innerHTML = message || `✨ 총 <strong>${items.length}개</strong>의 텍스트 영역을 성공적으로 판독했습니다!`;
        ocrSummary.style.color = '#00F0FF';

        // 각 추출 글자를 카드 형태로 나열
        items.forEach((item) => {
            extractedTextsList.push(item.text);

            const cardHtml = `
                <div class="ocr-item-card">
                    <div style="display: flex; align-items: center; gap: 1rem;">
                        <span style="color: #00F0FF; font-weight: 800; font-size: 0.9rem;">#${item.id}</span>
                        <span class="ocr-text">${item.text}</span>
                    </div>
                    <span class="ocr-badge">정확도 ${item.confidence}</span>
                </div>
            `;
            ocrItemsContainer.insertAdjacentHTML('beforeend', cardHtml);
        });

        resultSection.classList.remove('hidden');
    }
});
