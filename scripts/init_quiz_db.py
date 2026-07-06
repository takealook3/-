import sqlite3
import os
import datetime

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "../backend/quiz_metadata.db")

def init_db():
    # backend 디렉토리가 없으면 생성
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # 테이블 생성
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS quiz_images (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            file_name TEXT UNIQUE NOT NULL,
            source_url TEXT NOT NULL,
            license_type TEXT NOT NULL,
            is_verified INTEGER NOT NULL CHECK (is_verified IN (0, 1)),
            downloaded_at TEXT NOT NULL
        )
    """)
    
    # 15개 이미지의 메타데이터 리스트
    images_metadata = [
        ("가구 개수를 최소화한 침실.jpg", "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85", "Unsplash License", 1),
        ("다양한 소재를 믹스한 침실.jpg", "https://images.unsplash.com/photo-1540518614846-7eded433c457", "Unsplash License", 1),
        ("몰딩과 앤틱 장식이 있는 벽.jpg", "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0", "Unsplash License", 1),
        ("무채색 위주 톤온톤.jpg", "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace", "Unsplash License", 1),
        ("베이지 브라운 패브릭 소파.jpg", "https://images.unsplash.com/photo-1555041469-a586c61ea9bc", "Unsplash License", 1),
        ("블루 그레이 패브릭 소파.jpg", "https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e", "Unsplash License", 1),
        ("소품과 패턴이 가득한 거실.jpg", "https://images.unsplash.com/photo-1581858726788-75bc0f6a952d", "Unsplash License", 1),
        ("여백이 넉넉한 심플한 거실.jpg", "https://images.unsplash.com/photo-1513694203232-719a280e022f", "Unsplash License", 1),
        ("우드 프레임의 클래식 가구.jpg", "https://images.unsplash.com/photo-1598928506311-c55ded91a20c", "Unsplash License", 1),
        ("우드톤 가구와 따뜻한 조명.jpg", "https://images.unsplash.com/photo-1618219908412-a29a1bb7b86e", "Unsplash License", 1),
        ("직선 라인의 미니멀 벽면.jpg", "https://images.unsplash.com/photo-1586023492125-27b2c045efd7", "Unsplash License", 1),
        ("차콜 아이스블루 러그.jpg", "https://images.unsplash.com/photo-1600585154340-be6161a56a0c", "Unsplash License", 1),
        ("쿨톤.jpg", "https://images.unsplash.com/photo-1507652313519-d4e9174996dd", "Unsplash License", 1),
        ("테라코타 머스타드 러그.jpg", "https://images.unsplash.com/photo-1512917774080-9991f1c4c750", "Unsplash License", 1),
        ("포인트 컬러가 강한 벽면.jpg", "https://images.unsplash.com/photo-1533090161767-e6ffed986c88", "Unsplash License", 1)
    ]
    
    download_date = datetime.date.today().isoformat()
    
    for file_name, source_url, license_type, is_verified in images_metadata:
        try:
            cursor.execute("""
                INSERT INTO quiz_images (file_name, source_url, license_type, is_verified, downloaded_at)
                VALUES (?, ?, ?, ?, ?)
            """, (file_name, source_url, license_type, is_verified, download_date))
        except sqlite3.IntegrityError:
            cursor.execute("""
                UPDATE quiz_images 
                SET source_url = ?, license_type = ?, is_verified = ?, downloaded_at = ?
                WHERE file_name = ?
            """, (source_url, license_type, is_verified, download_date, file_name))
            
    conn.commit()
    
    # 검증 조회 출력
    cursor.execute("SELECT COUNT(*) FROM quiz_images")
    count = cursor.fetchone()[0]
    print(f"Verified: {count} records loaded in quiz_images table.")
    
    conn.close()

if __name__ == "__main__":
    init_db()
