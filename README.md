# Oh My Mines 💣

대규모 멀티플레이어 지뢰찾기 게임

## 기술 스택

- **Frontend**: React 18 + TypeScript + Canvas API + Zustand
- **Backend**: Node.js + Express + Socket.io
- **Cache**: Redis (선택적)
- **Monorepo**: npm workspaces

## 설치 및 실행

### 1. 의존성 설치

```bash
npm install
```

### 2. 공유 모듈 빌드

```bash
npm run build:shared
```

### 3. 서버 실행

```bash
# 터미널 1
cd server
npm run dev
```

서버가 `http://localhost:3001`에서 실행됩니다.

### 4. 클라이언트 실행

```bash
# 터미널 2
cd client
npm run dev
```

클라이언트가 `http://localhost:5173`에서 실행됩니다.

### 5. (선택) Redis 실행

Redis가 설치되어 있다면 자동으로 연결됩니다. 없어도 게임은 정상 작동합니다.

```bash
redis-server
```

## 게임 플레이

### 기본 조작
- **좌클릭**: 셀 공개
- **우클릭**: 깃발 설치/제거
- **Shift + 드래그**: 맵 이동
- **마우스 휠**: 줌 인/아웃
- **WASD / 화살표**: 맵 이동
- **1-6**: 스킬 사용

### 스킬
| 키 | 스킬 | 쿨다운 | 효과 |
|---|------|--------|------|
| 1 | 🔍 스캔 | 30초 | 3x3 영역의 지뢰 위치 표시 |
| 2 | 🛡️ 보호막 | 60초 | 다음 폭탄 1회 무효화 |
| 3 | ⚡ 연쇄 | 45초 | 숫자 셀도 주변 안전셀 자동 공개 |
| 4 | 👁️ 투시 | 90초 | 5x5 영역 완전 공개 |
| 5 | 🎯 마킹 | 20초 | 지뢰 1개 확정 표시 |
| 6 | 💨 이동속도 | 15초 | 10초간 빠른 맵 이동 |

### 영역(Zone) 시스템
- 🟢 안전지대 (5%): 튜토리얼
- 🔵 초급 (10%): 기본 보상
- 🟡 중급 (15%): 2배 보상
- 🟠 고급 (20%): 3배 보상
- 🔴 위험지대 (25%): 5배 보상
- 🟣 미스터리: 특수 이벤트

### 아이템
셀 공개 시 확률적으로 드롭:
- ⏱️ 쿨다운 감소 (5%)
- 💎 더블 포인트 (3%)
- 🧲 자석 (2%)
- 🎁 미스터리 박스 (1%)
- 👻 유령 모드 (0.5%)

### 길드 시스템
- 길드 생성 및 가입 가능
- 멤버 수에 따른 버프:
  - 5명+: 점수 +5%
  - 10명+: 쿨다운 -10%
  - 20명+: 아이템 드롭률 +20%

## 프로젝트 구조

```
ohMyMines/
├── client/          # React 프론트엔드
│   ├── src/
│   │   ├── components/   # UI 컴포넌트
│   │   ├── hooks/        # React 훅
│   │   ├── stores/       # Zustand 스토어
│   │   └── canvas/       # 캔버스 렌더링
├── server/          # Node.js 백엔드
│   ├── src/
│   │   ├── game/         # 게임 로직
│   │   ├── socket/       # 소켓 핸들러
│   │   └── redis/        # Redis 연결
├── shared/          # 공유 타입/상수
│   └── src/
│       ├── types.ts      # 타입 정의
│       ├── constants.ts  # 게임 상수
│       └── achievements.ts # 업적 정의
└── package.json     # 모노레포 루트
```

## 세션 종료 조건
1. 전체 지뢰의 30% 이상 폭발
2. 맵의 80% 이상 공개 완료
3. 24시간 경과

## 환경 변수

### 서버 (server/.env)
```
PORT=3001
REDIS_URL=redis://localhost:6379
CLIENT_URL=http://localhost:5173
```

### 클라이언트 (client/.env)
```
VITE_SOCKET_URL=http://localhost:3001
```

## 검증 방법

### 로컬 개발 테스트
1. 서버 실행 (`cd server && npm run dev`)
2. 클라이언트 실행 (`cd client && npm run dev`)
3. 여러 브라우저 탭에서 http://localhost:5173 접속

### 기능 테스트 체크리스트
- [ ] 셀 클릭 → 모든 클라이언트 동기화
- [ ] 폭탄 터뜨리기 → 점수 감소 + 알림
- [ ] 스킬 사용 → 쿨다운 표시 + 효과 적용
- [ ] 아이템 획득 → 인벤토리에 추가
- [ ] 업적 달성 → 알림 + 저장
- [ ] 길드 가입 → 버프 적용 확인
- [ ] 세션 종료 조건 → 새 세션 시작

## 라이센스

MIT
