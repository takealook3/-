# -*- coding: utf-8 -*-
# backend/ingest_furniture.py
# ─────────────────────────────────────────────────────────────────────────────
# DB3_furniture.csv의 대량 가구 데이터를 읽어들여 이미지 임베딩(CLIP)을 추출하고,
# 텍스트/가격 메타데이터와 함께 Chroma 벡터 데이터베이스에 인덱싱하는 배치 파이프라인입니다.
# 중단 지점부터 이어받는 체크포인팅(Skip 캐시) 기능이 내장되어 있습니다.
# ─────────────────────────────────────────────────────────────────────────────

import os
import sys
import csv
import time
import requests
import json
import numpy as np
from io import BytesIO
from PIL import Image
from tqdm import tqdm

# Windows 콘솔 강제 UTF-8 인코딩 바인딩
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
else:
    sys.stdout = open(sys.stdout.fileno(), mode="w", encoding="utf-8", buffering=1)

# 프로젝트 루트 및 backend 경로 설정
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BACKEND_DIR, ".."))
sys.path.insert(0, BACKEND_DIR)

import config
from services.clip_service import CLIPService
import chromadb


def migrate_existing_metadata(collection, clip_service):
    print("\n🔄 [Migration] 기존 적재 데이터의 텍스트 임베딩 마이그레이션 스캔 시작...")
    try:
        # ChromaDB는 get() 호출 시 limit을 명시하지 않으면 제한이 생길 수 있으므로, 넉넉하게 limit을 5000으로 잡아 조회합니다.
        existing = collection.get(include=['metadatas', 'documents'], limit=5000)
    except Exception as e:
        print(f"❌ 기존 데이터 조회 실패: {e}")
        return

    if not existing or 'ids' not in existing or not existing['ids']:
        print("ℹ️ 기존에 적재된 데이터가 없습니다. 마이그레이션을 생략합니다.")
        return

    ids = existing['ids']
    metadatas = existing['metadatas']
    documents = existing['documents']
    
    total = len(ids)
    print(f"📋 총 {total}개의 기존 등록 상품을 스캔 중...")
    
    to_update_ids = []
    to_update_metadatas = []
    
    for i in range(total):
        pid = ids[i]
        meta = metadatas[i]
        pname = documents[i] if documents and i < len(documents) else (meta.get("product_name") if meta else "이름 없음 가구")
        
        # 기존 데이터에 이미 text_embedding이 완벽히 직렬화되어 존재하는지 확인
        if meta and "text_embedding" in meta and meta["text_embedding"]:
            continue
            
        # 텍스트 결합 문장 생성
        categories = [meta.get(f"category{k}", "") for k in range(1, 5)] if meta else []
        categories_str = " > ".join([c for c in categories if c])
        brand_str = meta.get("brand", "") if meta else ""
        
        text_parts = [pname]
        if brand_str:
            text_parts.append(f"[브랜드: {brand_str}]")
        if categories_str:
            text_parts.append(f"[카테고리: {categories_str}]")
        combine_text = " ".join(text_parts)
        
        # 텍스트 임베딩 추출
        try:
            text_embedding = clip_service.get_text_embedding(combine_text)
            if not text_embedding:
                text_embedding = []
        except Exception as te_err:
            print(f"⚠️ [마이그레이션 임베딩 오류] ID {pid}: {te_err}")
            text_embedding = []
            
        new_meta = meta.copy() if meta else {}
        new_meta["text_embedding"] = json.dumps(text_embedding)
        
        to_update_ids.append(pid)
        to_update_metadatas.append(new_meta)
        
    update_count = len(to_update_ids)
    if update_count == 0:
        print("🎉 [Migration Skip] 모든 기존 데이터가 이미 텍스트 임베딩을 완벽히 탑재하고 있습니다!")
        return
        
    print(f"⚙️ 텍스트 임베딩이 누락된 {update_count}개 상품 업데이트를 진행합니다...")
    
    # 100개씩 벌크 단위로 끊어 업데이트 수행 (네트워크 오버헤드 최소화)
    MIGRATE_BATCH_SIZE = 100
    for idx in range(0, update_count, MIGRATE_BATCH_SIZE):
        batch_ids = to_update_ids[idx:idx + MIGRATE_BATCH_SIZE]
        batch_metas = to_update_metadatas[idx:idx + MIGRATE_BATCH_SIZE]
        try:
            collection.update(
                ids=batch_ids,
                metadatas=batch_metas
            )
            print(f"   - {min(idx + MIGRATE_BATCH_SIZE, update_count)} / {update_count} 개 업데이트 완료")
        except Exception as upd_err:
            print(f"❌ [Update Error] 업데이트 배치 실패: {upd_err}")
            
    print(f"✅ [Migration Done] 기존 데이터 {update_count}개에 대한 텍스트 임베딩 탑재를 완전히 마쳤습니다!\n")

def ingest():
    print("=" * 60)
    print("🚀 [Furniture Ingest] 가구 메타데이터 & 이미지 벡터 DB 적재 개시")
    print("=" * 60)

    # 1. 파일 경로 정의
    csv_path = os.path.join(BACKEND_DIR, "DB3_furniture.csv")
    if not os.path.exists(csv_path):
        print(f"❌ [Error] 가구 DB3 CSV 파일이 존재하지 않습니다: {csv_path}")
        return

    # 2. CLIP 서비스 인스턴스화
    print("🧠 CLIP 임베딩 추출 신경망 서비스 초기화 중...")
    clip_service = CLIPService()
    print(f"👉 활성화된 모델: {clip_service.active_model_info}")

    # 3. Chroma DB 클라이언트 연결 (Persistent)
    print(f"📁 ChromaDB 경로 확인: {config.DB_DIR}")
    chroma_client = chromadb.PersistentClient(path=config.DB_DIR)
    
    # 코사인 유사도 거리 메트릭 적용 컬렉션 로드/생성
    # hnsw:space 파라미터를 cosine으로 지정해 특징 벡터의 방향성 유사도 연산 속도를 가속화합니다.
    collection = chroma_client.get_or_create_collection(
        name=config.COLLECTION_FURNITURE,
        metadata={"hnsw:space": "cosine"}
    )

    # 4. 체크포인트 설정을 위한 기존 적재 데이터 식별자(ID) 조회
    print("🔍 기존에 적재된 가구 데이터 체크포인트 스캔 중...")
    existing_ids = set()
    try:
        # 기존 등록된 모든 ID 획득 (ids 필드만 가볍게 조회)
        existing_data = collection.get(include=[])
        if existing_data and 'ids' in existing_data:
            existing_ids = set(existing_data['ids'])
        print(f"✅ 스캔 완료: 기존에 인덱싱된 가구 상품 {len(existing_ids)}개 감지")
    except Exception as e:
        print(f"⚠️ 기존 데이터 조회 중 오류(최초 기동일 수 있음): {e}")

    # 기존 적재 데이터 텍스트 임베딩 마이그레이션 수행
    if existing_ids:
        migrate_existing_metadata(collection, clip_service)

    # 5. CSV 파일 로드 및 적재할 항목 전처리
    items_to_process = []
    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            pid = row.get("product_id")
            if not pid:
                continue
            # 이미 적재된 아이템은 중복 다운로드/임베딩 연산을 방지하기 위해 스킵
            if pid in existing_ids:
                continue
            items_to_process.append(row)

    total_count = len(items_to_process)
    if total_count == 0:
        print("🎉 [Ingest Skip] 모든 수집 가구 데이터가 이미 벡터 DB에 완벽히 저장되어 있습니다!")
        return

    print(f"📦 신규 인덱싱 대상 상품 수: {total_count}개 / {total_count + len(existing_ids)}개")
    print("⏳ 대량 이미지 다운로드 및 CLIP 피처 맵 임베딩 연산을 시작합니다...")

    # 배치 업로드 설정 단위
    BATCH_SIZE = 20
    batch_embeddings = []
    batch_metadatas = []
    batch_ids = []
    batch_documents = [] # 상품명 수색을 위한 백업 도큐먼트

    success_count = 0
    fail_count = 0

    # tqdm을 통한 실시간 진척도 프로그레스 바 표시
    for idx, item in enumerate(tqdm(items_to_process, desc="벡터 DB 인덱싱 진행도")):
        pid = item["product_id"]
        img_url = item.get("image_url")
        pname = item.get("product_name", "이름 없음 가구")

        if not img_url:
            fail_count += 1
            continue

        # 6. 이미지 파일 스트림 다운로드
        img_loaded = False
        pil_img = None
        for attempt in range(2): # 일시적 타임아웃/네트워크 유실 대응용 최대 2회 재시도
            try:
                resp = requests.get(img_url, timeout=3.0)
                if resp.status_code == 200:
                    pil_img = Image.open(BytesIO(resp.content)).convert("RGB")
                    img_loaded = True
                    break
            except Exception:
                time.sleep(0.5)
                continue

        if not img_loaded or not pil_img:
            # print(f"⚠️ [다운로드 실패] 상품 ID: {pid} (URL: {img_url})")
            fail_count += 1
            continue

        # 7. CLIPService를 통한 이미지 임베딩 추출 (512차원 L2 정규화 벡터)
        try:
            embedding = clip_service.get_image_embedding(pil_img)
            if not embedding:
                fail_count += 1
                continue
        except Exception as emb_err:
            # print(f"⚠️ [임베딩 실패] 상품 ID: {pid} : {emb_err}")
            fail_count += 1
            continue

        # 8. 텍스트 정보 기반 설명 결합 텍스트 생성 및 텍스트 임베딩 추출
        categories = [item.get(f"category{i}", "") for i in range(1, 5)]
        categories_str = " > ".join([c for c in categories if c])
        brand_str = item.get("brand", "")
        
        text_parts = [pname]
        if brand_str:
            text_parts.append(f"[브랜드: {brand_str}]")
        if categories_str:
            text_parts.append(f"[카테고리: {categories_str}]")
        combine_text = " ".join(text_parts)
        
        try:
            text_embedding = clip_service.get_text_embedding(combine_text)
            if not text_embedding:
                text_embedding = []
        except Exception as txt_err:
            text_embedding = []
            # print(f"⚠️ [텍스트 임베딩 실패] 상품 ID: {pid} : {txt_err}")

        # 9. 메타데이터 사전 가공 (NaN/Null 방어 및 문자열 포맷팅)
        metadata = {
            "id": item.get("id", ""),
            "product_id": pid,
            "product_name": pname,
            "image_url": img_url,
            "price": item.get("price", "0"),
            "mall_name": item.get("mall_name", ""),
            "link": item.get("link", ""),
            "category1": item.get("category1", ""),
            "category2": item.get("category2", ""),
            "category3": item.get("category3", ""),
            "category4": item.get("category4", ""),
            "brand": item.get("brand", ""),
            "text_embedding": json.dumps(text_embedding)
        }

        # 배치 버퍼에 수집
        batch_embeddings.append(embedding)
        batch_metadatas.append(metadata)
        batch_ids.append(pid)
        batch_documents.append(pname) # 텍스트 질의 매칭 및 메타 필터링용

        success_count += 1

        # 9. 배치 임계치 도달 시 Chroma DB 벌크 적재
        if len(batch_ids) >= BATCH_SIZE or (idx == total_count - 1):
            if batch_ids:
                try:
                    collection.add(
                        embeddings=batch_embeddings,
                        metadatas=batch_metadatas,
                        ids=batch_ids,
                        documents=batch_documents
                    )
                except Exception as db_err:
                    print(f"\n❌ [Chroma Write Error] 배치 적재 실패: {db_err}")
                    success_count -= len(batch_ids)
                    fail_count += len(batch_ids)
                
                # 버퍼 초기화
                batch_embeddings = []
                batch_metadatas = []
                batch_ids = []
                batch_documents = []

    print("\n" + "=" * 60)
    print("🏁 [Furniture Ingest] 인덱싱 완료")
    print(f"  - 성공 수: {success_count}개")
    print(f"  - 실패 수: {fail_count}개")
    print(f"  - 총 컬렉션 가구 수: {collection.count()}개")
    print("=" * 60)

if __name__ == "__main__":
    ingest()
