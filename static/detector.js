// ============================================================================
// AI 객체 탐지 프론트엔드 시각화 스크립트 (detector.js)
// 비유하자면, 서버에서 보내준 좌표 일지(JSON)를 보고 도화지(Canvas) 위에
// 형광 네모 박스를 치고 이름표를 예쁘게 붙여주는 '전문 화가' 역할을 합니다.
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    // 1. 화면의 각 요소들을 제어하기 위해 변수로 연결해 둡니다.
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const previewSection = document.getElementById('preview-section');
    const detectorImage = document.getElementById('detector-image');
    const detectorCanvas = document.getElementById('detector-canvas');
    const loadingSpinner = document.getElementById('loading-spinner');
    const resultSection = document.getElementById('result-section');
    const detectSummary = document.getElementById('detect-summary');
    const detectGrid = document.getElementById('detect-grid');
    const resetBtn = document.getElementById('reset-btn');

    // 탐지 결과를 기억해 둘 변수 (창 크기 조절 시 다시 그리기 위해 보관)
    let currentDetections = [];

    // 물체 종류별로 다채롭게 칠할 사이버펑크 네온 색상 팔레트 목록
    const neonColors = [
        '#FF007F', // 네온 핑크
        '#00DF89', // 네온 민트
        '#007CF0', // 사이버 블루
        '#FFAA00', // 네온 오렌지
        '#7928CA', // 일렉트릭 퍼플
        '#00F0FF', // 시안
        '#FF00E4'  # 마젠타
    ];

    // 2. 드래그 앤 드롭 이벤트 처리 (사진 끌어놓기)
    // HTML <label> 태그 기능 덕분에 클릭 시 브라우저가 기본적으로 파일 창을 100% 확실하게 열어줍니다.

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover'); // 끌어올 때 테두리 활성화
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
        currentDetections = [];
        // 캔버스 깨끗이 지우기
        const ctx = detectorCanvas.getContext('2d');
        ctx.clearRect(0, 0, detectorCanvas.width, detectorCanvas.height);
    });

    // 브라우저 창 크기가 변할 때마다 네모 박스 크기도 화면에 맞게 다시 그리기
    window.addEventListener('resize', () => {
        if (!previewSection.classList.contains('hidden') && currentDetections.length > 0) {
            drawBoundingBoxes(currentDetections);
        }
    });

    // 3. 업로드된 파일을 처리하고 서버(/detect)로 보내는 함수
    function handleFile(file) {
        // 이미지 파일인지 검사
        if (!file.type.startsWith('image/')) {
            alert('❌ 이미지 파일(JPG, PNG 등)만 올려주세요!');
            return;
        }

        // 화면 전환: 업로드 창 숨기고 미리보기 띄우기
        dropZone.parentElement.classList.add('hidden');
        previewSection.classList.remove('hidden');
        resultSection.classList.add('hidden');
        loadingSpinner.classList.remove('hidden');

        // 사진을 화면에 먼저 표시
        const reader = new FileReader();
        reader.onload = (e) => {
            detectorImage.src = e.target.result;
        };
        reader.readAsDataURL(file);

        // 이미지가 로드되는 것을 기다리지 않고 즉시 서버로 분석 요청을 보냅니다.
        sendToDetectApi(file);
    }

    // 4. FastAPI 백엔드 서버의 /detect 창구로 전송하는 함수
    function sendToDetectApi(file) {
        const formData = new FormData();
        formData.append('file', file);

        fetch('/detect', {
            method: 'POST',
            body: formData
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('서버 분석 중 오류가 발생했습니다.');
            }
            return response.json();
        })
        .then(data => {
            loadingSpinner.classList.add('hidden');
            currentDetections = data.detections || [];
            
            // 캔버스 위에 바운딩 박스 그리기
            drawBoundingBoxes(currentDetections);
            
            // 하단에 요약 칩 목록 보여주기
            renderSummaryAndChips(currentDetections);
        })
        .catch(error => {
            loadingSpinner.classList.add('hidden');
            alert('❌ ' + error.message);
        });
    }

    // 5. 캔버스 도화지 위에 바운딩 박스(네모 테두리)와 라벨을 그리는 핵심 함수
    function drawBoundingBoxes(detections) {
        // 사진이 아직 렌더링 중이라면 완료될 때까지 기다렸다가 다시 실행합니다.
        if (!detectorImage.complete || detectorImage.naturalWidth === 0) {
            detectorImage.onload = () => drawBoundingBoxes(detections);
            return;
        }

        const ctx = detectorCanvas.getContext('2d');
        
        // 도화지 크기를 현재 화면에 보이는 사진 크기와 딱 일치시킵니다.
        detectorCanvas.width = detectorImage.clientWidth;
        detectorCanvas.height = detectorImage.clientHeight;

        // 캔버스를 초기화 (이전 그림 지우기)
        ctx.clearRect(0, 0, detectorCanvas.width, detectorCanvas.height);

        if (detections.length === 0) return;

        // 원본 사진 크기 대비 화면에 표시된 사진 크기의 비율(축척)을 계산합니다.
        // 비유: 원본 지도를 50% 축소해서 보고 있다면 좌표도 50% 줄여야 맞습니다.
        const scaleX = detectorImage.clientWidth / detectorImage.naturalWidth;
        const scaleY = detectorImage.clientHeight / detectorImage.naturalHeight;

        // 탐지된 물체들을 하나씩 돌면서 박스를 그립니다.
        detections.forEach((item, index) => {
            const bbox = item.bbox;
            // 축척을 적용한 실제 화면상의 좌표 계산
            const x = bbox.x1 * scaleX;
            const y = bbox.y1 * scaleY;
            const width = (bbox.x2 - bbox.x1) * scaleX;
            const height = (bbox.y2 - bbox.y1) * scaleY;

            // 물체 번호에 따라 색상 돌아가며 선택
            const color = neonColors[index % neonColors.length];

            // --- [1] 네모 테두리 그리기 ---
            ctx.strokeStyle = color;
            ctx.lineWidth = 3;
            ctx.shadowColor = color;
            ctx.shadowBlur = 10; // 네온 빛 번짐 효과
            ctx.strokeRect(x, y, width, height);

            // --- [2] 이름표 배경 스티커 그리기 ---
            const labelText = `${item.class} (${item.confidence})`;
            ctx.font = 'bold 14px Outfit, sans-serif';
            const textWidth = ctx.measureText(labelText).width;
            const labelHeight = 24;

            // 박스 상단에 자리가 부족하면 박스 안쪽에 그립니다.
            const labelY = y < labelHeight ? y : y - labelHeight;

            ctx.fillStyle = color;
            ctx.shadowBlur = 0; // 글자 배경은 번짐 없애기
            ctx.fillRect(x, labelY, textWidth + 12, labelHeight);

            // --- [3] 이름표 텍스트 쓰기 ---
            ctx.fillStyle = '#000000'; // 배경이 밝으므로 검은색 글씨로 선명하게
            ctx.fillText(labelText, x + 6, labelY + 17);
        });
    }

    // 6. 하단에 탐지된 요약 배너와 칩 목록을 생성하는 함수
    function renderSummaryAndChips(detections) {
        detectGrid.innerHTML = '';

        if (detections.length === 0) {
            detectSummary.innerHTML = '🤖 사진 속에서 특별한 감지 대상 물체를 찾지 못했습니다.';
            detectSummary.style.color = '#ffaa00';
            resultSection.classList.remove('hidden');
            return;
        }

        // 총 탐지된 개수 안내
        detectSummary.innerHTML = `✨ AI 탐정(YOLOv8)이 총 <strong>${detections.length}개</strong>의 물체를 성공적으로 찾아냈습니다!`;
        detectSummary.style.color = '#ff80bf';

        // 물체 목록을 예쁜 칩(Chip) 형태로 나열
        detections.forEach((item, index) => {
            const color = neonColors[index % neonColors.length];
            const chipHtml = `
                <div class="detect-chip" style="border-color: ${color}40;">
                    <span class="chip-color-dot" style="background-color: ${color}; color: ${color};"></span>
                    <span>${item.class}</span>
                    <span style="color: ${color}; font-weight: 700;">${item.confidence}</span>
                </div>
            `;
            detectGrid.insertAdjacentHTML('beforeend', chipHtml);
        });

        resultSection.classList.remove('hidden');
    }
});
