// Phaser 3 게임 엔진 및 아케이드 물리 엔진 환경설정
const config = {
    type: Phaser.AUTO,
    width: 640,
    height: 500,
    parent: 'game-container',
    backgroundColor: '#111218',
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { x: 0, y: 0 }, // 탑다운 뷰이므로 중력을 0으로 설정
            debug: false
        }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

const game = new Phaser.Game(config);

// 플레이어 및 게임 상태 변수
let player;
let cursors;
let wasdKeys;
let enemies;
let projectiles;
let gems;
let particleEmitter;

let playerHP = 100;
let maxHP = 100;
let playerLevel = 1;
let currentEXP = 0;
let maxEXP = 30;
let killCount = 0;
let survivalTime = 0;
let attackDelay = 900; // 공격 주기 (ms), 레벨업마다 빨라짐
let playerSpeed = 180;
let isGameOver = false;

// UI 텍스트 및 게이지 바 객체
let hpFill;
let expFill;
let levelText;
let killText;
let timeText;
let timerEvent;
let spawnEvent;
let attackEvent;

function preload() {
    // 불꽃 및 타격 파티클용 작은 동그라미 텍스처 생성
    const graphics = this.make.graphics({x: 0, y: 0, add: false});
    graphics.fillStyle(0xffffff, 1);
    graphics.fillCircle(5, 5, 5);
    graphics.generateTexture('particle_node', 10, 10);
}

function create() {
    const scene = this;
    
    // 변수 초기화
    playerHP = 100;
    playerLevel = 1;
    currentEXP = 0;
    maxEXP = 30;
    killCount = 0;
    survivalTime = 0;
    attackDelay = 900;
    isGameOver = false;

    // --- 바닥 격자 배경 장식 (아레나 느낌) ---
    for (let x = 0; x < 640; x += 40) {
        scene.add.line(0, 0, x, 0, x, 500, 0x1e2233).setOrigin(0);
    }
    for (let y = 0; y < 500; y += 40) {
        scene.add.line(0, 0, 0, y, 640, y, 0x1e2233).setOrigin(0);
    }

    // --- 물리 엔진 그룹 생성 ---
    enemies = scene.physics.add.group();
    projectiles = scene.physics.add.group();
    gems = scene.physics.add.group();

    // --- 주인공 마법사 (🧙‍♂️) 생성 ---
    player = scene.add.text(320, 250, '🧙‍♂️', { fontSize: '36px' }).setOrigin(0.5);
    scene.physics.add.existing(player);
    player.body.setCollideWorldBounds(true); // 화면 밖으로 나가지 못하게 벽 설정
    player.body.setCircle(16, 2, 2); // 히트박스를 동그랗게 설정

    // --- 키보드 입력 조작 설정 (방향키 + WASD) ---
    cursors = scene.input.keyboard.createCursorKeys();
    wasdKeys = scene.input.keyboard.addKeys({
        up: Phaser.Input.Keyboard.KeyCodes.W,
        down: Phaser.Input.Keyboard.KeyCodes.S,
        left: Phaser.Input.Keyboard.KeyCodes.A,
        right: Phaser.Input.Keyboard.KeyCodes.D
    });

    // --- 상단 UI 패널 (체력, 경험치, 레벨, 킬 수, 생존 시간) ---
    scene.add.rectangle(320, 25, 640, 50, 0x0a0b10, 0.85);

    // 체력 바 (HP)
    scene.add.text(20, 12, '❤️ HP', { fontSize: '14px', fill: '#ff007f', fontStyle: 'bold' });
    scene.add.rectangle(105, 19, 100, 10, 0x222533).setOrigin(0.5);
    hpFill = scene.add.rectangle(55, 19, 100, 10, 0xff007f).setOrigin(0, 0.5);

    // 경험치 바 (EXP)
    scene.add.text(175, 12, '💎 EXP', { fontSize: '14px', fill: '#00df89', fontStyle: 'bold' });
    scene.add.rectangle(275, 19, 120, 10, 0x222533).setOrigin(0.5);
    expFill = scene.add.rectangle(215, 19, 0, 10, 0x00df89).setOrigin(0, 0.5);

    // 레벨 및 통계
    levelText = scene.add.text(360, 12, 'LV. 1', { fontSize: '16px', fill: '#ffff00', fontStyle: 'bold' });
    killText = scene.add.text(440, 12, '💀 킬: 0', { fontSize: '16px', fill: '#ffffff' });
    timeText = scene.add.text(540, 12, '⏱️ 0초', { fontSize: '16px', fill: '#007cf0', fontStyle: 'bold' });

    // --- 파티클 이펙터 ---
    particleEmitter = scene.add.particles(0, 0, 'particle_node', {
        speed: { min: -100, max: 100 },
        angle: { min: 0, max: 360 },
        scale: { start: 1, end: 0 },
        blendMode: 'ADD',
        tint: [ 0xff007f, 0x00df89, 0xffff00 ],
        emitting: false
    });

    // --- 1. 충돌 판정: 마법 투사체 vs 몬스터 ---
    scene.physics.add.overlap(projectiles, enemies, (projectile, enemy) => {
        projectile.destroy(); // 투사체 소멸
        enemy.hp -= 25; // 몬스터 체력 감소

        // 타격 깜빡임 효과
        scene.tweens.add({ targets: enemy, alpha: 0.3, yoyo: true, duration: 50 });

        if (enemy.hp <= 0) {
            // 몬스터 사망 처리
            particleEmitter.emitParticleAt(enemy.x, enemy.y, 15);
            spawnGem(scene, enemy.x, enemy.y); // 경험치 보석 드롭
            enemy.destroy();
            killCount++;
            killText.setText(`💀 킬: ${killCount}`);
        }
    });

    // --- 2. 충돌 판정: 플레이어 vs 경험치 보석 ---
    scene.physics.add.overlap(player, gems, (playerObj, gem) => {
        gem.destroy();
        gainEXP(scene, 10);
    });

    // --- 3. 충돌 판정: 플레이어 vs 몬스터 (플레이어 피해 입음) ---
    scene.physics.add.overlap(player, enemies, (playerObj, enemy) => {
        if (!isGameOver) {
            takeDamage(scene, 1);
        }
    });

    // --- 주기적 타이머 이벤트 시작 ---
    // 1초마다 생존 시간 증가
    timerEvent = scene.time.addEvent({
        delay: 1000,
        callback: () => {
            if (!isGameOver) {
                survivalTime++;
                timeText.setText(`⏱️ ${survivalTime}초`);
            }
        },
        loop: true
    });

    // 1.2초마다 화면 테두리 밖에서 몬스터 스폰
    spawnEvent = scene.time.addEvent({
        delay: 1200,
        callback: () => { if (!isGameOver) spawnEnemy(scene); },
        loop: true
    });

    // 자동 공격 타겟팅 마법 발사 루프 시작
    scheduleNextAttack(scene);
}

// 매 프레임 업데이트 (주인공 이동 및 몬스터 추적 AI 계산)
function update() {
    if (isGameOver) return;

    // --- 주인공 이동 물리 연산 ---
    let velocityX = 0;
    let velocityY = 0;

    if (cursors.left.isDown || wasdKeys.left.isDown) velocityX = -playerSpeed;
    else if (cursors.right.isDown || wasdKeys.right.isDown) velocityX = playerSpeed;

    if (cursors.up.isDown || wasdKeys.up.isDown) velocityY = -playerSpeed;
    else if (cursors.down.isDown || wasdKeys.down.isDown) velocityY = playerSpeed;

    // 대각선 이동 시 속도 정규화
    if (velocityX !== 0 && velocityY !== 0) {
        velocityX *= 0.707;
        velocityY *= 0.707;
    }

    player.body.setVelocity(velocityX, velocityY);

    // 이동할 때 살짝 뒤뚱거리는 걷기 애니메이션
    if (velocityX !== 0 || velocityY !== 0) {
        player.angle = Math.sin(this.time.now / 100) * 10;
    } else {
        player.angle = 0;
    }

    // --- 모든 몬스터가 주인공 마법사를 향해 쫓아오도록 AI 방향 계산 ---
    enemies.getChildren().forEach(enemy => {
        this.physics.moveToObject(enemy, player, enemy.speed);
    });
}

// 화면 가장자리 밖에서 무작위로 몬스터를 생성하는 함수
function spawnEnemy(scene) {
    const edge = Math.floor(Math.random() * 4); // 0:위, 1:아래, 2:왼쪽, 3:오른쪽
    let x, y;

    if (edge === 0) { x = Phaser.Math.Between(0, 640); y = -30; }
    else if (edge === 1) { x = Phaser.Math.Between(0, 640); y = 530; }
    else if (edge === 2) { x = -30; y = Phaser.Math.Between(0, 500); }
    else { x = 670; y = Phaser.Math.Between(0, 500); }

    // 시간 흐름에 따라 더 강한 몬스터 등장 (박쥐 -> 해골)
    const isSkeleton = Math.random() < 0.3 + (survivalTime * 0.01);
    const emoji = isSkeleton ? '💀' : '👾';
    const hp = isSkeleton ? 50 : 25;
    const speed = isSkeleton ? 65 : 85;

    const enemy = scene.add.text(x, y, emoji, { fontSize: '28px' }).setOrigin(0.5);
    scene.physics.add.existing(enemy);
    enemy.hp = hp;
    enemy.speed = speed;
    enemy.body.setCircle(14, 2, 2);
    enemies.add(enemy);
}

// 자동 타겟팅 공격 스케줄러
function scheduleNextAttack(scene) {
    if (isGameOver) return;

    attackEvent = scene.time.addEvent({
        delay: attackDelay,
        callback: () => {
            if (!isGameOver) fireProjectile(scene);
            scheduleNextAttack(scene); // 변경된 attackDelay 주기로 다시 스케줄링
        }
    });
}

// 가장 가까운 적을 찾아 마법 화염구(🔥)를 발사하는 함수
function fireProjectile(scene) {
    const enemyList = enemies.getChildren();
    if (enemyList.length === 0) return;

    // 주인공과 가장 가까운 적 찾기
    let closestEnemy = null;
    let minDistance = Infinity;

    enemyList.forEach(enemy => {
        const dist = Phaser.Math.Distance.Between(player.x, player.y, enemy.x, enemy.y);
        if (dist < minDistance) {
            minDistance = dist;
            closestEnemy = enemy;
        }
    });

    if (closestEnemy) {
        // 화염구 생성
        const fireball = scene.add.text(player.x, player.y, '🔥', { fontSize: '24px' }).setOrigin(0.5);
        scene.physics.add.existing(fireball);
        fireball.body.setCircle(10, 2, 2);
        projectiles.add(fireball);

        // 가장 가까운 적을 향해 발사 (초속 350)
        scene.physics.moveToObject(fireball, closestEnemy, 350);

        // 2.5초 후에도 안 맞으면 자동 소멸 (메모리 최적화)
        scene.time.delayedCall(2500, () => { if (fireball && fireball.active) fireball.destroy(); });
    }
}

// 경험치 보석 생성
function spawnGem(scene, x, y) {
    const gem = scene.add.text(x, y, '💎', { fontSize: '20px' }).setOrigin(0.5);
    scene.physics.add.existing(gem);
    gem.body.setCircle(10, 2, 2);
    gems.add(gem);

    // 보석 둥둥 떠있는 애니메이션
    scene.tweens.add({ targets: gem, y: y - 5, yoyo: true, repeat: -1, duration: 600 });
}

// 경험치 획득 및 레벨업 성장 연산
function gainEXP(scene, amount) {
    currentEXP += amount;
    if (currentEXP >= maxEXP) {
        // 레벨업 달성! 🎉
        currentEXP -= maxEXP;
        playerLevel++;
        maxEXP = Math.floor(maxEXP * 1.4); // 다음 레벨 필요 경험치 증가
        attackDelay = Math.max(250, Math.floor(attackDelay * 0.88)); // 마법 연사 속도 빨라짐 (최소 0.25초)
        playerSpeed = Math.min(260, playerSpeed + 8); // 주인공 이동 속도 상승

        levelText.setText(`LV. ${playerLevel}`);

        // 레벨업 축하 팝업 텍스트 연출
        const levelUpNotice = scene.add.text(player.x, player.y - 40, '⚡ LEVEL UP! 연사 속도 가속!', { fontSize: '20px', fill: '#ffff00', fontStyle: 'bold' }).setOrigin(0.5);
        scene.tweens.add({ targets: levelUpNotice, y: player.y - 80, alpha: 0, duration: 1200, onComplete: () => levelUpNotice.destroy() });
        particleEmitter.emitParticleAt(player.x, player.y, 40);
    }

    // 경험치 게이지 바 갱신
    const fillWidth = (currentEXP / maxEXP) * 120;
    scene.tweens.add({ targets: expFill, width: fillWidth, duration: 150 });
}

// 플레이어 체력 손실 및 게임 오버 처리
function takeDamage(scene, amount) {
    playerHP -= amount;
    if (playerHP < 0) playerHP = 0;

    const fillWidth = (playerHP / maxHP) * 100;
    hpFill.width = fillWidth;

    // 피격 시 빨갛게 깜빡임
    scene.cameras.main.flash(100, 255, 0, 0, 0.3);

    if (playerHP <= 0 && !isGameOver) {
        isGameOver = true;
        player.body.setVelocity(0, 0);
        timerEvent.remove();
        spawnEvent.remove();
        if (attackEvent) attackEvent.remove();

        // 게임 오버 창 표시
        scene.add.rectangle(320, 250, 640, 500, 0x000000, 0.85);
        scene.add.text(320, 180, '💀 마법사가 쓰러졌습니다... 💀', { fontSize: '28px', fill: '#ff007f', fontStyle: 'bold' }).setOrigin(0.5);
        scene.add.text(320, 230, `최종 생존 시간: ${survivalTime}초  |  처치한 몬스터: ${killCount}마리`, { fontSize: '20px', fill: '#ffffff' }).setOrigin(0.5);

        // 다시 도전 버튼 (오류 없는 기본 사각형 사용)
        const restartBg = scene.add.rectangle(320, 310, 200, 50, 0x7928CA).setInteractive({ useHandCursor: true });
        restartBg.setStrokeStyle(2, 0xffffffff);
        const restartText = scene.add.text(320, 310, '🔄 다시 도전하기', { fontSize: '20px', fill: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);

        restartBg.on('pointerover', () => { restartBg.setFillStyle(0xff007f); });
        restartBg.on('pointerout', () => { restartBg.setFillStyle(0x7928CA); });
        restartBg.on('pointerdown', () => { scene.scene.restart(); });
    }
}
