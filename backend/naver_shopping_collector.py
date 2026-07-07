import os
import sys
import csv
import re
import time
import requests
import urllib.parse
from dotenv import load_dotenv

# Windows 환경 인코딩 강제 매칭
if sys.stdout.encoding != "utf-8":
    sys.stdout = open(sys.stdout.fileno(), mode="w", encoding="utf-8", buffering=1)

# .env 파일 로드
load_dotenv()

NAVER_CLIENT_ID = os.getenv("NAVER_CLIENT_ID")
NAVER_CLIENT_SECRET = os.getenv("NAVER_CLIENT_SECRET")

# 수집할 대표 가구/소품 키워드 리스트
KEYWORDS = [
    # 거실 가구
    "가죽 소파", "패브릭 소파", "1인용 리클라이너", "거실 테이블", "거실장",
    # 침실 가구
    "원목 침대", "수납형 침대프레임", "서랍장", "화장대 콘솔", "침대 협탁",
    # 주방 가구
    "4인용 식탁", "6인용 원목식탁", "식탁의자", "아일랜드 식탁",
    # 서재 및 공부방
    "컴퓨터 책상", "모던 책상", "사무용 의자", "수납 책장",
    # 조명 및 소품
    "인테리어 조명 플로어스탠드", "테이블 스탠드 조명", "인테리어 러그", "전신 거울"
]

def clean_html(text):
    """
    네이버 API 결과에 포함된 HTML 태그(예: <b>, </b>)를 제거합니다.
    """
    if not text:
        return ""
    # HTML 태그 제거
    cleaned = re.sub(r'<[^>]*>', '', text)
    # 공백 정규화
    cleaned = " ".join(cleaned.split())
    return cleaned

def fetch_naver_shopping(query, display=100, start=1):
    """
    네이버 쇼핑 검색 API를 호출하여 결과를 반환합니다.
    """
    url = "https://openapi.naver.com/v1/search/shop.json"
    headers = {
        "X-Naver-Client-Id": NAVER_CLIENT_ID,
        "X-Naver-Client-Secret": NAVER_CLIENT_SECRET
    }
    params = {
        "query": query,
        "display": display,
        "start": start,
        "sort": "sim" # 유사도순
    }

    try:
        response = requests.get(url, headers=headers, params=params, timeout=10)
        if response.status_code == 200:
            return response.json()
        else:
            print(f"⚠️ API 호출 실패 [{query}] (HTTP {response.status_code}): {response.text}")
            return None
    except Exception as e:
        print(f"❌ API 호출 중 오류 발생 [{query}]: {e}")
        return None

def load_existing_db(db_path):
    """
    기존 가구 DB3 파일이 존재하면 읽어와서 productId를 키로 하는 딕셔너리로 반환합니다.
    """
    existing_items = {}
    if os.path.exists(db_path):
        try:
            with open(db_path, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    pid = row.get("product_id")
                    if pid:
                        existing_items[pid] = row
        except Exception as e:
            print(f"⚠️ 기존 DB 파일 로드 실패: {e}")
    return existing_items

def save_to_csv(db_path, items):
    """
    아이템 리스트를 CSV 파일에 저장합니다.
    """
    headers = [
        "id", "product_id", "product_name", "image_url", "price", 
        "mall_name", "link", "category1", "category2", "category3", 
        "category4", "brand"
    ]
    
    try:
        with open(db_path, "w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=headers, quoting=csv.QUOTE_ALL)
            writer.writeheader()
            for idx, item in enumerate(items.values(), start=1):
                item["id"] = idx
                writer.writerow(item)
        print(f"💾 DB3 파일 업데이트 완료: {db_path} (총 {len(items)}개 상품 적재됨)")
    except Exception as e:
        print(f"❌ DB3 파일 저장 오류: {e}")

def main():
    if not NAVER_CLIENT_ID or not NAVER_CLIENT_SECRET:
        print("❌ 오류: NAVER_CLIENT_ID 또는 NAVER_CLIENT_SECRET이 .env 파일에 구성되지 않았습니다.")
        sys.exit(1)

    base_dir = os.path.dirname(os.path.abspath(__file__))
    db_path = os.path.join(base_dir, "DB3_furniture.csv")

    print("🔍 기존 DB3 가구 데이터 로드 중...")
    furniture_db = load_existing_db(db_path)
    print(f"   현재 로컬 DB에 등록된 상품 수: {len(furniture_db)}개")

    total_added = 0
    for keyword in KEYWORDS:
        print(f"🌐 네이버 쇼핑 검색 API 호출 중: [키워드: '{keyword}']")
        
        # 각 키워드별로 최대 100개 수집
        data = fetch_naver_shopping(keyword, display=100, start=1)
        if not data or "items" not in data:
            # API 레이트 리밋 방지 대기
            time.sleep(0.3)
            continue

        keyword_added = 0
        for raw_item in data["items"]:
            pid = raw_item.get("productId")
            if not pid:
                continue

            # 전처리
            title = clean_html(raw_item.get("title", ""))
            image = raw_item.get("image", "")
            if image:
                # 네이버 쇼핑 이미지 CDN의 브라우저 직접 링크 시 403 Forbidden 우회를 위해
                # 네이버 자체 검색 캐싱 이미지 프록시(search.pstatic.net) 경로로 래핑합니다.
                # 콤마 및 슬래시가 CSV 구분자 및 브라우저 파싱에 오동작을 초래하지 않도록 URL 인코딩을 적용합니다.
                encoded_image = urllib.parse.quote(image, safe="")
                image = f"https://search.pstatic.net/common/?src={encoded_image}"
            
            # 최저가 처리
            try:
                price = int(raw_item.get("lprice", 0))
            except ValueError:
                price = 0
            
            mall = raw_item.get("mallName", "")
            link = raw_item.get("link", "")
            cat1 = raw_item.get("category1", "")
            cat2 = raw_item.get("category2", "")
            cat3 = raw_item.get("category3", "")
            cat4 = raw_item.get("category4", "")
            brand = raw_item.get("brand", "")

            # 상품 정보 구성
            product_info = {
                "id": 0, # 저장 시 실시간 인덱싱
                "product_id": pid,
                "product_name": title,
                "image_url": image,
                "price": price,
                "mall_name": mall,
                "link": link,
                "category1": cat1,
                "category2": cat2,
                "category3": cat3,
                "category4": cat4,
                "brand": brand
            }

            # 중복 체크 후 오버라이트 또는 추가
            if pid not in furniture_db:
                keyword_added += 1
                total_added += 1
            furniture_db[pid] = product_info

        print(f"   ✨ '{keyword}': 신규 상품 {keyword_added}개 수집 완료 (총 누적 상품 수: {len(furniture_db)}개)")
        # 네이버 검색 API 호출 한도 및 속도 준수를 위한 딜레이
        time.sleep(0.3)

    print(f"📊 수집 종료. 신규 추가된 총 상품 수: {total_added}개")
    save_to_csv(db_path, furniture_db)

if __name__ == "__main__":
    main()
