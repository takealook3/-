// Phaser 3 게임 엔진 환경설정
const config = {
    type: Phaser.AUTO,
    width: 640,
    height: 480,
    parent: 'game-container',
    backgroundColor: '#111218',
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

// 게임 엔진 초기화 (비유: 오락실 전원 켜기)
const game = new Phaser.Game(config);

// 점수판 및 게임 상태 관리 변수
let playerScore = 0;
let aiScore = 0;
let comboStreak = 0;
let isPlaying = false; // 현재 대결 애니메이션 진행 중 여부

// 화면에 글자나 캐릭터를 표시하기 위한 객체 변수들
let scoreText;
let comboText;
let resultText;
let aiChoiceText;
let playerChoiceText;
let particleEmitter;

const choices = ['✌️ 가위', '✊ 바위', '✋ 보'];
const emojis = ['✌️', '✊', '✋'];

// 1. 자원 로딩 단계 (Preload)
function preload() {
    // 외부 이미지 없이 캔버스 자체 기능으로 불꽃놀이 파티클용 작은 동그라미 이미지(flare)를 생성합니다.
    const graphics = this.make.graphics({x: 0, y: 0, add: false});
    graphics.fillStyle(0xffffff, 1);
    graphics.fillCircle(6, 6, 6);
    graphics.generateTexture('flare', 12, 12);
}

// 2. 화면 구성 단계 (Create)
function create() {
    const scene = this;

    // --- 상단 점수판 (Scoreboard) ---
    scene.add.text(320, 30, '🏆 아케이드 대결 챔피언십', { fontSize: '22px', fill: '#94a3b8', fontStyle: 'bold' }).setOrigin(0.5);
    
    scoreText = scene.add.text(320, 65, '플레이어 0 : 0 AI 컴퓨터', { fontSize: '28px', fill: '#00df89', fontStyle: 'bold' }).setOrigin(0.5);
    comboText = scene.add.text(320, 95, '🔥 연속 승리(콤보): 0', { fontSize: '18px', fill: '#ff007f' }).setOrigin(0.5);

    // --- 대결 무대 (중앙 영역) ---
    scene.add.text(180, 160, '[ 플레이어 ]', { fontSize: '18px', fill: '#64748b' }).setOrigin(0.5);
    scene.add.text(460, 160, '[ AI 컴퓨터 ]', { fontSize: '18px', fill: '#64748b' }).setOrigin(0.5);

    playerChoiceText = scene.add.text(180, 230, '❓', { fontSize: '70px' }).setOrigin(0.5);
    scene.add.text(320, 230, 'VS', { fontSize: '32px', fill: '#7928CA', fontStyle: 'bold' }).setOrigin(0.5);
    aiChoiceText = scene.add.text(460, 230, '🤖', { fontSize: '70px' }).setOrigin(0.5);

    resultText = scene.add.text(320, 320, '아래 버튼을 눌러 승부를 시작하세요!', { fontSize: '24px', fill: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);

    // --- 하단 플레이어 선택 버튼 3개 (가위, 바위, 보) ---
    const btnPositions = [160, 320, 480];
    
    choices.forEach((choice, index) => {
        // 버튼 배경 상자 (카드 형태)
        const btnBg = scene.add.rectangle(btnPositions[index], 410, 130, 60, 0x222533).setInteractive({ useHandCursor: true });
        btnBg.setStrokeStyle(2, 0x475569);
        
        const btnText = scene.add.text(btnPositions[index], 410, choice, { fontSize: '20px', fill: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);

        // 마우스 호버 효과 (마우스 올렸을 때 버튼이 커지고 빛남)
        btnBg.on('pointerover', () => {
            if (!isPlaying) {
                btnBg.setFillStyle(0x33384d);
                btnBg.setStrokeStyle(2, 0x00df89);
                scene.tweens.add({ targets: [btnBg, btnText], scaleX: 1.08, scaleY: 1.08, duration: 100 });
            }
        });

        btnBg.on('pointerout', () => {
            btnBg.setFillStyle(0x222533);
            btnBg.setStrokeStyle(2, 0x475569);
            scene.tweens.add({ targets: [btnBg, btnText], scaleX: 1, scaleY: 1, duration: 100 });
        });

        // 클릭 시 게임 플레이 시작
        btnBg.on('pointerdown', () => {
            if (!isPlaying) {
                playGame(scene, index);
            }
        });
    });

    // --- 승리 파티클(불꽃놀이) 시스템 초기화 (처음에는 중지 상태) ---
    particleEmitter = scene.add.particles(0, 0, 'flare', {
        speed: { min: -200, max: 200 },
        angle: { min: 0, max: 360 },
        scale: { start: 1, end: 0 },
        blendMode: 'ADD',
        tint: [ 0xff007f, 0x00df89, 0x007cf0, 0xffff00 ],
        emitting: false
    });
}

// 3. 매 프레임 업데이트 단계 (Update)
function update() {
    // 2D 엔진의 프레임별 루프 작업 (현재는 이벤트 기반이므로 비워둡니다)
}

// 핵심 게임 대결 진행 로직
function playGame(scene, playerIndex) {
    isPlaying = true;
    resultText.setText('🤖 AI가 생각을 집중하고 있습니다...');
    resultText.setFill('#ffaa00');
    playerChoiceText.setText(emojis[playerIndex]);

    // 효과: 플레이어 주먹 튕기기 애니메이션
    scene.tweens.add({ targets: playerChoiceText, scaleX: 1.3, scaleY: 1.3, yoyo: true, duration: 150 });

    // AI의 무작위 선택 룰렛 효과 (0.08초마다 이모지 변경)
    let counter = 0;
    const timer = scene.time.addEvent({
        delay: 80,
        callback: () => {
            const randomIndex = Math.floor(Math.random() * 3);
            aiChoiceText.setText(emojis[randomIndex]);
            counter++;
            
            // 약 0.8초(10번) 돌아간 뒤 최종 선택 확정
            if (counter >= 10) {
                timer.remove();
                finalizeGame(scene, playerIndex);
            }
        },
        loop: true
    });
}

// 승패 판정 및 콤보 계산 함수
function finalizeGame(scene, playerIndex) {
    const aiIndex = Math.floor(Math.random() * 3);
    aiChoiceText.setText(emojis[aiIndex]);
    
    // AI 주먹 튕기기 애니메이션
    scene.tweens.add({ targets: aiChoiceText, scaleX: 1.3, scaleY: 1.3, yoyo: true, duration: 150 });

    // 승패 판정 로직
    // 0: 가위, 1: 바위, 2: 보
    if (playerIndex === aiIndex) {
        // 무승부
        resultText.setText('🤝 무승부입니다! 다시 도전하세요.');
        resultText.setFill('#a5a5a5');
    } else if (
        (playerIndex === 0 && aiIndex === 2) || // 가위 > 보
        (playerIndex === 1 && aiIndex === 0) || // 바위 > 가위
        (playerIndex === 2 && aiIndex === 1)    // 보 > 바위
    ) {
        // 플레이어 승리! 🎉
        playerScore++;
        comboStreak++;
        resultText.setText('🎉 짜릿한 승리! AI를 이겼습니다!');
        resultText.setFill('#00df89');

        // 파티클 불꽃놀이 축포 20개 발사! (화면 중앙에서 폭발)
        particleEmitter.emitParticleAt(320, 240, 30);
        
        // 글자 흔들기 (카메라 셰이크 효과)
        scene.cameras.main.shake(150, 0.01);
    } else {
        // AI 승리 (플레이어 패배)
        aiScore++;
        comboStreak = 0; // 콤보 초기화
        resultText.setText('😢 AI에게 패배했습니다... 분발하세요!');
        resultText.setFill('#ff007f');
    }

    // 점수판 갱신
    scoreText.setText(`플레이어 ${playerScore} : ${aiScore} AI 컴퓨터`);
    comboText.setText(`🔥 연속 승리(콤보): ${comboStreak}`);
    
    // 콤보가 높을수록 텍스트 커지는 애니메이션
    if (comboStreak >= 2) {
        scene.tweens.add({ targets: comboText, scaleX: 1.2, scaleY: 1.2, yoyo: true, duration: 200 });
    }

    isPlaying = false; // 다시 버튼 클릭 가능하도록 잠금 해제
}
