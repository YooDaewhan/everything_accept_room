# 멀티플레이어 2D 웹게임

Phaser 3 + Socket.io + Next.js를 사용한 실시간 멀티플레이어 게임

## 설치

```bash
# 루트 폴더에서
npm install

# 서버 폴더에서
cd server
npm install
```

## 실행 방법

### 방법 1: 한 번에 실행 (추천)
```bash
npm run dev:all
```

### 방법 2: 따로 실행
```bash
# 터미널 1 - 프론트엔드
npm run dev

# 터미널 2 - 소켓 서버
npm run dev:server
```

## 접속

- **게임 클라이언트**: http://localhost:3000
- **소켓 서버**: http://localhost:3001

## 테스트 방법

1. 브라우저 창을 2개 이상 열기
2. 각각 http://localhost:3000 접속
3. 로그인 후 게임 화면으로 이동
4. 한 창에서 캐릭터를 움직이면 다른 창에서도 보임!

## 기능

### 싱글플레이어 (기존)
- ✅ 로그인 화면
- ✅ WASD/방향키 이동
- ✅ 카메라 추적

### 멀티플레이어 (새로 추가)
- ✅ 실시간 다중 접속
- ✅ 플레이어 위치 동기화
- ✅ 접속/퇴장 알림
- ✅ 각 플레이어 구분 (초록색: 나, 파란색: 다른 플레이어)

## 기술 스택

**프론트엔드**
- Next.js 16
- Phaser 3
- Socket.io-client
- TypeScript

**백엔드**
- Node.js
- Express
- Socket.io
- CORS

## 프로젝트 구조

```
everything_accept_room/
├── app/
│   ├── login/
│   │   └── page.tsx        # 로그인 화면
│   ├── game/
│   │   └── page.tsx        # 멀티플레이어 게임
│   └── page.tsx            # 메인 (리다이렉트)
│
├── server/
│   ├── index.js            # Socket.io 서버
│   └── package.json        # 서버 dependencies
│
└── package.json            # 클라이언트 dependencies
```

## Socket.io 이벤트

### 클라이언트 → 서버
- `playerMovement`: 플레이어 위치 업데이트

### 서버 → 클라이언트
- `currentPlayers`: 현재 접속한 모든 플레이어 목록
- `newPlayer`: 새 플레이어 접속 알림
- `playerMoved`: 다른 플레이어 이동 알림
- `playerDisconnected`: 플레이어 퇴장 알림

## 성능 최적화

- 별도 프로세스로 소켓 서버 실행 (Next.js와 독립)
- 프레임마다 위치 전송 (60 FPS 동기화)
- 브로드캐스트로 효율적인 메시지 전달

## 다음 개발 예정

- [ ] 플레이어 닉네임 표시
- [ ] 채팅 시스템
- [ ] 맵 충돌 처리
- [ ] 몬스터/NPC 추가
- [ ] 인벤토리 시스템
- [ ] PVP 전투
