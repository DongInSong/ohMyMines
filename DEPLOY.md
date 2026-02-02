# 배포 가이드

## 아키텍처

```
┌─────────────────┐     WebSocket     ┌─────────────────┐
│     Vercel      │◄──────────────────│    Railway      │
│    (Client)     │                   │    (Server)     │
│  React + Vite   │                   │  Node + Socket  │
└─────────────────┘                   └────────┬────────┘
                                               │
                                               ▼
                                      ┌─────────────────┐
                                      │  Railway Redis  │
                                      │   (Optional)    │
                                      └─────────────────┘
```

## Step 1: GitHub에 코드 푸시

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/your-username/oh-my-mines.git
git push -u origin main
```

## Step 2: Railway에 서버 배포

1. [Railway](https://railway.app)에 가입/로그인
2. "New Project" → "Deploy from GitHub repo" 선택
3. `oh-my-mines` 저장소 선택
4. 설정:
   - **Root Directory**: `/` (루트)
   - **Build Command**: `npm install && npm run build:shared && npm run build:server`
   - **Start Command**: `npm start`

5. 환경 변수 설정 (Railway 대시보드에서):
   ```
   PORT=3001
   CLIENT_URL=https://your-app.vercel.app
   ```

6. (선택) Redis 추가:
   - "New" → "Database" → "Add Redis"
   - `REDIS_URL`이 자동으로 설정됨

7. 배포 후 URL 복사 (예: `https://oh-my-mines-server.railway.app`)

## Step 3: Vercel에 클라이언트 배포

1. [Vercel](https://vercel.com)에 가입/로그인
2. "Add New Project" → GitHub 저장소 선택
3. 설정:
   - **Framework Preset**: Vite
   - **Root Directory**: `client`
   - **Build Command**: `cd .. && npm install && npm run build:shared && cd client && npm run build`
   - **Output Directory**: `dist`

4. 환경 변수 설정:
   ```
   VITE_SOCKET_URL=https://oh-my-mines-server.railway.app
   ```

5. "Deploy" 클릭

## Step 4: CORS 설정 업데이트

Railway에서 `CLIENT_URL` 환경 변수를 Vercel URL로 업데이트:

```
CLIENT_URL=https://your-app.vercel.app
```

## 환경 변수 요약

### Railway (서버)
| 변수 | 값 | 필수 |
|------|-----|------|
| `PORT` | `3001` | ✅ |
| `CLIENT_URL` | Vercel URL | ✅ |
| `REDIS_URL` | 자동 설정됨 | ❌ |

### Vercel (클라이언트)
| 변수 | 값 | 필수 |
|------|-----|------|
| `VITE_SOCKET_URL` | Railway URL | ✅ |

## 대안 플랫폼

### 서버 배포 대안
- **Render**: https://render.com (무료 티어 있음)
- **Fly.io**: https://fly.io (WebSocket에 최적화)
- **DigitalOcean App Platform**

### 풀스택 대안
- **Render**: 프론트엔드 + 백엔드 둘 다 배포 가능
- **Railway**: 프론트엔드도 배포 가능

## 문제 해결

### WebSocket 연결 실패
1. `VITE_SOCKET_URL`이 올바른지 확인
2. Railway 서버가 실행 중인지 확인
3. CORS 설정의 `CLIENT_URL`이 올바른지 확인

### 빌드 실패
1. `shared` 패키지가 먼저 빌드되는지 확인
2. 로컬에서 `npm run build` 테스트

### Redis 연결 실패
- Redis는 선택사항입니다. 없어도 게임이 작동합니다.
- 데이터 지속성이 필요하면 Railway에서 Redis 추가
