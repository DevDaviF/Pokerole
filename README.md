# Pokerole v2

Monorepo com frontend Next.js e backend NestJS.

## Estrutura

```
pokerole-v2/
├── frontend/          # Next.js (App Router) + shadcn/ui
├── backend/           # NestJS (API)
└── README.md
```

### Frontend

```
frontend/
├── app/
│   ├── (auth)/login/
│   ├── (dashboard)/
│   │   ├── dashboard/
│   │   ├── clientes/
│   │   └── relatorios/
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── ui/
│   ├── layout/
│   └── shared/
├── features/
│   ├── clientes/
│   ├── relatorios/
│   └── autenticacao/
├── lib/
│   ├── api/
│   ├── auth/
│   └── utils/
├── hooks/
└── types/
```

### Backend

```
backend/
├── src/
│   ├── modules/
│   │   ├── clientes/
│   │   ├── relatorios/
│   │   └── autenticacao/
│   ├── database/
│   ├── config/
│   ├── middlewares/
│   └── main.ts
└── package.json
```

## Como rodar

### Frontend (porta 3000)

```bash
cd frontend
npm install
npm run dev
```

### Backend (porta 3001)

```bash
cd backend
npm install
npm run start:dev
```

Pela raiz:

```bash
npm run dev:frontend
npm run dev:backend
```

## API

- `GET /api/health`
- `POST /api/auth/login`
- `GET /api/clientes`
- `GET /api/relatorios/resumo`

Configure a URL da API no frontend com `NEXT_PUBLIC_API_URL` (padrão: `http://localhost:3001`).
