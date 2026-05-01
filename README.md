# church-docs

예수 그리스도 후기 성도 교회 공문 작성 시스템

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | React + Vite (Firebase Hosting) |
| Backend API | Firebase Functions Python (Flask) |
| Database | Firestore |
| AI | OpenAI GPT-4o |
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
└── .firebaserc
```

## 로고 교체

`apps/web/public/img/logo.webp` 파일을 교회 로고 이미지로 교체하면 됩니다.
권장 크기: 200×200px 이상 정사각형

## 로컬 개발

### 1. 환경변수 설정

```bash
cp .env.example apps/functions/.env
# .env 파일에 실제 값 입력
```

### 2. Node 의존성 설치

```bash
npm install
```

### 3. Python 의존성 설치

```bash
cd apps/functions
pip install -r requirements.txt
```

### 4. Firebase Emulator 실행

```bash
firebase emulators:start --only hosting,functions
```

또는 프론트엔드만 개발 시:

```bash
npm run dev  # turbo dev → apps/web 개발 서버 (localhost:5173)
```

> 개발 서버는 `/api` 요청을 `localhost:5001`로 프록시합니다.

## 배포

```bash
# 1. 프론트엔드 빌드
npm run build

# 2. Firebase 배포
firebase deploy
```

## Firestore 보안 규칙

Firebase 콘솔 > Firestore > 규칙에서 아래 설정:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /documents/{docId} {
      // 공개 문서는 누구나 읽기 가능
      allow read: if resource.data.is_published == true;
      // 쓰기는 API(Functions)에서만 (Admin SDK 사용)
      allow write: if false;
    }
  }
}
```

## 환경변수 (Firebase Functions)

Firebase 콘솔 또는 CLI로 설정:

```bash
firebase functions:secrets:set ADMIN_PASSWORD
firebase functions:secrets:set SECRET_KEY
firebase functions:secrets:set OPENAI_API_KEY
```

또는 `apps/functions/.env` 파일 사용 (로컬 개발용).
