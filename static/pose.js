// ============================================================================
// AI 포즈 추정 프론트엔드 제어 스크립트 (pose.js)
// 비유하자면, 서버 진료실에 환자 사진을 접수하고, 의사가 보내준 디지털 뼈대 X-ray와
// 관절 건강 검진표를 브라우저 화면에 보기 좋게 정리해 주는 '전문 차트 간호사' 역할입니다.
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    // 1. 화면 요소 연결
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const previewSection = document.getElementById('preview-section');
    const poseImage = document.getElementById('pose-image');
    const loadingSpinner = document.getElementById('loading-spinner');
    const resultSection = document.getElementById('result-section');
    const poseSummary = document.getElementById('pose-summary');
    const poseContainer = document.getElementById('pose-container');
    const resetBtn = document.getElementById('reset-btn');

    // 2. 드래그 앤 드롭 및 클릭 이벤트 설정
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

    // 리셋 버튼 클릭 시 초기 화면으로 복귀
    resetBtn.addEventListener('click', () => {
        previewSection.classList.add('hidden');
        resultSection.classList.add('hidden');
        dropZone.parentElement.classList.remove('hidden');
        fileInput.value = '';
        poseContainer.innerHTML = '';
    });

    // 3. 업로드된 이미지 파일 처리 및 API 요청
    function handleFile(file) {
        if (!file.type.startsWith('image/')) {
            alert('❌ 이미지 파일(JPG, PNG 등)만 올려주세요!');
            return;
        }

        // 화면 전환: 업로드 창 숨기고 로딩 표시
        dropZone.parentElement.classList.add('hidden');
        previewSection.classList.remove('hidden');
        resultSection.classList.add('hidden');
        loadingSpinner.classList.remove('hidden');

        // 미리보기 먼저 표시
        const reader = new FileReader();
        reader.onload = (e) => {
            poseImage.src = e.target.result;
        };
        reader.readAsDataURL(file);

        // 백엔드 API 호출
        sendToPoseApi(file);
    }

    // 4. FastAPI 백엔드 서버의 /pose 창구로 전송하는 함수
    function sendToPoseApi(file) {
        const formData = new FormData();
        formData.append('file', file);

        fetch('/pose', {
            method: 'POST',
            body: formData
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('포즈 추정 분석 중 오류가 발생했습니다.');
            }
            return response.json();
        })
        .then(data => {
            loadingSpinner.classList.add('hidden');
            
            // 서버에서 그려서 보내준 뼈대 이미지(Base64)로 변경
            if (data.pose_image_base64) {
                poseImage.src = data.pose_image_base64;
            }

            // 하단 관절 데이터 렌더링
            renderPoseResults(data.persons || []);
        })
        .catch(error => {
            loadingSpinner.classList.add('hidden');
            alert('❌ ' + error.message);
        });
    }

    // 5. 탐지된 사람들의 관절 데이터 목록을 예쁜 카드 형태로 그리는 함수
    function renderPoseResults(persons) {
        poseContainer.innerHTML = '';

        if (persons.length === 0) {
            poseSummary.innerHTML = '🤖 사진 속에서 사람을 탐지하지 못했습니다.';
            poseSummary.style.color = '#ffaa00';
            resultSection.classList.remove('hidden');
            return;
        }

        poseSummary.innerHTML = `✨ AI 화가(YOLOv8-Pose)가 총 <strong>${persons.length}명</strong>의 뼈대와 관절을 성공적으로 스캔했습니다!`;
        poseSummary.style.color = '#00F0FF';

        // 사람 수만큼 반복하며 카드 생성
        persons.forEach(person => {
            const card = document.createElement('div');
            card.className = 'person-card';

            const title = document.createElement('div');
            title.className = 'person-title';
            title.innerHTML = `👤 탐지된 사람 #${person.person_index}`;
            card.appendChild(title);

            const grid = document.createElement('div');
            grid.className = 'keypoint-grid';

            // 17개 관절 중 화면에 보이는(visible) 관절만 표시
            let visibleCount = 0;
            person.keypoints.forEach(kp => {
                if (kp.visible) {
                    visibleCount++;
                    const item = document.createElement('div');
                    item.className = 'keypoint-item';
                    item.innerHTML = `
                        <span class="kp-name">${kp.name}</span>
                        <span class="kp-coord">X: ${kp.x}, Y: ${kp.y}</span>
                    `;
                    grid.appendChild(item);
                }
            });

            if (visibleCount === 0) {
                grid.innerHTML = '<p style="color: #888; font-size: 0.9rem;">인식된 관절 좌표가 없습니다.</p>';
            }

            card.appendChild(grid);
            poseContainer.appendChild(card);
        });

        resultSection.classList.remove('hidden');
    }
});
