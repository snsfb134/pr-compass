# PR Compass

캐나다 영주권 준비 과정에서 필요한 공식 이민 정보를 한곳에서 추적하고, 변화 신호를 빠르게 확인할 수 있도록 만든 개인 프로젝트입니다.

PR Compass는 흩어져 있는 이민 정책 페이지를 주기적으로 확인하고, 변경 이력을 저장하고, 사용자 프로필 기준으로 어떤 변화가 더 중요한지 보여주는 것을 목표로 합니다.

## Why This Project

캐나다 이민 정보는 IRCC, WelcomeBC 등 여러 공식 사이트에 분산되어 있고, 실제로 중요한 변경이 생겨도 사용자가 직접 모든 페이지를 반복 확인해야 하는 불편이 있습니다.

이 프로젝트는 아래 문제를 해결하는 데 초점을 맞췄습니다.

- 공식 소스 변경 여부를 자동으로 추적
- 변경 이력을 저장해 나중에 비교 가능하도록 구성
- 사용자 상황에 따라 어떤 변화가 더 중요한지 분리해서 전달
- 단순 정보 나열이 아니라 "지금 확인할 것" 중심의 흐름 제공

## Current Status

현재 구현된 범위는 다음과 같습니다.

- FastAPI 기반 백엔드
- Next.js 기반 프론트엔드
- 공식 이민 페이지 주기 점검
- 스냅샷 및 변경 이력 저장
- 개인 프로필 입력 및 잠금/해제 흐름
- 공개 신호 / 개인 영향 분리 UI
- 로컬 환경 기준 운영 점검 스크립트

아직 AI 요약 기능은 실제 서비스 흐름에 연결하지 않았습니다.
향후 변경 내용 요약과 사용자 맞춤 해석 기능은 `Gemini` 무료 버전을 활용해 붙일 계획입니다.

## Planned Gemini Integration

추가 예정인 기능은 아래와 같습니다.

- 변경된 공식 문서 핵심 요약
- 이전 상태 대비 무엇이 달라졌는지 정리
- 사용자 프로필 기준 영향 포인트 설명
- 다음 확인 행동 제안

초기 버전은 비용 부담을 줄이기 위해 `Gemini` 무료 버전을 기준으로 검토하고 있습니다.

## Tech Stack

- Backend: FastAPI, Python, SQLite
- Frontend: Next.js, React, TypeScript, Tailwind CSS
- Data/Monitoring: scheduled checks, snapshot storage, change history tracking

## Project Structure

```text
app/        FastAPI backend
web/        Next.js frontend
scripts/    monitoring and QA scripts
data/       local runtime data (ignored in Git)
```

## Getting Started

### 1. Backend

```bash
git clone <your-repository-url>
cd pr-compass
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8010
```

### 2. Frontend

```bash
cd web
yarn install
yarn dev
```

### 3. Open in Browser

- Frontend: `http://127.0.0.1:3000`
- Backend API: `http://127.0.0.1:8010`

## Notes

- 이 프로젝트는 공식 이민 정보를 더 쉽게 추적하기 위한 도구이며, 법률 자문을 제공하지 않습니다.
- 로컬 DB, 로그, 스냅샷, 환경 파일 등 실행 산출물은 공개 저장소에 포함하지 않도록 설정했습니다.

## Roadmap

- Gemini 기반 변경 요약 및 해석 기능 연결
- 주요 이민 스트림별 신호 분류 고도화
- 사용자별 알림 우선순위 개선
- 배포 가능한 데모 환경 정리
