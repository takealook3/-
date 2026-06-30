document.addEventListener('DOMContentLoaded', () => {
    // 1. 필요한 HTML 요소들을 자바스크립트로 가져오기 (비유: 각종 창구와 화면을 연결할 스위치 준비)
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const previewSection = document.getElementById('preview-section');
    const previewImage = document.getElementById('preview-image');
    const loadingSpinner = document.getElementById('loading-spinner');
    const resultSection = document.getElementById('result-section');
    const predictionsList = document.getElementById('predictions-list');
    const resetBtn = document.getElementById('reset-btn');

    // 2. 드래그 앤 드롭 이벤트 처리 (마우스로 사진 끌어오기 효과)
    // HTML <label> 태그 기능 덕분에 클릭 시 브라우저가 기본적으로 파일 창을 100% 확실하게 열어줍니다.

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover'); // 마우스 올렸을 때 초록빛 테두리 활성화
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

    // 리셋 버튼 클릭 시 처음 상태로 돌아가기
    resetBtn.addEventListener('click', () => {
        previewSection.classList.add('hidden');
        resultSection.classList.add('hidden');
        dropZone.parentElement.classList.remove('hidden');
        fileInput.value = '';
    });

    // 3. 선택된 파일을 처리하고 AI API 서버로 전송하는 메인 함수
    function handleFile(file) {
        // 이미지 파일 검사
        if (!file.type.startsWith('image/')) {
            alert('❌ 이미지 파일(JPG, PNG 등)만 올려주세요!');
            return;
        }

        // 화면 전환: 업로드 창 숨기고 미리보기 띄우기
        dropZone.parentElement.classList.add('hidden');
        previewSection.classList.remove('hidden');
        resultSection.classList.add('hidden');
        loadingSpinner.classList.remove('hidden');

        // 파일 내용을 읽어서 화면에 보여주기 (FileReader)
        const reader = new FileReader();
        reader.onload = (e) => {
            previewImage.src = e.target.result;
        };
        reader.readAsDataURL(file);

        // 4. FastAPI 서버로 이미지 전송 (비동기 통신 fetch)
        const formData = new FormData();
        formData.append('file', file);

        fetch('/predict', {
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
            // 로딩 스피너 끄기
            loadingSpinner.classList.add('hidden');
            // 분석 결과 화면에 그리기
            renderPredictions(data.predictions);
        })
        .catch(error => {
            loadingSpinner.classList.add('hidden');
            alert('❌ ' + error.message);
        });
    }

    // 5. 서버가 돌려준 상위 5개 결과를 예쁜 애니메이션 바(Bar)로 표현하는 함수
    function renderPredictions(predictions) {
        predictionsList.innerHTML = '';
        
        predictions.forEach(pred => {
            // 숫자만 추출 (예: "98.68%" -> 98.68)
            const probNum = parseFloat(pred.probability);
            const rankClass = pred.rank === 1 ? 'rank-1' : '';

            const itemHtml = `
                <div class="prediction-item ${rankClass}">
                    <div class="prediction-info">
                        <span class="pred-name">${pred.rank}. ${pred.category}</span>
                        <span class="pred-prob">${pred.probability}</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: 0%"></div>
                    </div>
                </div>
            `;
            predictionsList.insertAdjacentHTML('beforeend', itemHtml);

            // 부드럽게 게이지가 차오르는 애니메이션 효과 트리거
            setTimeout(() => {
                const lastBar = predictionsList.lastElementChild.querySelector('.progress-fill');
                lastBar.style.width = `${probNum}%`;
            }, 50);
        });

        resultSection.classList.remove('hidden');
    }
});
