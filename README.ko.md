# PR Compass

English version: [README.md](./README.md)

PR Compass는 캐나다 이민 공식 업데이트를 매번 직접 확인하기 어려운 한국어 사용자를 위한 **AI 보조 브리핑 구독 서비스**입니다.

현재 MVP 범위는 **BC PNP + Express Entry**입니다. WelcomeBC와 IRCC 공식 소스를 확인하고, 새 기록을 과거 데이터와 비교한 뒤, 짧은 이메일 브리핑과 구독자 전용 원페이지 분석으로 보여주는 흐름을 목표로 합니다.

> PR Compass는 공식 정보를 더 쉽게 읽도록 돕는 도구이며, 법률 자문을 제공하지 않습니다.

## 제품 방향

초기에는 개인 프로필, CRS, PNP 경로 비교 대시보드까지 실험했지만, 현재 제품 방향은 더 단순합니다.

- 공개 랜딩은 구독 전환에 집중
- 이름, 이메일, 소속만으로 구독 시작
- 새 공식 업데이트가 있으면 이메일로 짧게 안내
- 자세한 분석은 이메일 링크로 연결되는 원페이지에서 확인
- BC PNP와 Express Entry를 항상 함께 비교
- Gemini 연결 전에는 과거 공식 데이터를 replay해서 분석 품질을 검증

제품명은 **PR Compass**를 유지하고, **Your True North**는 메인 브랜드명이 아니라 작은 보조 슬로건으로만 사용합니다.

## 작동 흐름

```text
공식 소스 확인
  -> 신규/변경 공식 데이터 감지
  -> 구조화 records 및 changes 저장
  -> 브리핑 입력 데이터 구성
  -> heuristic/agent 분석 provider 실행
  -> PR Compass 브리핑 스키마로 정규화
  -> 이메일 미리보기 / 발송 큐 생성
  -> 구독자 원페이지 갱신
```

Gemini는 이후 운영 분석 provider로 연결할 예정입니다. 중요한 원칙은 Gemini가 공식 데이터를 만드는 것이 아니라, extractor가 만든 공식 records와 changes를 바탕으로 해석, 비교, 요약만 수행한다는 점입니다.

## 현재 구현 범위

- BC PNP + Express Entry 구독형 랜딩 페이지
- 구독 폼: 이름, 이메일, 소속
- `/briefing/sample` 샘플 브리핑 페이지
- `/briefing/[token]` 구독자 브리핑 페이지
- `/admin/briefings` 운영자 브리핑 검토 페이지
- FastAPI 기반 공식 소스 체크, 스냅샷, 변경 이력, 공식 records 저장
- SQLite 기반 briefing runs 및 email queue
- mock outbox, SMTP 발송, Resend 연동 준비
- 과거 공식 데이터 replay QA 스크립트
- Gemini 연결 전 provider contract 검증

기존 프로필, CRS, 시뮬레이터, 경로 비교 화면은 코드에 일부 남아 있을 수 있지만 현재 주력 제품 흐름은 아닙니다.

## 기술 스택

- Backend: FastAPI, Python, SQLite
- Frontend: Next.js, React, TypeScript, Tailwind CSS
- Data: source snapshots, structured official records, briefing runs, email queue
- Email: mock outbox, SMTP, optional Resend integration
- Planned AI provider: Gemini

## 프로젝트 구조

```text
app/        FastAPI 백엔드와 브리핑 파이프라인
web/        Next.js 프론트엔드, 랜딩, 구독자 브리핑, 운영자 검토 화면
scripts/    소스 체크, replay QA, 이메일 발송 유틸리티
data/       로컬 DB, 스냅샷, 생성 리포트 등 런타임 데이터
docs/       로컬 기획/운영 설계 문서
```

## 로컬 실행

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

### 3. 브라우저에서 확인

- 랜딩: `http://127.0.0.1:3000`
- 샘플 브리핑: `http://127.0.0.1:3000/briefing/sample`
- 운영자 브리핑 검토: `http://127.0.0.1:3000/admin/briefings`
- Backend API: `http://127.0.0.1:8010`

## 환경 변수

프론트엔드와 이메일 테스트 환경은 `web/.env.example`을 기준으로 설정합니다.

프론트엔드에서 백엔드 API를 호출하려면 아래 값이 필요합니다.

```bash
NEXT_PUBLIC_API_BASE_URL="http://127.0.0.1:8010"
```

SMTP 발송 테스트를 할 경우 아래 값을 설정합니다.

```bash
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USERNAME=""
SMTP_PASSWORD=""
SMTP_FROM_EMAIL="PR Compass <your-email@example.com>"
SMTP_USE_SSL="false"
```

실제 계정 정보와 `.env` 파일은 GitHub에 올리지 않습니다.

## 자주 쓰는 명령어

프론트엔드 빌드:

```bash
yarn --cwd web build
```

공식 소스 1회 체크:

```bash
.venv/bin/python scripts/check_once.py
```

과거 데이터 전체 replay QA:

```bash
.venv/bin/python scripts/replay_historical_update_flow.py --all --summary-only --pretty
```

분석 provider 계약 검증:

```bash
.venv/bin/python scripts/test_analysis_provider_contract.py
```

테스트 브리핑 메일 발송 또는 mock outbox 생성:

```bash
.venv/bin/python scripts/send_test_briefing_email.py --recipient-email you@example.com --scenarios 1 --pretty
```

## Gemini 연결 전 체크

Gemini를 붙이기 전에 아래 항목이 먼저 안정적이어야 합니다.

- 공식 소스 최신성 확인
- BC PNP / Express Entry 구조화 records 정확도 확인
- 과거 데이터 전체 replay 통과
- provider strict JSON 계약 검증
- 이메일 발송 문구 검토
- mock/SMTP 발송 테스트
- 구독자 브리핑 페이지가 같은 normalized schema를 읽는지 확인

## 로드맵

- Gemini를 운영 분석 provider로 연결
- 실제 이메일 발송 전 운영자 승인 흐름 추가
- 업데이트 유형별 이메일 템플릿 고도화
- 변화 없음 / 주간 상태 요약 브리핑 추가
- BC PNP 검증 후 다른 주 PNP로 확장
