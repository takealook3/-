# utils.py
# ─────────────────────────────────────────────────────────────────────────────
# 형태소 분석기(Kiwi) 연동 토크나이저 및 ChromaDB 문서 변환 함수 등
# 검색기와 적재기에서 공용으로 사용하는 유틸리티 함수들을 모은 모듈입니다.
# ─────────────────────────────────────────────────────────────────────────────

import sys
from typing import List
from kiwipiepy import Kiwi
from langchain_core.documents import Document

# Kiwi 형태소 분석기 전역 인스턴스 초기화
kiwi = Kiwi()

def kiwi_tokenize(text: str) -> List[str]:
    """
    Kiwi를 사용하여 한국어 텍스트를 형태소 단위로 토큰화합니다.
    검색 퀄리티를 향상하기 위해 명사(NN), 용언(V), 외국어(SL) 범위의 유의미한 형태소만 추출합니다.
    """
    return [token.form for token in kiwi.tokenize(text) if token.tag.startswith(('NN', 'V', 'SL'))]


def get_all_documents_from_chroma(db) -> List[Document]:
    """
    지정된 ChromaDB 인스턴스의 컬렉션에서 전체 데이터를 긁어와
    BM25Retriever가 읽을 수 있는 LangChain Document 객체 리스트로 복원하여 반환합니다.
    """
    data = db.get()
    documents = []
    if data and "documents" in data and data["documents"]:
        for text, meta in zip(data["documents"], data["metadatas"]):
            documents.append(Document(page_content=text, metadata=meta))
    return documents
