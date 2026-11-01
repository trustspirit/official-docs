# church-docs

예수 그리스도 후기 성도 교회 공문 작성 시스템

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | React + Vite (Firebase Hosting) |
| Backend API | Firebase Functions Python (Flask) |
| Database | Firestore |
| 이미지 저장 | Firebase Storage |
| 인증 | Firebase Authentication (Google 로그인) + 이메일 허용 목록 |
| AI | Anthropic Claude (기본) / OpenAI GPT-4o (`AI_PROVIDER`로 전환) |
| Monorepo | Turborepo |

## 프로젝트 구조

```
church-docs/
├── apps/
│   ├── web/          # React + Vite 프론트엔드
│   └── functions/    # Firebase Functions Python API
├── turbo.json
├── package.json
├── firebase.json
├── firestore.rules / firestore.indexes.json
├── storage.rules
└── .firebaserc
```

## 로고 교체

`apps/web/public/img/logo.webp` 파일을 교회 로고 이미지로 교체하면 됩니다.
현재 로고는 공문(Communication Library) PDF에서 추출한 이미지(200×395, 투명 배경)입니다. 교체 시 세로가 긴 아치형 로고(글자 포함)를 권장합니다.

## 인증 방식

관리자는 Google 계정으로 로그인합니다. 프론트엔드가 Firebase Auth로 로그인해 ID 토큰을 받고, 백엔드는 토큰을 검증한 뒤 다음을 모두 만족할 때만 관리자로 인정합니다.

- 로그인 제공자가 `google.com`
- 이메일이 인증됨 (`email_verified`)
- 이메일이 `ADMIN_EMAILS`(쉼표로 구분, 대소문자 무시)에 포함됨

## 로컬 개발

### 1. 환경변수 설정

```bash
cp .env.example apps/functions/.env.local     # AI 키, ADMIN_EMAILS 입력
cp apps/web/.env.example apps/web/.env.local  # Firebase 웹 설정 입력
```

`.env.local` 파일은 gitignore 대상이며 절대 커밋하지 않습니다.
(`apps/functions/.env`를 쓰면 `firebase deploy` 때 함께 업로드되므로 사용하지 않습니다.)

### 2. 의존성 설치

```bash
npm install
cd apps/functions && pip install -r requirements.txt
```

### 3. 에뮬레이터로 실행

`apps/web/.env.local`에 `VITE_USE_EMULATOR=true`를 두면 Auth 에뮬레이터(9099)를 사용합니다. 에뮬레이터는 가짜 Google 계정 선택 창을 띄워 줍니다.

```bash
firebase emulators:start --only auth,firestore,storage --project demo-church-docs
npm run dev  # apps/web 개발 서버 (localhost:5173, /api → localhost:5001 프록시)
```

## Firebase 설정 및 배포

1. Firebase 프로젝트를 만들고 Blaze(종량제) 요금제에 연결합니다. (Functions v2 필수)
2. `.firebaserc`의 프로젝트 ID를 실제 값으로 바꿉니다.
3. 콘솔에서 Authentication → Google 제공자를 켭니다. 배포 도메인이 승인된 도메인에 있는지 확인합니다.
4. Firestore, Storage를 생성합니다.
5. 웹 앱을 등록하고 설정 값을 `apps/web/.env.production`에 넣습니다. (`apps/web/.env.example` 참고)
6. 시크릿을 등록합니다.

```bash
firebase functions:secrets:set ANTHROPIC_API_KEY
printf 'admin1@example.com,admin2@example.com' | firebase functions:secrets:set ADMIN_EMAILS --data-file -
firebase functions:secrets:set OPENAI_API_KEY   # OpenAI 사용 시
```

7. 빌드 후 배포합니다.

```bash
npm run build
firebase deploy
```

Firestore/Storage 규칙은 모든 클라이언트 접근을 거부합니다. 모든 읽기/쓰기는 Functions(Admin SDK)를 통해서만 이루어집니다. 복합 인덱스는 `firestore.indexes.json`으로 배포됩니다.
