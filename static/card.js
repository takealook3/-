// Phaser 3 게임 엔진 환경설정
const config = {
    type: Phaser.AUTO,
    width: 640,
    height: 500,
    parent: 'game-container',
    backgroundColor: '#111218',
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

const game = new Phaser.Game(config);

// 게임 로직 변수들
let cards = [];
let firstCard = null;
let secondCard = null;
let canFlip = true; // 현재 카드를 뒤집을 수 있는지 상태 (판정 중에는 누르지 못하게 차단)
let matchedPairs = 0;
const totalPairs = 6;

// 타이머 변수
let timeLeft = 60;
let timerEvent;
let timerText;
let progressBar;
let progressFill;
let infoText;
let particleEmitter;

// 사용할 동물 이모지 6쌍 (총 12장)
const baseEmojis = ['🐶', '🐱', '🦊', '🐼', '🦁', '🐰'];

function preload() {
    // 불꽃놀이 축포용 작은 빛나는 동그라미 파티클 텍스처 생성
    const graphics = this.make.graphics({x: 0, y: 0, add: false});
    graphics.fillStyle(0xffffff, 1);
    graphics.fillCircle(6, 6, 6);
    graphics.generateTexture('sparkle', 12, 12);
}

function create() {
    const scene = this;
    matchedPairs = 0;
    timeLeft = 60;
    canFlip = true;
    firstCard = null;
    secondCard = null;

    // --- 상단 정보 및 타이머 바 ---
    infoText = scene.add.text(320, 25, '🔍 카드를 2장씩 뒤집어 짝을 맞추세요!', { fontSize: '20px', fill: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
    timerText = scene.add.text(540, 25, '⏱️ 60초', { fontSize: '20px', fill: '#ff007f', fontStyle: 'bold' }).setOrigin(0.5);

    // 타이머 게이지 바 배경
    progressBar = scene.add.rectangle(320, 55, 580, 10, 0x222533).setOrigin(0.5);
    progressFill = scene.add.rectangle(30, 55, 580, 10, 0x00df89).setOrigin(0, 0.5);

    // --- 카드 덱 준비 및 섞기 (셔플) ---
    // 6개의 이모지를 2번씩 넣어 12장의 배열로 만듭니다.
    let deck = [...baseEmojis, ...baseEmojis];
    
    // 무작위 섞기 알고리즘 (Fisher-Yates Shuffle)
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    // --- 4열 3행 격자로 카드 배치 ---
    const cols = 4;
    const rows = 3;
    const startX = 140;
    const startY = 140;
    const gapX = 120;
    const gapY = 115;

    cards = [];

    for (let i = 0; i < 12; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = startX + col * gapX;
        const y = startY + row * gapY;

        // 카드 뒷면 배경 상자
        const cardBg = scene.add.rectangle(x, y, 100, 100, 0x2a1b4e).setInteractive({ useHandCursor: true });
        cardBg.setStrokeStyle(3, 0x7928CA);

        // 카드 뒷면 물음표 (앞면이 뒤집히기 전)
        const cardText = scene.add.text(x, y, '❓', { fontSize: '45px' }).setOrigin(0.5);

        // 카드 상태 정보를 하나의 객체로 묶기
        const cardObj = {
            bg: cardBg,
            text: cardText,
            emoji: deck[i],
            isOpen: false,
            isMatched: false
        };

        cards.push(cardObj);

        // 마우스 호버 효과
        cardBg.on('pointerover', () => {
            if (canFlip && !cardObj.isOpen && !cardObj.isMatched) {
                cardBg.setStrokeStyle(3, 0x00df89);
                scene.tweens.add({ targets: [cardBg, cardText], scaleX: 1.05, scaleY: 1.05, duration: 100 });
            }
        });

        cardBg.on('pointerout', () => {
            if (!cardObj.isOpen && !cardObj.isMatched) {
                cardBg.setStrokeStyle(3, 0x7928CA);
                scene.tweens.add({ targets: [cardBg, cardText], scaleX: 1, scaleY: 1, duration: 100 });
            }
        });

        // 카드 클릭 시 뒤집기 이벤트
        cardBg.on('pointerdown', () => {
            if (canFlip && !cardObj.isOpen && !cardObj.isMatched) {
                flipCard(scene, cardObj);
            }
        });
    }

    // --- 파티클 시스템 초기화 ---
    particleEmitter = scene.add.particles(0, 0, 'sparkle', {
        speed: { min: -150, max: 150 },
        angle: { min: 0, max: 360 },
        scale: { start: 1.2, end: 0 },
        blendMode: 'ADD',
        tint: [ 0x00df89, 0xffff00, 0xff007f, 0x007cf0 ],
        emitting: false
    });

    // --- 1초마다 줄어드는 타이머 이벤트 시작 ---
    timerEvent = scene.time.addEvent({
        delay: 1000,
        callback: () => {
            timeLeft--;
            timerText.setText(`⏱️ ${timeLeft}초`);
            
            // 게이지 바 줄어들기 애니메이션
            const fillWidth = (timeLeft / 60) * 580;
            scene.tweens.add({ targets: progressFill, width: fillWidth, duration: 300 });

            // 시간이 10초 이하일 때 게이지와 글자를 빨간색으로 경고!
            if (timeLeft <= 10) {
                progressFill.setFillStyle(0xff0000);
                timerText.setFill('#ff0000');
            }

            // 시간 초과 (게임 오버)
            if (timeLeft <= 0) {
                timerEvent.remove();
                gameOver(scene, false);
            }
        },
        loop: true
    });
}

function update() {
    // 2D 엔진 매 프레임 업데이트 루프
}

// 3D 느낌의 카드 플립(뒤집기) 함수
function flipCard(scene, cardObj) {
    cardObj.isOpen = true;

    // 카드가 얇아지면서(scaleX: 0) 뒤집히는 애니메이션 1단계
    scene.tweens.add({
        targets: [cardObj.bg, cardObj.text],
        scaleX: 0,
        duration: 120,
        onComplete: () => {
            // 앞면 이모지로 변경하고 카드 배경색을 화사하게 변경
            cardObj.text.setText(cardObj.emoji);
            cardObj.bg.setFillStyle(0x1a2e3b);
            cardObj.bg.setStrokeStyle(3, 0x00df89);

            // 다시 넓어지면서(scaleX: 1) 애니메이션 2단계 완성
            scene.tweens.add({
                targets: [cardObj.bg, cardObj.text],
                scaleX: 1,
                duration: 120,
                onComplete: () => {
                    checkMatch(scene, cardObj);
                }
            });
        }
    });
}

// 두 카드가 일치하는지 판정하는 함수
function checkMatch(scene, cardObj) {
    if (!firstCard) {
        // 첫 번째 고른 카드 저장
        firstCard = cardObj;
    } else {
        // 두 번째 카드 선택 완료, 판정 동안 추가 클릭 차단
        secondCard = cardObj;
        canFlip = false;

        if (firstCard.emoji === secondCard.emoji) {
            // 짝이 일치함! 🎉
            firstCard.isMatched = true;
            secondCard.isMatched = true;
            matchedPairs++;

            infoText.setText('🎉 짝을 맞췄습니다! 나이스 기억력!');
            infoText.setFill('#00df89');

            // 축포 파티클 발사
            particleEmitter.emitParticleAt(secondCard.bg.x, secondCard.bg.y, 25);
            particleEmitter.emitParticleAt(firstCard.bg.x, firstCard.bg.y, 25);

            // 두 카드 둠칫 커졌다가 작아지는 승리 애니메이션
            scene.tweens.add({ targets: [firstCard.bg, secondCard.bg], scaleX: 1.15, scaleY: 1.15, yoyo: true, duration: 200 });

            resetSelection();

            // 모든 카드를 다 맞췄는지 확인
            if (matchedPairs >= totalPairs) {
                timerEvent.remove();
                setTimeout(() => gameOver(scene, true), 500);
            }
        } else {
            // 짝이 일치하지 않음! ❌
            infoText.setText('아쉽네요! 다시 기억해 보세요.');
            infoText.setFill('#ff007f');

            // 오답 흔들기 애니메이션 후 다시 엎기
            scene.tweens.add({ targets: [firstCard.bg, secondCard.bg], x: '+=10', yoyo: true, repeat: 2, duration: 60 });

            setTimeout(() => {
                unflipCard(scene, firstCard);
                unflipCard(scene, secondCard);
                resetSelection();
            }, 800);
        }
    }
}

// 카드를 다시 뒷면으로 엎는 함수
function unflipCard(scene, cardObj) {
    cardObj.isOpen = false;
    scene.tweens.add({
        targets: [cardObj.bg, cardObj.text],
        scaleX: 0,
        duration: 120,
        onComplete: () => {
            cardObj.text.setText('❓');
            cardObj.bg.setFillStyle(0x2a1b4e);
            cardObj.bg.setStrokeStyle(3, 0x7928CA);
            scene.tweens.add({ targets: [cardObj.bg, cardObj.text], scaleX: 1, duration: 120 });
        }
    });
}

function resetSelection() {
    firstCard = null;
    secondCard = null;
    canFlip = true;
}

// 게임 종료 처리 (승리 또는 시간 초과 패배)
function gameOver(scene, isWin) {
    canFlip = false;
    const overlay = scene.add.rectangle(320, 250, 640, 500, 0x000000, 0.85);
    
    if (isWin) {
        scene.add.text(320, 200, '🎊 미션 클리어! 대단한 기억력입니다! 🎊', { fontSize: '28px', fill: '#00df89', fontStyle: 'bold' }).setOrigin(0.5);
        particleEmitter.emitParticleAt(320, 250, 100); // 엄청난 대폭발 파티클!
    } else {
        scene.add.text(320, 200, '⏰ 시간 초과... 다음엔 더 빠를 수 있어요!', { fontSize: '28px', fill: '#ff007f', fontStyle: 'bold' }).setOrigin(0.5);
    }

    // 다시 하기 버튼
    const restartBg = scene.add.rectangle(320, 300, 180, 50, 0x7928CA).setInteractive({ useHandCursor: true });
    const restartText = scene.add.text(320, 300, '🔄 다시 도전하기', { fontSize: '20px', fill: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);

    restartBg.on('pointerover', () => { restartBg.setFillStyle(0xff007f); scene.tweens.add({ targets: [restartBg, restartText], scaleX: 1.08, scaleY: 1.08, duration: 100 }); });
    restartBg.on('pointerout', () => { restartBg.setFillStyle(0x7928CA); scene.tweens.add({ targets: [restartBg, restartText], scaleX: 1, scaleY: 1, duration: 100 }); });
    restartBg.on('pointerdown', () => { scene.scene.restart(); });
}
