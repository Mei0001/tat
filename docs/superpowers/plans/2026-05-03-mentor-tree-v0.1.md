# Mentor Tree v0.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ローカル環境で動く Mentor Tree v0.1 を実装する。ユーザーが Magic Link でログイン → 1 種類のプリセットゴールを作成 → モックヒアリング → モックツリー生成 → デイリータスク完了記録までを end-to-end で動かす最小実装。

**Architecture:** Next.js 14 App Router + TypeScript + Tailwind を Cloudflare 互換性を意識した DDD レイヤード（domain / application / infrastructure / presentation）で構築する。Supabase ローカル（PostgreSQL + Auth + RLS）を `supabase start` で立て、Anthropic API は呼ばずモック JSON で代替する。リポジトリはインターフェースを application 層に置き、infrastructure 層で Supabase 実装を提供する。

**Tech Stack:** Next.js 14 / TypeScript 5 / Tailwind CSS / Supabase CLI / Supabase JS Client / Zod / TanStack Query / Zustand / Vitest / Playwright / pnpm

**Source Spec:** `docs/superpowers/specs/2026-05-03-mentor-tree-design.md`

**v0.1 Scope (spec lines 1187-1198):**
- Next.js 14 + Tailwind + TS（ローカル開発のみ）
- Supabase ローカル + 最小 RLS（profiles + goals 各 1 ポリシー）
- Email Magic Link 認証のみ
- プリセットゴール 1 種のみ
- ヒアリング UI（モック JSON で固定質問）
- ツリー画面（モック生成）
- デイリータスク（上スワイプ + キーボードのみ、当日記録のみ）
- `ai_call_logs` テーブルのみ作成（空のまま）

**Out of Scope (defer to v0.2+):**
- Anthropic Claude API 連携
- Cloudflare Workers デプロイ
- 横スワイプ / 端タップ / 取消スタック / 連打防止
- フレームワーク編集
- Garden View / 進捗履歴
- Streak 計算

---

## File Structure

```
tat/
├── package.json
├── tsconfig.json
├── next.config.mjs
├── tailwind.config.ts
├── postcss.config.mjs
├── vitest.config.ts
├── .env.local.example
├── .gitignore
├── supabase/
│   ├── config.toml
│   └── migrations/
│       ├── 0001_initial_schema.sql
│       └── 0002_rls_policies.sql
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                       # トップ → /goals or /login
│   │   ├── globals.css
│   │   ├── login/page.tsx
│   │   ├── auth/callback/route.ts
│   │   ├── goals/
│   │   │   ├── page.tsx                   # ゴール一覧
│   │   │   └── new/page.tsx               # プリセット選択
│   │   ├── hearing/[goalId]/page.tsx      # ヒアリング
│   │   ├── tree/[goalId]/page.tsx         # ツリー画面
│   │   └── today/page.tsx                 # デイリータスク
│   ├── domain/
│   │   ├── value-objects/
│   │   │   ├── user-id.ts
│   │   │   ├── goal-id.ts
│   │   │   ├── goal-label.ts
│   │   │   ├── task-label.ts
│   │   │   └── day-start-hour.ts
│   │   ├── entities/
│   │   │   ├── profile.ts
│   │   │   ├── goal.ts
│   │   │   ├── framework-axis.ts
│   │   │   ├── tree-node.ts
│   │   │   ├── hearing-node.ts
│   │   │   └── task-log.ts
│   │   ├── enums/
│   │   │   ├── node-type.ts
│   │   │   ├── node-status.ts
│   │   │   └── question-status.ts
│   │   └── utils/
│   │       └── logical-date.ts
│   ├── application/
│   │   ├── interfaces/
│   │   │   ├── profile-repository.ts
│   │   │   ├── goal-repository.ts
│   │   │   ├── framework-axis-repository.ts
│   │   │   ├── tree-node-repository.ts
│   │   │   ├── hearing-node-repository.ts
│   │   │   └── task-log-repository.ts
│   │   └── usecases/
│   │       ├── create-goal-from-preset.ts
│   │       ├── start-hearing.ts
│   │       ├── record-hearing-answer.ts
│   │       ├── complete-hearing.ts
│   │       ├── generate-mock-tree.ts
│   │       ├── get-daily-tasks.ts
│   │       ├── complete-task.ts
│   │       └── uncomplete-task.ts
│   ├── infrastructure/
│   │   ├── supabase/
│   │   │   ├── server-client.ts
│   │   │   ├── browser-client.ts
│   │   │   └── types.ts                  # supabase gen types で自動生成
│   │   ├── repositories/
│   │   │   ├── supabase-profile-repository.ts
│   │   │   ├── supabase-goal-repository.ts
│   │   │   ├── supabase-framework-axis-repository.ts
│   │   │   ├── supabase-tree-node-repository.ts
│   │   │   ├── supabase-hearing-node-repository.ts
│   │   │   └── supabase-task-log-repository.ts
│   │   └── mocks/
│   │       ├── question-bank.ts          # ヒアリングのモック質問
│   │       └── tree-template.ts          # ツリーのモックテンプレート
│   ├── presentation/
│   │   ├── components/
│   │   │   ├── HearingCard.tsx
│   │   │   ├── TreeView.tsx
│   │   │   ├── TaskCard.tsx
│   │   │   └── PresetGoalForm.tsx
│   │   ├── hooks/
│   │   │   ├── use-up-swipe.ts
│   │   │   └── use-keyboard-shortcuts.ts
│   │   └── actions/
│   │       ├── create-goal.action.ts
│   │       ├── hearing.action.ts
│   │       ├── tree.action.ts
│   │       └── task.action.ts
│   ├── shared/
│   │   ├── schemas/
│   │   │   ├── question-metadata.ts
│   │   │   ├── answer-metadata.ts
│   │   │   ├── task-metadata.ts
│   │   │   └── tree-node-metadata.ts
│   │   ├── constants/
│   │   │   ├── presets.ts
│   │   │   └── frameworks.ts
│   │   └── errors/
│   │       └── domain-error.ts
│   └── middleware.ts                     # 認証チェック
└── tests/
    ├── domain/
    ├── application/
    └── e2e/
```

---

## Task 0: Project Skeleton

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.mjs`
- Create: `tailwind.config.ts`
- Create: `postcss.config.mjs`
- Create: `vitest.config.ts`
- Create: `.gitignore`
- Create: `.env.local.example`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `src/app/globals.css`

- [ ] **Step 0.1: pnpm 初期化と依存関係追加**

```bash
pnpm init
pnpm add next@14 react@18 react-dom@18 @supabase/supabase-js @supabase/ssr zod @tanstack/react-query zustand
pnpm add -D typescript @types/react @types/node @types/react-dom tailwindcss postcss autoprefixer eslint eslint-config-next vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom
```

Expected: `package.json` と `pnpm-lock.yaml` が生成される。

- [ ] **Step 0.2: TypeScript / Next.js 設定を書く**

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

`next.config.mjs`:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: { serverActions: { bodySizeLimit: '1mb' } },
};
export default nextConfig;
```

`.gitignore`（追記）:

```
node_modules/
.next/
.env.local
.vercel/
*.log
coverage/
```

- [ ] **Step 0.3: Tailwind 初期化**

```bash
pnpm exec tailwindcss init -p
```

`tailwind.config.ts`:

```ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
};
export default config;
```

`src/app/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 0.4: ルートレイアウトとプレースホルダーページを書く**

`src/app/layout.tsx`:

```tsx
import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Mentor Tree',
  description: 'AI-powered goal decomposition',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-white text-gray-900">{children}</body>
    </html>
  );
}
```

`src/app/page.tsx`:

```tsx
import { redirect } from 'next/navigation';

export default function Home() {
  redirect('/login');
}
```

- [ ] **Step 0.5: Vitest 設定**

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
```

`package.json` の `scripts` に以下を追加:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 0.6: 動作確認**

Run: `pnpm dev`
Expected: `http://localhost:3000` にアクセスすると `/login`（まだ存在しないので 404）にリダイレクトされる。エラーが出ないことを確認。

Run: `pnpm typecheck`
Expected: エラーゼロ。

Run: `pnpm test`
Expected: テストがゼロ件で正常終了。

- [ ] **Step 0.7: コミット**

```bash
git add package.json pnpm-lock.yaml tsconfig.json next.config.mjs tailwind.config.ts postcss.config.mjs vitest.config.ts .gitignore src/app/layout.tsx src/app/page.tsx src/app/globals.css
git commit -m "feat: scaffold Next.js 14 + TypeScript + Tailwind + Vitest"
```

---

## Task 1: Supabase Local Setup & Schema

**Files:**
- Create: `supabase/config.toml`（`supabase init` で自動生成）
- Create: `supabase/migrations/0001_initial_schema.sql`
- Create: `supabase/migrations/0002_rls_policies.sql`
- Create: `.env.local.example`
- Modify: `package.json`（scripts 追加）

- [ ] **Step 1.1: Supabase CLI でプロジェクト初期化**

```bash
pnpm add -D supabase
pnpm exec supabase init
```

Expected: `supabase/config.toml` と `supabase/seed.sql` が生成される。

- [ ] **Step 1.2: Supabase ローカルスタック起動**

```bash
pnpm exec supabase start
```

Expected: PostgreSQL / Auth / Storage / Studio が起動し、API URL と anon key が表示される。

- [ ] **Step 1.3: 初期スキーママイグレーションを書く**

`supabase/migrations/0001_initial_schema.sql`:

```sql
-- ======================================================
-- Mentor Tree v0.1 initial schema
-- Spec: docs/superpowers/specs/2026-05-03-mentor-tree-design.md
-- ======================================================

create extension if not exists "uuid-ossp";

-- ---------- profiles ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  avatar_url text,
  day_start_hour smallint not null default 4 check (day_start_hour between 0 and 23),
  timezone text not null default 'Asia/Tokyo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ---------- goals ----------
create table public.goals (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null check (length(label) between 1 and 200),
  description text,
  status text not null default 'active' check (status in ('active','archived','deleted')),
  framework_template text not null default 'preset_default',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index idx_goals_user_id on public.goals(user_id) where deleted_at is null;

-- ---------- framework_axes ----------
create table public.framework_axes (
  id uuid primary key default uuid_generate_v4(),
  goal_id uuid not null references public.goals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  position smallint not null check (position between 1 and 6),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (goal_id, position)
);
create index idx_framework_axes_goal on public.framework_axes(goal_id);

-- ---------- tree_nodes ----------
create table public.tree_nodes (
  id uuid primary key default uuid_generate_v4(),
  goal_id uuid not null references public.goals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  parent_id uuid references public.tree_nodes(id) on delete cascade,
  axis_id uuid references public.framework_axes(id) on delete set null,
  node_type text not null check (node_type in ('goal','sub_goal','method','task')),
  label text not null check (length(label) between 1 and 280),
  status text not null default 'pending' check (status in ('pending','active','completed','skipped')),
  depth smallint not null check (depth between 0 and 4),
  position smallint not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index idx_tree_nodes_goal on public.tree_nodes(goal_id) where deleted_at is null;
create index idx_tree_nodes_parent on public.tree_nodes(parent_id) where deleted_at is null;
create index idx_tree_nodes_user on public.tree_nodes(user_id) where deleted_at is null;

-- ---------- hearing_nodes ----------
-- spec: ヒアリングは tree_nodes と別集約。question/answer のみ。
create table public.hearing_nodes (
  id uuid primary key default uuid_generate_v4(),
  goal_id uuid not null references public.goals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  parent_id uuid references public.hearing_nodes(id) on delete cascade,
  axis_id uuid references public.framework_axes(id) on delete set null,
  node_type text not null check (node_type in ('question','answer')),
  label text not null check (length(label) between 1 and 500),
  status text not null default 'pending' check (status in ('pending','active','answered','skipped')),
  metadata jsonb not null default '{}'::jsonb,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index idx_hearing_nodes_goal on public.hearing_nodes(goal_id) where deleted_at is null;
create index idx_hearing_nodes_parent on public.hearing_nodes(parent_id) where deleted_at is null;
create index idx_hearing_nodes_user on public.hearing_nodes(user_id) where deleted_at is null;

-- ---------- task_logs ----------
create table public.task_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  node_id uuid not null references public.tree_nodes(id) on delete cascade,
  completed_at timestamptz not null default now(),
  day_start_hour_at_completion smallint not null check (day_start_hour_at_completion between 0 and 23),
  timezone_at_completion text not null,
  completed_on date generated always as (
    (completed_at at time zone timezone_at_completion - make_interval(hours => day_start_hour_at_completion))::date
  ) stored,
  note text,
  created_at timestamptz not null default now()
);
create unique index idx_task_logs_unique_per_day
  on public.task_logs(user_id, node_id, completed_on);
create index idx_task_logs_user_date on public.task_logs(user_id, completed_on desc);
create index idx_task_logs_node on public.task_logs(node_id);

-- ---------- ai_call_logs ----------
create table public.ai_call_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete set null,
  model text not null,
  endpoint text not null,
  prompt_tokens integer,
  completion_tokens integer,
  cost_usd numeric(10,6),
  status text not null check (status in ('success','error','timeout')),
  error_message text,
  duration_ms integer,
  created_at timestamptz not null default now()
);
create index idx_ai_call_logs_user_created on public.ai_call_logs(user_id, created_at desc);

-- ---------- updated_at triggers ----------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger trg_goals_updated_at before update on public.goals
  for each row execute function public.touch_updated_at();
create trigger trg_framework_axes_updated_at before update on public.framework_axes
  for each row execute function public.touch_updated_at();
create trigger trg_tree_nodes_updated_at before update on public.tree_nodes
  for each row execute function public.touch_updated_at();
create trigger trg_hearing_nodes_updated_at before update on public.hearing_nodes
  for each row execute function public.touch_updated_at();

-- ---------- aggregate boundary trigger ----------
create or replace function public.enforce_tree_node_aggregate()
returns trigger language plpgsql as $$
declare
  parent_user uuid;
  parent_goal uuid;
begin
  if new.parent_id is not null then
    select user_id, goal_id into parent_user, parent_goal
      from public.tree_nodes where id = new.parent_id;
    if parent_user is null then
      raise exception 'parent tree_node not found';
    end if;
    if parent_user <> new.user_id then
      raise exception 'tree_node user mismatch with parent';
    end if;
    if parent_goal <> new.goal_id then
      raise exception 'tree_node goal mismatch with parent';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_tree_nodes_aggregate
  before insert or update on public.tree_nodes
  for each row execute function public.enforce_tree_node_aggregate();

-- ---------- hearing_nodes invariants ----------
-- 親が question のときだけ answer を許す等の不変条件を DB 側でも担保。
create or replace function public.enforce_hearing_node_invariants()
returns trigger language plpgsql as $$
declare
  parent_user uuid;
  parent_goal uuid;
  parent_type text;
begin
  if new.parent_id is not null then
    select user_id, goal_id, node_type
      into parent_user, parent_goal, parent_type
      from public.hearing_nodes where id = new.parent_id;
    if parent_user is null then
      raise exception 'parent hearing_node not found';
    end if;
    if parent_user <> new.user_id then
      raise exception 'hearing_node user mismatch with parent';
    end if;
    if parent_goal <> new.goal_id then
      raise exception 'hearing_node goal mismatch with parent';
    end if;
    -- answer は必ず question の子。question の子は answer のみ。
    if new.node_type = 'answer' and parent_type <> 'question' then
      raise exception 'answer must have a question parent';
    end if;
    if new.node_type = 'question' and parent_type = 'question' then
      raise exception 'question cannot directly nest under another question';
    end if;
  else
    -- ルートは question のみ（answer 単独存在を禁止）。
    if new.node_type = 'answer' then
      raise exception 'answer cannot be a root node';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_hearing_nodes_invariants
  before insert or update on public.hearing_nodes
  for each row execute function public.enforce_hearing_node_invariants();

-- ---------- logical date helper ----------
create or replace function public.current_logical_date(p_user_id uuid)
returns date language sql stable as $$
  select (
    (now() at time zone p.timezone)
    - make_interval(hours => p.day_start_hour)
  )::date
  from public.profiles p
  where p.id = p_user_id and p.deleted_at is null;
$$;

-- ---------- create_goal_with_axes RPC (atomic) ----------
-- goals INSERT 後 framework_axes bulk INSERT を 1 トランザクションで行う。
-- 途中で失敗した場合は両方 rollback され、片方だけ存在する不整合を防ぐ。
create or replace function public.create_goal_with_axes(
  p_user_id uuid,
  p_label text,
  p_description text,
  p_framework_template text,
  p_axes jsonb
)
returns public.goals language plpgsql security invoker as $$
declare
  inserted public.goals;
  axis jsonb;
begin
  insert into public.goals (user_id, label, description, framework_template)
  values (p_user_id, p_label, p_description, p_framework_template)
  returning * into inserted;

  for axis in select * from jsonb_array_elements(p_axes)
  loop
    insert into public.framework_axes (goal_id, user_id, name, position)
    values (
      inserted.id,
      p_user_id,
      axis ->> 'name',
      (axis ->> 'position')::int
    );
  end loop;

  return inserted;
end;
$$;

-- ---------- profile auto-create on signup ----------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger trg_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

- [ ] **Step 1.4: RLS マイグレーションを書く（v0.1 最小ポリシー）**

`supabase/migrations/0002_rls_policies.sql`:

```sql
-- ======================================================
-- Mentor Tree v0.1 minimal RLS
-- 設計方針: profiles + goals に1ポリシー、子テーブルは
-- 親 goal の非削除を join で確認。
-- ======================================================

alter table public.profiles enable row level security;
alter table public.goals enable row level security;
alter table public.framework_axes enable row level security;
alter table public.tree_nodes enable row level security;
alter table public.hearing_nodes enable row level security;
alter table public.task_logs enable row level security;
alter table public.ai_call_logs enable row level security;

-- profiles: 自分のレコードのみ
create policy profiles_self on public.profiles
  for all
  using (id = auth.uid() and deleted_at is null)
  with check (id = auth.uid());

-- goals: 自分のレコードのみ + 論理削除を見せない
create policy goals_owner on public.goals
  for all
  using (user_id = auth.uid() and deleted_at is null)
  with check (user_id = auth.uid());

-- framework_axes: goal 経由で非削除確認
create policy framework_axes_owner on public.framework_axes
  for all
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.goals g
      where g.id = framework_axes.goal_id
        and g.user_id = auth.uid()
        and g.deleted_at is null
    )
  )
  with check (user_id = auth.uid());

-- tree_nodes: goal 経由で非削除確認
create policy tree_nodes_owner on public.tree_nodes
  for all
  using (
    user_id = auth.uid()
    and deleted_at is null
    and exists (
      select 1 from public.goals g
      where g.id = tree_nodes.goal_id
        and g.user_id = auth.uid()
        and g.deleted_at is null
    )
  )
  with check (user_id = auth.uid());

-- hearing_nodes: goal 経由で非削除確認
create policy hearing_nodes_owner on public.hearing_nodes
  for all
  using (
    user_id = auth.uid()
    and deleted_at is null
    and exists (
      select 1 from public.goals g
      where g.id = hearing_nodes.goal_id
        and g.user_id = auth.uid()
        and g.deleted_at is null
    )
  )
  with check (user_id = auth.uid());

-- task_logs: 親ツリーノードと goal の非削除を確認
create policy task_logs_owner on public.task_logs
  for all
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.tree_nodes n
      join public.goals g on g.id = n.goal_id
      where n.id = task_logs.node_id
        and n.user_id = auth.uid()
        and n.deleted_at is null
        and g.deleted_at is null
    )
  )
  with check (user_id = auth.uid());

-- ai_call_logs: 自分のレコードのみ（v0.1 では空のまま）
create policy ai_call_logs_owner on public.ai_call_logs
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
```

- [ ] **Step 1.5: マイグレーション適用**

```bash
pnpm exec supabase db reset
```

Expected: マイグレーションが順番に適用され「Database reset finished」が表示される。エラーなし。

- [ ] **Step 1.6: 環境変数テンプレート作成**

`.env.local.example`:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase start で表示された anon key>
SUPABASE_SERVICE_ROLE_KEY=<supabase start で表示された service_role key>
```

`.env.local` を `cp .env.local.example .env.local` で作り、実値を埋める。

- [ ] **Step 1.7: package.json scripts 追加**

```json
{
  "scripts": {
    "db:start": "supabase start",
    "db:stop": "supabase stop",
    "db:reset": "supabase db reset",
    "db:types": "supabase gen types typescript --local > src/infrastructure/supabase/types.ts"
  }
}
```

- [ ] **Step 1.8: 型生成**

```bash
mkdir -p src/infrastructure/supabase
pnpm db:types
```

Expected: `src/infrastructure/supabase/types.ts` が生成され、全テーブルの Row / Insert / Update 型が含まれている。

- [ ] **Step 1.9: コミット**

```bash
git add supabase/ .env.local.example src/infrastructure/supabase/types.ts package.json
git commit -m "feat: add Supabase schema with RLS, aggregate triggers, and logical date helper"
```

---

## Task 2: Domain Layer

**Files:**
- Create: `src/domain/enums/node-type.ts`
- Create: `src/domain/enums/node-status.ts`
- Create: `src/domain/enums/question-status.ts`
- Create: `src/domain/value-objects/user-id.ts`
- Create: `src/domain/value-objects/goal-id.ts`
- Create: `src/domain/value-objects/goal-label.ts`
- Create: `src/domain/value-objects/task-label.ts`
- Create: `src/domain/value-objects/day-start-hour.ts`
- Create: `src/domain/entities/profile.ts`
- Create: `src/domain/entities/goal.ts`
- Create: `src/domain/entities/framework-axis.ts`
- Create: `src/domain/entities/tree-node.ts`
- Create: `src/domain/entities/hearing-node.ts`
- Create: `src/domain/entities/task-log.ts`
- Create: `src/domain/utils/logical-date.ts`
- Create: `src/shared/errors/domain-error.ts`
- Create: `src/shared/schemas/question-metadata.ts`
- Create: `src/shared/schemas/answer-metadata.ts`
- Create: `src/shared/schemas/task-metadata.ts`
- Create: `src/shared/schemas/tree-node-metadata.ts`
- Test: `tests/domain/value-objects/goal-label.test.ts`
- Test: `tests/domain/value-objects/day-start-hour.test.ts`
- Test: `tests/domain/utils/logical-date.test.ts`
- Test: `tests/domain/entities/task-log.test.ts`

- [ ] **Step 2.1: DomainError 基底クラスを書く**

`src/shared/errors/domain-error.ts`:

```ts
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainError';
  }
}
```

- [ ] **Step 2.2: Enums を書く**

`src/domain/enums/node-type.ts`:

```ts
export const NodeType = {
  Goal: 'goal',
  SubGoal: 'sub_goal',
  Method: 'method',
  Task: 'task',
} as const;
export type NodeType = (typeof NodeType)[keyof typeof NodeType];
```

`src/domain/enums/node-status.ts`:

```ts
export const NodeStatus = {
  Pending: 'pending',
  Active: 'active',
  Completed: 'completed',
  Skipped: 'skipped',
} as const;
export type NodeStatus = (typeof NodeStatus)[keyof typeof NodeStatus];
```

`src/domain/enums/hearing-node-type.ts`:

```ts
export const HearingNodeType = {
  Question: 'question',
  Answer: 'answer',
} as const;
export type HearingNodeType =
  (typeof HearingNodeType)[keyof typeof HearingNodeType];
```

`src/domain/enums/hearing-status.ts`:

```ts
export const HearingStatus = {
  Pending: 'pending',
  Active: 'active',
  Answered: 'answered',
  Skipped: 'skipped',
} as const;
export type HearingStatus = (typeof HearingStatus)[keyof typeof HearingStatus];
```

`src/domain/enums/question-status.ts`:

```ts
export const QuestionStatus = {
  Pending: 'pending',
  Answered: 'answered',
  Skipped: 'skipped',
} as const;
export type QuestionStatus = (typeof QuestionStatus)[keyof typeof QuestionStatus];
```

- [ ] **Step 2.3: GoalLabel Value Object のテストを書く**

`tests/domain/value-objects/goal-label.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { GoalLabel } from '@/domain/value-objects/goal-label';
import { DomainError } from '@/shared/errors/domain-error';

describe('GoalLabel', () => {
  it('正常な文字列で生成できる', () => {
    const label = GoalLabel.create('英語を流暢に話せるようになる');
    expect(label.value).toBe('英語を流暢に話せるようになる');
  });

  it('前後の空白をトリムする', () => {
    expect(GoalLabel.create('  hello  ').value).toBe('hello');
  });

  it('空文字は DomainError', () => {
    expect(() => GoalLabel.create('')).toThrow(DomainError);
    expect(() => GoalLabel.create('   ')).toThrow(DomainError);
  });

  it('200 文字超は DomainError', () => {
    expect(() => GoalLabel.create('a'.repeat(201))).toThrow(DomainError);
  });
});
```

Run: `pnpm test tests/domain/value-objects/goal-label.test.ts`
Expected: FAIL（モジュールが存在しない）

- [ ] **Step 2.4: GoalLabel を実装してテストを通す**

`src/domain/value-objects/goal-label.ts`:

```ts
import { DomainError } from '@/shared/errors/domain-error';

export class GoalLabel {
  private constructor(public readonly value: string) {}

  static create(raw: string): GoalLabel {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      throw new DomainError('GoalLabel cannot be empty');
    }
    if (trimmed.length > 200) {
      throw new DomainError('GoalLabel must be 200 chars or less');
    }
    return new GoalLabel(trimmed);
  }
}
```

Run: `pnpm test tests/domain/value-objects/goal-label.test.ts`
Expected: PASS（4 件）。

- [ ] **Step 2.5: TaskLabel / UserId / GoalId Value Object を書く**

`src/domain/value-objects/task-label.ts`:

```ts
import { DomainError } from '@/shared/errors/domain-error';

export class TaskLabel {
  private constructor(public readonly value: string) {}

  static create(raw: string): TaskLabel {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      throw new DomainError('TaskLabel cannot be empty');
    }
    if (trimmed.length > 280) {
      throw new DomainError('TaskLabel must be 280 chars or less');
    }
    return new TaskLabel(trimmed);
  }
}
```

`src/domain/value-objects/user-id.ts`:

```ts
import { DomainError } from '@/shared/errors/domain-error';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-7][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class UserId {
  private constructor(public readonly value: string) {}
  static create(raw: string): UserId {
    if (!UUID_RE.test(raw)) {
      throw new DomainError(`UserId must be UUID v1-v7: ${raw}`);
    }
    return new UserId(raw);
  }
}
```

`src/domain/value-objects/goal-id.ts`:

```ts
import { DomainError } from '@/shared/errors/domain-error';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-7][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class GoalId {
  private constructor(public readonly value: string) {}
  static create(raw: string): GoalId {
    if (!UUID_RE.test(raw)) {
      throw new DomainError(`GoalId must be UUID v1-v7: ${raw}`);
    }
    return new GoalId(raw);
  }
}
```

- [ ] **Step 2.6: DayStartHour のテストと実装**

`tests/domain/value-objects/day-start-hour.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DayStartHour } from '@/domain/value-objects/day-start-hour';
import { DomainError } from '@/shared/errors/domain-error';

describe('DayStartHour', () => {
  it('0-23 の範囲は受け入れる', () => {
    expect(DayStartHour.create(0).value).toBe(0);
    expect(DayStartHour.create(4).value).toBe(4);
    expect(DayStartHour.create(23).value).toBe(23);
  });
  it('範囲外は DomainError', () => {
    expect(() => DayStartHour.create(-1)).toThrow(DomainError);
    expect(() => DayStartHour.create(24)).toThrow(DomainError);
  });
  it('小数は DomainError', () => {
    expect(() => DayStartHour.create(4.5)).toThrow(DomainError);
  });
});
```

Run: `pnpm test tests/domain/value-objects/day-start-hour.test.ts`
Expected: FAIL（モジュール未作成）

`src/domain/value-objects/day-start-hour.ts`:

```ts
import { DomainError } from '@/shared/errors/domain-error';

export class DayStartHour {
  private constructor(public readonly value: number) {}

  static create(raw: number): DayStartHour {
    if (!Number.isInteger(raw)) {
      throw new DomainError('DayStartHour must be integer');
    }
    if (raw < 0 || raw > 23) {
      throw new DomainError('DayStartHour must be 0-23');
    }
    return new DayStartHour(raw);
  }
}
```

Run: `pnpm test tests/domain/value-objects/day-start-hour.test.ts`
Expected: PASS（3 件）。

- [ ] **Step 2.7: logical-date ユーティリティのテストと実装**

`tests/domain/utils/logical-date.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { computeLogicalDate } from '@/domain/utils/logical-date';

describe('computeLogicalDate', () => {
  it('day_start_hour=4, JST, 2026-05-03 03:00 → 2026-05-02', () => {
    const at = new Date('2026-05-03T03:00:00+09:00');
    expect(
      computeLogicalDate({ at, dayStartHour: 4, timezone: 'Asia/Tokyo' })
    ).toBe('2026-05-02');
  });

  it('day_start_hour=4, JST, 2026-05-03 04:00 → 2026-05-03', () => {
    const at = new Date('2026-05-03T04:00:00+09:00');
    expect(
      computeLogicalDate({ at, dayStartHour: 4, timezone: 'Asia/Tokyo' })
    ).toBe('2026-05-03');
  });

  it('day_start_hour=0 のときは普通の日付', () => {
    const at = new Date('2026-05-03T23:59:59+09:00');
    expect(
      computeLogicalDate({ at, dayStartHour: 0, timezone: 'Asia/Tokyo' })
    ).toBe('2026-05-03');
  });
});
```

Run: `pnpm test tests/domain/utils/logical-date.test.ts`
Expected: FAIL。

`src/domain/utils/logical-date.ts`:

```ts
type ComputeLogicalDateInput = {
  at: Date;
  dayStartHour: number;
  timezone: string;
};

export function computeLogicalDate(input: ComputeLogicalDateInput): string {
  const { at, dayStartHour, timezone } = input;
  const shifted = new Date(at.getTime() - dayStartHour * 60 * 60 * 1000);
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(shifted);
}
```

Run: `pnpm test tests/domain/utils/logical-date.test.ts`
Expected: PASS（3 件）。

- [ ] **Step 2.8: Profile / Goal / FrameworkAxis Entity を書く**

`src/domain/entities/profile.ts`:

```ts
import { DayStartHour } from '@/domain/value-objects/day-start-hour';
import { UserId } from '@/domain/value-objects/user-id';

export interface ProfileProps {
  id: UserId;
  displayName: string;
  avatarUrl: string | null;
  dayStartHour: DayStartHour;
  timezone: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export class Profile {
  private constructor(public readonly props: ProfileProps) {}
  static reconstruct(props: ProfileProps): Profile {
    return new Profile(props);
  }
}
```

`src/domain/entities/goal.ts`:

```ts
import { GoalId } from '@/domain/value-objects/goal-id';
import { GoalLabel } from '@/domain/value-objects/goal-label';
import { UserId } from '@/domain/value-objects/user-id';

export type GoalStatus = 'active' | 'archived' | 'deleted';

export interface GoalProps {
  id: GoalId;
  userId: UserId;
  label: GoalLabel;
  description: string | null;
  status: GoalStatus;
  frameworkTemplate: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export class Goal {
  private constructor(public readonly props: GoalProps) {}
  static reconstruct(props: GoalProps): Goal {
    return new Goal(props);
  }
}
```

`src/domain/entities/framework-axis.ts`:

```ts
export interface FrameworkAxisProps {
  id: string;
  goalId: string;
  userId: string;
  name: string;
  position: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class FrameworkAxis {
  private constructor(public readonly props: FrameworkAxisProps) {}
  static reconstruct(props: FrameworkAxisProps): FrameworkAxis {
    return new FrameworkAxis(props);
  }
}
```

- [ ] **Step 2.9: TreeNode / HearingNode Entity を書く**

`src/domain/entities/tree-node.ts`:

```ts
import { NodeStatus } from '@/domain/enums/node-status';
import { NodeType } from '@/domain/enums/node-type';

export interface TreeNodeProps {
  id: string;
  goalId: string;
  userId: string;
  parentId: string | null;
  axisId: string | null;
  nodeType: NodeType;
  label: string;
  status: NodeStatus;
  depth: number;
  position: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export class TreeNode {
  private constructor(public readonly props: TreeNodeProps) {}
  static reconstruct(props: TreeNodeProps): TreeNode {
    return new TreeNode(props);
  }
}
```

`src/domain/entities/hearing-node.ts`:

```ts
import { QuestionStatus } from '@/domain/enums/question-status';

export interface HearingNodeProps {
  id: string;
  goalId: string;
  userId: string;
  questionLabel: string;
  answerText: string | null;
  status: QuestionStatus;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}

export class HearingNode {
  private constructor(public readonly props: HearingNodeProps) {}
  static reconstruct(props: HearingNodeProps): HearingNode {
    return new HearingNode(props);
  }
}
```

- [ ] **Step 2.10: TaskLog Entity のテストと実装**

`tests/domain/entities/task-log.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { TaskLog } from '@/domain/entities/task-log';
import { DomainError } from '@/shared/errors/domain-error';

describe('TaskLog', () => {
  const baseProps = {
    id: '00000000-0000-7000-8000-000000000001',
    userId: '00000000-0000-7000-8000-000000000002',
    taskNodeId: '00000000-0000-7000-8000-000000000003',
    completedAt: new Date('2026-05-03T05:00:00+09:00'),
    dayStartHourAtCompletion: 4,
    timezoneAtCompletion: 'Asia/Tokyo',
    completedOn: '2026-05-03',
    note: null,
    createdAt: new Date(),
  };

  it('正常な値で reconstruct できる', () => {
    const log = TaskLog.reconstruct(baseProps);
    expect(log.props.completedOn).toBe('2026-05-03');
  });

  it('completedOn は YYYY-MM-DD 形式である', () => {
    const log = TaskLog.reconstruct(baseProps);
    expect(log.props.completedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('completedOn が YYYY-MM-DD 形式でなければ DomainError', () => {
    expect(() =>
      TaskLog.reconstruct({ ...baseProps, completedOn: '2026/05/03' })
    ).toThrow(DomainError);
    expect(() =>
      TaskLog.reconstruct({ ...baseProps, completedOn: '2026-5-3' })
    ).toThrow(DomainError);
  });

  it('day_start_hour 範囲外は DomainError', () => {
    expect(() =>
      TaskLog.reconstruct({ ...baseProps, dayStartHourAtCompletion: 24 })
    ).toThrow(DomainError);
  });
});
```

Run: `pnpm test tests/domain/entities/task-log.test.ts`
Expected: FAIL。

`src/domain/entities/task-log.ts`:

```ts
import { DomainError } from '@/shared/errors/domain-error';

export interface TaskLogProps {
  id: string;
  userId: string;
  taskNodeId: string;
  completedAt: Date;
  dayStartHourAtCompletion: number;
  timezoneAtCompletion: string;
  completedOn: string;
  note: string | null;
  createdAt: Date;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export class TaskLog {
  private constructor(public readonly props: TaskLogProps) {}
  static reconstruct(props: TaskLogProps): TaskLog {
    if (
      !Number.isInteger(props.dayStartHourAtCompletion) ||
      props.dayStartHourAtCompletion < 0 ||
      props.dayStartHourAtCompletion > 23
    ) {
      throw new DomainError('TaskLog.dayStartHourAtCompletion must be 0-23');
    }
    // completed_on は DB 側で STORED 列だが、reconstruct 時に妥当性を再確認する。
    // 値が壊れていれば Repository マッパーのバグなのでドメイン層で fail-fast。
    if (!ISO_DATE_RE.test(props.completedOn)) {
      throw new DomainError(
        `TaskLog.completedOn must be YYYY-MM-DD: got ${props.completedOn}`
      );
    }
    return new TaskLog(props);
  }
}
```

Run: `pnpm test tests/domain/entities/task-log.test.ts`
Expected: PASS（4 件）。

- [ ] **Step 2.11: Metadata Zod スキーマを書く**

`src/shared/schemas/question-metadata.ts`:

```ts
import { z } from 'zod';

export const QuestionMetadataSchema = z.object({
  axis_position: z.number().int().min(1).max(6).optional(),
  ai_generated: z.boolean().default(false),
  template_id: z.string().optional(),
});
export type QuestionMetadata = z.infer<typeof QuestionMetadataSchema>;
```

`src/shared/schemas/answer-metadata.ts`:

```ts
import { z } from 'zod';

export const AnswerMetadataSchema = z.object({
  question_node_id: z.string().uuid(),
  answered_at: z.string().datetime(),
});
export type AnswerMetadata = z.infer<typeof AnswerMetadataSchema>;
```

`src/shared/schemas/task-metadata.ts`:

```ts
import { z } from 'zod';

export const TaskMetadataSchema = z.object({
  estimated_minutes: z.number().int().positive().optional(),
  recurrence: z.enum(['daily', 'once']).default('daily'),
});
export type TaskMetadata = z.infer<typeof TaskMetadataSchema>;
```

`src/shared/schemas/tree-node-metadata.ts`:

```ts
import { z } from 'zod';
import { AnswerMetadataSchema } from './answer-metadata';
import { QuestionMetadataSchema } from './question-metadata';
import { TaskMetadataSchema } from './task-metadata';

export const TreeNodeMetadataSchema = z.union([
  QuestionMetadataSchema,
  AnswerMetadataSchema,
  TaskMetadataSchema,
  z.object({}).passthrough(),
]);
```

- [ ] **Step 2.12: typecheck と全テスト実行**

Run: `pnpm typecheck`
Expected: エラーゼロ。

Run: `pnpm test`
Expected: ここまでのテスト全件 PASS（合計 ~12 件）。

- [ ] **Step 2.13: コミット**

```bash
git add src/domain/ src/shared/ tests/domain/
git commit -m "feat(domain): add value objects, entities, enums, and metadata schemas"
```

---

## Task 3: Auth — Email Magic Link

**Files:**
- Create: `src/infrastructure/supabase/server-client.ts`
- Create: `src/infrastructure/supabase/browser-client.ts`
- Create: `src/middleware.ts`
- Create: `src/app/login/page.tsx`
- Create: `src/presentation/actions/login.action.ts`
- Create: `src/app/auth/callback/route.ts`

- [ ] **Step 3.1: Supabase クライアントを作成**

`src/infrastructure/supabase/server-client.ts`:

```ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from './types';

export function createSupabaseServerClient() {
  const cookieStore = cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          // Server Component から呼ばれたときは Next.js が cookies().set を禁止して
          // 例外を投げる。Route Handler / Server Action / Middleware では成功する。
          // セッションリフレッシュは middleware.ts が担うので、ここでは握りつぶして OK。
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // ignore: Server Component context
          }
        },
      },
    }
  );
}
```

`src/infrastructure/supabase/browser-client.ts`:

```ts
'use client';
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './types';

export function createSupabaseBrowserClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 3.2: Middleware で認証チェック**

`src/middleware.ts`:

```ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PROTECTED_PATHS = ['/goals', '/hearing', '/tree', '/today'];

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookiesToSet) =>
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          ),
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();

  const requiresAuth = PROTECTED_PATHS.some((p) =>
    req.nextUrl.pathname.startsWith(p)
  );

  if (requiresAuth && !user) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

- [ ] **Step 3.3: Login Server Action を書く**

`src/presentation/actions/login.action.ts`:

```ts
'use server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server-client';

const LoginInputSchema = z.object({
  email: z.string().email(),
});

export async function sendMagicLink(formData: FormData) {
  const parsed = LoginInputSchema.safeParse({
    email: formData.get('email'),
  });
  if (!parsed.success) {
    return { error: 'Invalid email' };
  }
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/auth/callback`,
    },
  });
  if (error) return { error: error.message };
  return { ok: true };
}
```

- [ ] **Step 3.4: Login ページを書く**

`src/app/login/page.tsx`:

```tsx
import { sendMagicLink } from '@/presentation/actions/login.action';

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <h1 className="mb-6 text-2xl font-semibold">Mentor Tree</h1>
      <form action={sendMagicLink} className="space-y-4">
        <label className="block text-sm">
          メールアドレス
          <input
            name="email"
            type="email"
            required
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </label>
        <button
          type="submit"
          className="w-full rounded bg-black py-2 text-white"
        >
          ログインリンクを送る
        </button>
      </form>
      <p className="mt-4 text-xs text-gray-500">
        ローカル開発: メールは Supabase Studio (http://127.0.0.1:54324) の Inbucket で確認。
      </p>
    </main>
  );
}
```

- [ ] **Step 3.5: コールバックルートを書く**

`src/app/auth/callback/route.ts`:

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server-client';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const errorCode = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  // Magic Link が期限切れ・不正な場合は ?error=... が付く。
  // 黙って /goals に飛ばすと「ログインしたつもりが未認証」になり middleware で /login に戻され混乱するので
  // ?error= を保持して /login に戻す。
  if (errorCode) {
    const url = new URL(`${origin}/login`);
    url.searchParams.set('error', errorDescription ?? errorCode);
    return NextResponse.redirect(url);
  }

  if (code) {
    const supabase = createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const url = new URL(`${origin}/login`);
      url.searchParams.set('error', error.message);
      return NextResponse.redirect(url);
    }
  } else {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  return NextResponse.redirect(`${origin}/goals`);
}
```

- [ ] **Step 3.6: 動作確認**

Run: `pnpm dev`

手動確認:
1. `http://localhost:3000` にアクセス → `/login` にリダイレクト
2. メールアドレス入力 → `http://127.0.0.1:54324` (Inbucket) でメール確認
3. リンククリック → `/goals` にリダイレクト（このページはまだ存在しないが 404 でも認証は通っている）

Run: `pnpm typecheck && pnpm lint`
Expected: エラーゼロ。

- [ ] **Step 3.7: コミット**

```bash
git add src/infrastructure/supabase/ src/middleware.ts src/app/login/ src/app/auth/ src/presentation/actions/login.action.ts
git commit -m "feat(auth): add Email Magic Link login with Supabase SSR"
```

---

## Task 4: Goal Preset Creation

**Files:**
- Create: `src/shared/constants/presets.ts`
- Create: `src/shared/constants/frameworks.ts`
- Create: `src/application/interfaces/profile-repository.ts`
- Create: `src/application/interfaces/goal-repository.ts`
- Create: `src/application/interfaces/framework-axis-repository.ts`
- Create: `src/application/usecases/create-goal-from-preset.ts`
- Create: `src/infrastructure/repositories/supabase-profile-repository.ts`
- Create: `src/infrastructure/repositories/supabase-goal-repository.ts`
- Create: `src/infrastructure/repositories/supabase-framework-axis-repository.ts`
- Create: `src/presentation/actions/create-goal.action.ts`
- Create: `src/app/goals/page.tsx`
- Create: `src/app/goals/new/page.tsx`
- Test: `tests/application/usecases/create-goal-from-preset.test.ts`

- [ ] **Step 4.1: Preset 定数を書く**

`src/shared/constants/presets.ts`:

```ts
export const GOAL_PRESETS = [
  {
    id: 'preset_default',
    label: 'デフォルト（汎用）',
    description: '何でも入る汎用プリセット',
  },
] as const;

export type GoalPresetId = (typeof GOAL_PRESETS)[number]['id'];
```

`src/shared/constants/frameworks.ts`:

```ts
export const DEFAULT_FRAMEWORK_AXES = [
  { position: 1, name: 'スキル' },
  { position: 2, name: '習慣' },
  { position: 3, name: '環境' },
] as const;
```

- [ ] **Step 4.2: Repository インターフェースを定義**

`src/application/interfaces/profile-repository.ts`:

```ts
import type { Profile } from '@/domain/entities/profile';

export interface ProfileRepository {
  findById(userId: string): Promise<Profile | null>;
}
```

`src/application/interfaces/goal-repository.ts`:

```ts
import type { Goal } from '@/domain/entities/goal';

export interface CreateGoalInput {
  userId: string;
  label: string;
  description: string | null;
  frameworkTemplate: string;
}

export interface CreateGoalWithAxesInput {
  userId: string;
  label: string;
  description: string | null;
  frameworkTemplate: string;
  axes: ReadonlyArray<{ name: string; position: number }>;
}

export interface GoalRepository {
  /**
   * 単純な goals insert のみ。framework_axes が不要なケース用。
   * トランザクション境界を持たないため、複数テーブル書き込みには
   * createWithAxes を使う。
   */
  create(input: CreateGoalInput): Promise<Goal>;

  /**
   * goals + framework_axes を単一トランザクションで作成。
   * Postgres の create_goal_with_axes RPC を呼び出し、途中失敗時は
   * 全てロールバックされる（part of I2 fix）。
   */
  createWithAxes(input: CreateGoalWithAxesInput): Promise<Goal>;

  findByUser(userId: string): Promise<Goal[]>;
  findById(id: string, userId: string): Promise<Goal | null>;
}
```

`src/application/interfaces/framework-axis-repository.ts`:

```ts
import type { FrameworkAxis } from '@/domain/entities/framework-axis';

export interface CreateFrameworkAxisInput {
  goalId: string;
  userId: string;
  name: string;
  position: number;
}

export interface FrameworkAxisRepository {
  bulkCreate(inputs: CreateFrameworkAxisInput[]): Promise<FrameworkAxis[]>;
  findByGoal(goalId: string): Promise<FrameworkAxis[]>;
}
```

- [ ] **Step 4.3: CreateGoalFromPreset ユースケースのテストを書く**

`tests/application/usecases/create-goal-from-preset.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { createGoalFromPreset } from '@/application/usecases/create-goal-from-preset';
import type { GoalRepository } from '@/application/interfaces/goal-repository';
import { Goal } from '@/domain/entities/goal';
import { GoalId } from '@/domain/value-objects/goal-id';
import { GoalLabel } from '@/domain/value-objects/goal-label';
import { UserId } from '@/domain/value-objects/user-id';
import { DEFAULT_FRAMEWORK_AXES } from '@/shared/constants/frameworks';

const VALID_GOAL_ID = '00000000-0000-7000-8000-000000000010';
const VALID_USER_ID = '00000000-0000-7000-8000-000000000020';

function makeGoalStub() {
  return Goal.reconstruct({
    id: GoalId.create(VALID_GOAL_ID),
    userId: UserId.create(VALID_USER_ID),
    label: GoalLabel.create('英語'),
    description: null,
    status: 'active',
    frameworkTemplate: 'preset_default',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  });
}

describe('createGoalFromPreset', () => {
  it('createWithAxes をデフォルト軸付きで1回呼ぶ（goal + axes は単一トランザクション）', async () => {
    const goalRepo: GoalRepository = {
      create: vi.fn(),
      createWithAxes: vi.fn().mockResolvedValue(makeGoalStub()),
      findByUser: vi.fn(),
      findById: vi.fn(),
    };

    const result = await createGoalFromPreset({
      userId: VALID_USER_ID,
      label: '英語',
      description: null,
      presetId: 'preset_default',
      goalRepo,
    });

    expect(goalRepo.createWithAxes).toHaveBeenCalledOnce();
    expect(goalRepo.create).not.toHaveBeenCalled();
    const callArg = (goalRepo.createWithAxes as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArg.axes).toEqual(
      DEFAULT_FRAMEWORK_AXES.map((a) => ({ name: a.name, position: a.position }))
    );
    expect(result.props.label.value).toBe('英語');
  });

  it('label が空文字なら DomainError、createWithAxes は呼ばれない', async () => {
    const goalRepo: GoalRepository = {
      create: vi.fn(),
      createWithAxes: vi.fn(),
      findByUser: vi.fn(),
      findById: vi.fn(),
    };

    await expect(
      createGoalFromPreset({
        userId: VALID_USER_ID,
        label: '',
        description: null,
        presetId: 'preset_default',
        goalRepo,
      })
    ).rejects.toThrow();
    expect(goalRepo.createWithAxes).not.toHaveBeenCalled();
  });
});
```

Run: `pnpm test tests/application/usecases/create-goal-from-preset.test.ts`
Expected: FAIL（モジュール未作成）

- [ ] **Step 4.4: CreateGoalFromPreset ユースケースを実装**

`src/application/usecases/create-goal-from-preset.ts`:

```ts
import type { GoalRepository } from '@/application/interfaces/goal-repository';
import type { Goal } from '@/domain/entities/goal';
import { GoalLabel } from '@/domain/value-objects/goal-label';
import { DEFAULT_FRAMEWORK_AXES } from '@/shared/constants/frameworks';
import type { GoalPresetId } from '@/shared/constants/presets';

export interface CreateGoalFromPresetInput {
  userId: string;
  label: string;
  description: string | null;
  presetId: GoalPresetId;
  goalRepo: GoalRepository;
}

/**
 * goal + framework_axes を単一トランザクションで作成する。
 *
 * 旧実装は goalRepo.create → axisRepo.bulkCreate の sequential 呼び出しで、
 * 軸作成だけ失敗すると軸のない goal が残る不整合があった（I2 fix）。
 * 新実装は createWithAxes (Postgres RPC create_goal_with_axes) を使い、
 * いずれかが失敗したら全体ロールバックする。
 */
export async function createGoalFromPreset(
  input: CreateGoalFromPresetInput
): Promise<Goal> {
  const validatedLabel = GoalLabel.create(input.label);

  const goal = await input.goalRepo.createWithAxes({
    userId: input.userId,
    label: validatedLabel.value,
    description: input.description,
    frameworkTemplate: input.presetId,
    axes: DEFAULT_FRAMEWORK_AXES.map((axis) => ({
      name: axis.name,
      position: axis.position,
    })),
  });

  return goal;
}
```

Run: `pnpm test tests/application/usecases/create-goal-from-preset.test.ts`
Expected: PASS（2 件）。

- [ ] **Step 4.5: SupabaseGoalRepository を実装**

`src/infrastructure/repositories/supabase-goal-repository.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  CreateGoalInput,
  CreateGoalWithAxesInput,
  GoalRepository,
} from '@/application/interfaces/goal-repository';
import { Goal } from '@/domain/entities/goal';
import { GoalId } from '@/domain/value-objects/goal-id';
import { GoalLabel } from '@/domain/value-objects/goal-label';
import { UserId } from '@/domain/value-objects/user-id';
import type { Database } from '@/infrastructure/supabase/types';

type GoalRow = Database['public']['Tables']['goals']['Row'];

function toDomain(row: GoalRow): Goal {
  return Goal.reconstruct({
    id: GoalId.create(row.id),
    userId: UserId.create(row.user_id),
    label: GoalLabel.create(row.label),
    description: row.description,
    status: row.status as 'active' | 'archived' | 'deleted',
    frameworkTemplate: row.framework_template,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    deletedAt: row.deleted_at ? new Date(row.deleted_at) : null,
  });
}

export class SupabaseGoalRepository implements GoalRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async create(input: CreateGoalInput): Promise<Goal> {
    const { data, error } = await this.db
      .from('goals')
      .insert({
        user_id: input.userId,
        label: input.label,
        description: input.description,
        framework_template: input.frameworkTemplate,
      })
      .select('*')
      .single();
    if (error || !data) throw error ?? new Error('insert returned no row');
    return toDomain(data);
  }

  /**
   * goals + framework_axes をアトミックに作成する。
   * Postgres function create_goal_with_axes を呼び、途中失敗時は
   * 自動ロールバック。RLS は SECURITY INVOKER 経由で適用される。
   */
  async createWithAxes(input: CreateGoalWithAxesInput): Promise<Goal> {
    const { data, error } = await this.db.rpc('create_goal_with_axes', {
      p_user_id: input.userId,
      p_label: input.label,
      p_description: input.description,
      p_framework_template: input.frameworkTemplate,
      p_axes: input.axes.map((a) => ({ name: a.name, position: a.position })),
    });
    if (error || !data) throw error ?? new Error('rpc returned no row');
    // RPC は SETOF goals を返すため、Postgrest は配列ではなく単一行を返す（returns_row_type）
    const row = (Array.isArray(data) ? data[0] : data) as GoalRow;
    if (!row) throw new Error('create_goal_with_axes returned no row');
    return toDomain(row);
  }

  async findByUser(userId: string): Promise<Goal[]> {
    const { data, error } = await this.db
      .from('goals')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(toDomain);
  }

  async findById(id: string, userId: string): Promise<Goal | null> {
    const { data, error } = await this.db
      .from('goals')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw error;
    return data ? toDomain(data) : null;
  }
}
```

- [ ] **Step 4.6: SupabaseFrameworkAxisRepository を実装**

`src/infrastructure/repositories/supabase-framework-axis-repository.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  CreateFrameworkAxisInput,
  FrameworkAxisRepository,
} from '@/application/interfaces/framework-axis-repository';
import { FrameworkAxis } from '@/domain/entities/framework-axis';
import type { Database } from '@/infrastructure/supabase/types';

type Row = Database['public']['Tables']['framework_axes']['Row'];

function toDomain(row: Row): FrameworkAxis {
  return FrameworkAxis.reconstruct({
    id: row.id,
    goalId: row.goal_id,
    userId: row.user_id,
    name: row.name,
    position: row.position,
    isActive: row.is_active,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  });
}

export class SupabaseFrameworkAxisRepository
  implements FrameworkAxisRepository
{
  constructor(private readonly db: SupabaseClient<Database>) {}

  async bulkCreate(
    inputs: CreateFrameworkAxisInput[]
  ): Promise<FrameworkAxis[]> {
    if (inputs.length === 0) return [];
    const { data, error } = await this.db
      .from('framework_axes')
      .insert(
        inputs.map((i) => ({
          goal_id: i.goalId,
          user_id: i.userId,
          name: i.name,
          position: i.position,
        }))
      )
      .select('*');
    if (error) throw error;
    return (data ?? []).map(toDomain);
  }

  async findByGoal(goalId: string): Promise<FrameworkAxis[]> {
    const { data, error } = await this.db
      .from('framework_axes')
      .select('*')
      .eq('goal_id', goalId)
      .order('position');
    if (error) throw error;
    return (data ?? []).map(toDomain);
  }
}
```

- [ ] **Step 4.7: Server Action を書く**

`src/presentation/actions/create-goal.action.ts`:

```ts
'use server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createGoalFromPreset } from '@/application/usecases/create-goal-from-preset';
import { SupabaseGoalRepository } from '@/infrastructure/repositories/supabase-goal-repository';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server-client';

const InputSchema = z.object({
  label: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  presetId: z.literal('preset_default'),
});

export async function createGoalAction(formData: FormData) {
  const parsed = InputSchema.safeParse({
    label: formData.get('label'),
    description: formData.get('description') || undefined,
    presetId: formData.get('presetId'),
  });
  if (!parsed.success) {
    return { error: 'Invalid input' };
  }
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const goalRepo = new SupabaseGoalRepository(supabase);

  // axisRepo は不要。createGoalFromPreset 内で goalRepo.createWithAxes が
  // RPC 経由で goals + framework_axes をアトミック作成する（I2 fix）
  const goal = await createGoalFromPreset({
    userId: user.id,
    label: parsed.data.label,
    description: parsed.data.description ?? null,
    presetId: parsed.data.presetId,
    goalRepo,
  });

  redirect(`/hearing/${goal.props.id.value}`);
}
```

- [ ] **Step 4.8: Goals 一覧ページを書く**

`src/app/goals/page.tsx`:

```tsx
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SupabaseGoalRepository } from '@/infrastructure/repositories/supabase-goal-repository';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server-client';

export default async function GoalsPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const repo = new SupabaseGoalRepository(supabase);
  const goals = await repo.findByUser(user.id);

  return (
    <main className="mx-auto max-w-2xl p-6">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">ゴール</h1>
        <Link
          href="/goals/new"
          className="rounded bg-black px-3 py-2 text-sm text-white"
        >
          新しいゴール
        </Link>
      </header>
      {goals.length === 0 ? (
        <p className="text-gray-500">まだゴールがありません。</p>
      ) : (
        <ul className="space-y-3">
          {goals.map((g) => (
            <li key={g.props.id.value}>
              <Link
                href={`/tree/${g.props.id.value}`}
                className="block rounded border p-4 hover:bg-gray-50"
              >
                <p className="font-medium">{g.props.label.value}</p>
                <p className="text-sm text-gray-500">
                  {g.props.description ?? ''}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
```

- [ ] **Step 4.9: Goal 新規作成ページを書く**

`src/app/goals/new/page.tsx`:

```tsx
import { createGoalAction } from '@/presentation/actions/create-goal.action';

export default function NewGoalPage() {
  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="mb-6 text-2xl font-semibold">新しいゴール</h1>
      <form action={createGoalAction} className="space-y-4">
        <input type="hidden" name="presetId" value="preset_default" />
        <label className="block text-sm">
          ゴールのラベル
          <input
            name="label"
            type="text"
            required
            maxLength={200}
            className="mt-1 w-full rounded border px-3 py-2"
            placeholder="例: 英語を流暢に話せるようになる"
          />
        </label>
        <label className="block text-sm">
          補足（任意）
          <textarea
            name="description"
            rows={3}
            maxLength={1000}
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </label>
        <button
          type="submit"
          className="w-full rounded bg-black py-2 text-white"
        >
          作成してヒアリングへ
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 4.10: 動作確認**

Run: `pnpm dev`

手動確認:
1. ログイン後 `/goals` を開く
2. 「新しいゴール」をクリック → ラベルを入力 → 作成
3. `/hearing/<goalId>`（まだ存在しないので 404）にリダイレクトされることを確認
4. `/goals` に戻ると作成したゴールが一覧に出ている

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: 全 PASS、エラーゼロ。

- [ ] **Step 4.11: コミット**

```bash
git add src/shared/constants/ src/application/interfaces/ src/application/usecases/create-goal-from-preset.ts src/infrastructure/repositories/supabase-goal-repository.ts src/infrastructure/repositories/supabase-framework-axis-repository.ts src/presentation/actions/create-goal.action.ts src/app/goals/ tests/application/usecases/create-goal-from-preset.test.ts
git commit -m "feat(goals): add preset goal creation with framework axes"
```

---

## Task 5: Hearing Flow with Mock JSON

**Files:**
- Create: `src/infrastructure/mocks/question-bank.ts`
- Create: `src/domain/entities/hearing-node.ts`
- Create: `src/application/interfaces/hearing-node-repository.ts`
- Create: `src/application/usecases/start-hearing.ts`
- Create: `src/application/usecases/record-hearing-answer.ts`
- Create: `src/application/usecases/complete-hearing.ts`
- Create: `src/infrastructure/repositories/supabase-hearing-node-repository.ts`
- Create: `src/presentation/actions/hearing.action.ts`
- Create: `src/app/hearing/[goalId]/page.tsx`
- Test: `tests/domain/entities/hearing-node.test.ts`
- Test: `tests/application/usecases/start-hearing.test.ts`
- Test: `tests/application/usecases/record-hearing-answer.test.ts`

設計上の注意: spec のとおり、ヒアリングは `tree_nodes` ではなく `hearing_nodes` 集約に永続化する。`tree_nodes` には `goal/sub_goal/method/task` のみを格納し、question/answer は `hearing_nodes` に閉じる。所有権境界は `hearing_node_repository.findById(id, userId)` 経由で検証する。

- [ ] **Step 5.1: モック質問バンクを定義**

`src/infrastructure/mocks/question-bank.ts`:

```ts
export interface MockQuestion {
  position: number;
  axisPosition: number;
  label: string;
}

export const MOCK_HEARING_QUESTIONS: readonly MockQuestion[] = [
  { position: 1, axisPosition: 1, label: '今のスキルレベルを 1 行で教えて' },
  { position: 2, axisPosition: 1, label: '次に身につけたい一番大きなスキルは？' },
  { position: 3, axisPosition: 2, label: '毎日続けられそうな小さな習慣は？' },
  { position: 4, axisPosition: 2, label: 'やめたい習慣はある？' },
  { position: 5, axisPosition: 3, label: '取り組む環境（場所・時間）は？' },
] as const;
```

- [ ] **Step 5.2: HearingNode Entity のテストを書く**

`tests/domain/entities/hearing-node.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { HearingNode } from '@/domain/entities/hearing-node';
import { HearingNodeType } from '@/domain/enums/hearing-node-type';
import { HearingStatus } from '@/domain/enums/hearing-status';
import { DomainError } from '@/shared/errors/domain-error';

const baseProps = {
  id: '00000000-0000-7000-8000-000000000001',
  goalId: '00000000-0000-7000-8000-000000000010',
  userId: '00000000-0000-7000-8000-000000000020',
  parentId: null as string | null,
  axisId: null as string | null,
  nodeType: HearingNodeType.Question,
  label: '今のスキルレベルは？',
  status: HearingStatus.Pending,
  metadata: {},
  sortOrder: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null as Date | null,
};

describe('HearingNode', () => {
  it('正常な値で reconstruct できる', () => {
    const node = HearingNode.reconstruct(baseProps);
    expect(node.props.nodeType).toBe('question');
  });

  it('answer は parentId が必須', () => {
    expect(() =>
      HearingNode.reconstruct({
        ...baseProps,
        nodeType: HearingNodeType.Answer,
        parentId: null,
      })
    ).toThrow(DomainError);
  });

  it('label が空文字なら DomainError', () => {
    expect(() =>
      HearingNode.reconstruct({ ...baseProps, label: '' })
    ).toThrow(DomainError);
  });
});
```

Run: `pnpm test tests/domain/entities/hearing-node.test.ts`
Expected: FAIL（モジュールが存在しない）。

- [ ] **Step 5.3: HearingNode Entity を実装**

`src/domain/entities/hearing-node.ts`:

```ts
import type { HearingNodeType } from '@/domain/enums/hearing-node-type';
import type { HearingStatus } from '@/domain/enums/hearing-status';
import { DomainError } from '@/shared/errors/domain-error';

export interface HearingNodeProps {
  id: string;
  goalId: string;
  userId: string;
  parentId: string | null;
  axisId: string | null;
  nodeType: HearingNodeType;
  label: string;
  status: HearingStatus;
  metadata: Record<string, unknown>;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export class HearingNode {
  private constructor(public readonly props: HearingNodeProps) {}

  static reconstruct(props: HearingNodeProps): HearingNode {
    if (props.label.trim().length === 0) {
      throw new DomainError('HearingNode.label cannot be empty');
    }
    if (props.label.length > 500) {
      throw new DomainError('HearingNode.label must be 500 chars or less');
    }
    if (props.nodeType === 'answer' && props.parentId === null) {
      throw new DomainError('HearingNode answer requires parentId');
    }
    return new HearingNode(props);
  }
}
```

Run: `pnpm test tests/domain/entities/hearing-node.test.ts`
Expected: PASS（3 件）。

- [ ] **Step 5.4: HearingNodeRepository インターフェースを定義**

`src/application/interfaces/hearing-node-repository.ts`:

```ts
import type { HearingNode } from '@/domain/entities/hearing-node';
import type { HearingNodeType } from '@/domain/enums/hearing-node-type';
import type { HearingStatus } from '@/domain/enums/hearing-status';

export interface CreateHearingNodeInput {
  goalId: string;
  userId: string;
  parentId: string | null;
  axisId: string | null;
  nodeType: HearingNodeType;
  label: string;
  status: HearingStatus;
  sortOrder: number;
  metadata?: Record<string, unknown>;
}

export interface HearingNodeRepository {
  bulkCreate(inputs: CreateHearingNodeInput[]): Promise<HearingNode[]>;
  create(input: CreateHearingNodeInput): Promise<HearingNode>;
  findByGoal(goalId: string, userId: string): Promise<HearingNode[]>;
  findById(id: string, userId: string): Promise<HearingNode | null>;
  updateStatus(input: {
    id: string;
    userId: string;
    status: HearingStatus;
  }): Promise<void>;
}
```

注意: `findByGoal` / `updateStatus` は `userId` を必須引数として受け取り、Repository 実装側で `eq('user_id', userId)` を必ず付ける。RLS と二重防御で他ユーザーの hearing_node を触れない設計にする。

- [ ] **Step 5.5: StartHearing ユースケースのテストを書く**

`tests/application/usecases/start-hearing.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { startHearing } from '@/application/usecases/start-hearing';
import type { HearingNodeRepository } from '@/application/interfaces/hearing-node-repository';
import { MOCK_HEARING_QUESTIONS } from '@/infrastructure/mocks/question-bank';

const VALID_GOAL = '00000000-0000-7000-8000-000000000010';
const VALID_USER = '00000000-0000-7000-8000-000000000020';

function makeRepo(existing: unknown[] = []): HearingNodeRepository {
  return {
    create: vi.fn(),
    bulkCreate: vi.fn().mockResolvedValue([]),
    findByGoal: vi.fn().mockResolvedValue(existing),
    findById: vi.fn(),
    updateStatus: vi.fn(),
  };
}

describe('startHearing', () => {
  it('質問数だけ HearingNode を bulkCreate する', async () => {
    const repo = makeRepo();
    await startHearing({
      goalId: VALID_GOAL,
      userId: VALID_USER,
      hearingNodeRepo: repo,
    });

    expect(repo.bulkCreate).toHaveBeenCalledOnce();
    const passed = (repo.bulkCreate as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(passed).toHaveLength(MOCK_HEARING_QUESTIONS.length);
    expect(passed[0].nodeType).toBe('question');
    expect(passed[0].status).toBe('pending');
    expect(passed[0].parentId).toBeNull();
  });

  it('既存の question があれば bulkCreate しない（冪等）', async () => {
    const repo = makeRepo([{ props: { nodeType: 'question' } }]);
    await startHearing({
      goalId: VALID_GOAL,
      userId: VALID_USER,
      hearingNodeRepo: repo,
    });
    expect(repo.bulkCreate).not.toHaveBeenCalled();
  });
});
```

Run: `pnpm test tests/application/usecases/start-hearing.test.ts`
Expected: FAIL。

- [ ] **Step 5.6: StartHearing ユースケースを実装**

`src/application/usecases/start-hearing.ts`:

```ts
import type { HearingNodeRepository } from '@/application/interfaces/hearing-node-repository';
import { HearingNodeType } from '@/domain/enums/hearing-node-type';
import { HearingStatus } from '@/domain/enums/hearing-status';
import { MOCK_HEARING_QUESTIONS } from '@/infrastructure/mocks/question-bank';

export interface StartHearingInput {
  goalId: string;
  userId: string;
  hearingNodeRepo: HearingNodeRepository;
}

export async function startHearing(input: StartHearingInput): Promise<void> {
  const existing = await input.hearingNodeRepo.findByGoal(
    input.goalId,
    input.userId
  );
  const hasQuestions = existing.some(
    (n) => (n.props as { nodeType?: string }).nodeType === HearingNodeType.Question
  );
  if (hasQuestions) return;

  await input.hearingNodeRepo.bulkCreate(
    MOCK_HEARING_QUESTIONS.map((q) => ({
      goalId: input.goalId,
      userId: input.userId,
      parentId: null,
      axisId: null,
      nodeType: HearingNodeType.Question,
      label: q.label,
      status: HearingStatus.Pending,
      sortOrder: q.position,
      metadata: { axis_position: q.axisPosition, ai_generated: false },
    }))
  );
}
```

Run: `pnpm test tests/application/usecases/start-hearing.test.ts`
Expected: PASS（2 件）。

- [ ] **Step 5.7: RecordHearingAnswer のテストを書く（所有権境界の自動検証）**

`tests/application/usecases/record-hearing-answer.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { recordHearingAnswer } from '@/application/usecases/record-hearing-answer';
import type { HearingNodeRepository } from '@/application/interfaces/hearing-node-repository';
import { HearingNodeType } from '@/domain/enums/hearing-node-type';
import { HearingStatus } from '@/domain/enums/hearing-status';

const VALID_GOAL = '00000000-0000-7000-8000-000000000010';
const OWNER_USER = '00000000-0000-7000-8000-000000000020';
const OTHER_USER = '00000000-0000-7000-8000-000000000021';
const QUESTION_ID = '00000000-0000-7000-8000-000000000030';

const ownedQuestion = {
  props: {
    id: QUESTION_ID,
    goalId: VALID_GOAL,
    userId: OWNER_USER,
    nodeType: HearingNodeType.Question,
    status: HearingStatus.Pending,
  },
};

function makeRepo(found: unknown | null): HearingNodeRepository {
  return {
    create: vi.fn().mockResolvedValue({ props: {} }),
    bulkCreate: vi.fn(),
    findByGoal: vi.fn(),
    findById: vi.fn().mockResolvedValue(found),
    updateStatus: vi.fn(),
  };
}

describe('recordHearingAnswer', () => {
  it('正常系: answer ノード作成 → question を answered に更新', async () => {
    const repo = makeRepo(ownedQuestion);
    await recordHearingAnswer({
      goalId: VALID_GOAL,
      userId: OWNER_USER,
      questionNodeId: QUESTION_ID,
      answerText: '初級',
      hearingNodeRepo: repo,
    });
    expect(repo.create).toHaveBeenCalledOnce();
    expect(repo.updateStatus).toHaveBeenCalledWith({
      id: QUESTION_ID,
      userId: OWNER_USER,
      status: 'answered',
    });
  });

  it('他ユーザーの question には書き込めない（findById が null を返す）', async () => {
    const repo = makeRepo(null);
    await expect(
      recordHearingAnswer({
        goalId: VALID_GOAL,
        userId: OTHER_USER,
        questionNodeId: QUESTION_ID,
        answerText: 'X',
        hearingNodeRepo: repo,
      })
    ).rejects.toThrow(/forbidden|not found/i);
    expect(repo.create).not.toHaveBeenCalled();
    expect(repo.updateStatus).not.toHaveBeenCalled();
  });

  it('question 以外のノード ID を渡したら拒否', async () => {
    const repo = makeRepo({
      props: { ...ownedQuestion.props, nodeType: HearingNodeType.Answer },
    });
    await expect(
      recordHearingAnswer({
        goalId: VALID_GOAL,
        userId: OWNER_USER,
        questionNodeId: QUESTION_ID,
        answerText: 'X',
        hearingNodeRepo: repo,
      })
    ).rejects.toThrow(/not a question/i);
  });

  it('別ゴールの question を指定したら拒否', async () => {
    const repo = makeRepo({
      props: {
        ...ownedQuestion.props,
        goalId: '00000000-0000-7000-8000-000000000099',
      },
    });
    await expect(
      recordHearingAnswer({
        goalId: VALID_GOAL,
        userId: OWNER_USER,
        questionNodeId: QUESTION_ID,
        answerText: 'X',
        hearingNodeRepo: repo,
      })
    ).rejects.toThrow(/goal mismatch/i);
  });

  it('空の回答は拒否', async () => {
    const repo = makeRepo(ownedQuestion);
    await expect(
      recordHearingAnswer({
        goalId: VALID_GOAL,
        userId: OWNER_USER,
        questionNodeId: QUESTION_ID,
        answerText: '   ',
        hearingNodeRepo: repo,
      })
    ).rejects.toThrow(/empty/i);
  });
});
```

Run: `pnpm test tests/application/usecases/record-hearing-answer.test.ts`
Expected: FAIL。

- [ ] **Step 5.8: RecordHearingAnswer / CompleteHearing ユースケースを実装**

`src/application/usecases/record-hearing-answer.ts`:

```ts
import type { HearingNodeRepository } from '@/application/interfaces/hearing-node-repository';
import { HearingNodeType } from '@/domain/enums/hearing-node-type';
import { HearingStatus } from '@/domain/enums/hearing-status';
import { DomainError } from '@/shared/errors/domain-error';

export interface RecordHearingAnswerInput {
  goalId: string;
  userId: string;
  questionNodeId: string;
  answerText: string;
  hearingNodeRepo: HearingNodeRepository;
}

export async function recordHearingAnswer(
  input: RecordHearingAnswerInput
): Promise<void> {
  const trimmed = input.answerText.trim();
  if (trimmed.length === 0) {
    throw new DomainError('answer cannot be empty');
  }

  // 所有権 / 種別 / ゴール一致を application 層で明示検証する。
  // RLS だけに頼ると、誤って service_role client を渡したときに防げないため。
  const question = await input.hearingNodeRepo.findById(
    input.questionNodeId,
    input.userId
  );
  if (!question) {
    throw new DomainError('question not found or forbidden');
  }
  const props = question.props as {
    nodeType: string;
    goalId: string;
  };
  if (props.nodeType !== HearingNodeType.Question) {
    throw new DomainError('target node is not a question');
  }
  if (props.goalId !== input.goalId) {
    throw new DomainError('question goal mismatch');
  }

  await input.hearingNodeRepo.create({
    goalId: input.goalId,
    userId: input.userId,
    parentId: input.questionNodeId,
    axisId: null,
    nodeType: HearingNodeType.Answer,
    label: trimmed,
    status: HearingStatus.Answered,
    sortOrder: 1,
    metadata: {
      question_node_id: input.questionNodeId,
      answered_at: new Date().toISOString(),
    },
  });

  await input.hearingNodeRepo.updateStatus({
    id: input.questionNodeId,
    userId: input.userId,
    status: HearingStatus.Answered,
  });
}
```

`src/application/usecases/complete-hearing.ts`:

```ts
import type { HearingNodeRepository } from '@/application/interfaces/hearing-node-repository';
import { HearingNodeType } from '@/domain/enums/hearing-node-type';

export interface CompleteHearingInput {
  goalId: string;
  userId: string;
  hearingNodeRepo: HearingNodeRepository;
}

export interface HearingResult {
  questionId: string;
  questionLabel: string;
  answerText: string | null;
  axisPosition: number | undefined;
}

export async function completeHearing(
  input: CompleteHearingInput
): Promise<HearingResult[]> {
  const nodes = await input.hearingNodeRepo.findByGoal(
    input.goalId,
    input.userId
  );
  const questions = nodes.filter(
    (n) => (n.props as { nodeType: string }).nodeType === HearingNodeType.Question
  );

  return questions.map((q) => {
    const props = q.props as {
      id: string;
      label: string;
      metadata: Record<string, unknown>;
    };
    const answer = nodes.find(
      (a) =>
        (a.props as { nodeType: string }).nodeType === HearingNodeType.Answer &&
        (a.props as { parentId: string | null }).parentId === props.id
    );
    return {
      questionId: props.id,
      questionLabel: props.label,
      answerText: answer ? (answer.props as { label: string }).label : null,
      axisPosition: props.metadata.axis_position as number | undefined,
    };
  });
}
```

Run: `pnpm test tests/application/usecases/record-hearing-answer.test.ts`
Expected: PASS（5 件）。

- [ ] **Step 5.9: SupabaseHearingNodeRepository を実装**

`src/infrastructure/repositories/supabase-hearing-node-repository.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  CreateHearingNodeInput,
  HearingNodeRepository,
} from '@/application/interfaces/hearing-node-repository';
import { HearingNode } from '@/domain/entities/hearing-node';
import type { HearingNodeType } from '@/domain/enums/hearing-node-type';
import type { HearingStatus } from '@/domain/enums/hearing-status';
import type { Database } from '@/infrastructure/supabase/types';

type Row = Database['public']['Tables']['hearing_nodes']['Row'];

function toDomain(row: Row): HearingNode {
  return HearingNode.reconstruct({
    id: row.id,
    goalId: row.goal_id,
    userId: row.user_id,
    parentId: row.parent_id,
    axisId: row.axis_id,
    nodeType: row.node_type as HearingNodeType,
    label: row.label,
    status: row.status as HearingStatus,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    sortOrder: row.sort_order,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    deletedAt: row.deleted_at ? new Date(row.deleted_at) : null,
  });
}

export class SupabaseHearingNodeRepository implements HearingNodeRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async create(input: CreateHearingNodeInput): Promise<HearingNode> {
    const { data, error } = await this.db
      .from('hearing_nodes')
      .insert({
        goal_id: input.goalId,
        user_id: input.userId,
        parent_id: input.parentId,
        axis_id: input.axisId,
        node_type: input.nodeType,
        label: input.label,
        status: input.status,
        sort_order: input.sortOrder,
        metadata: input.metadata ?? {},
      })
      .select('*')
      .single();
    if (error || !data) throw error ?? new Error('insert returned no row');
    return toDomain(data);
  }

  async bulkCreate(inputs: CreateHearingNodeInput[]): Promise<HearingNode[]> {
    if (inputs.length === 0) return [];
    const { data, error } = await this.db
      .from('hearing_nodes')
      .insert(
        inputs.map((i) => ({
          goal_id: i.goalId,
          user_id: i.userId,
          parent_id: i.parentId,
          axis_id: i.axisId,
          node_type: i.nodeType,
          label: i.label,
          status: i.status,
          sort_order: i.sortOrder,
          metadata: i.metadata ?? {},
        }))
      )
      .select('*');
    if (error) throw error;
    return (data ?? []).map(toDomain);
  }

  async findByGoal(goalId: string, userId: string): Promise<HearingNode[]> {
    const { data, error } = await this.db
      .from('hearing_nodes')
      .select('*')
      .eq('goal_id', goalId)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('sort_order');
    if (error) throw error;
    return (data ?? []).map(toDomain);
  }

  async findById(id: string, userId: string): Promise<HearingNode | null> {
    const { data, error } = await this.db
      .from('hearing_nodes')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw error;
    return data ? toDomain(data) : null;
  }

  async updateStatus(input: {
    id: string;
    userId: string;
    status: HearingStatus;
  }): Promise<void> {
    const { error } = await this.db
      .from('hearing_nodes')
      .update({ status: input.status })
      .eq('id', input.id)
      .eq('user_id', input.userId);
    if (error) throw error;
  }
}
```

- [ ] **Step 5.10: Hearing Server Action を書く**

`src/presentation/actions/hearing.action.ts`:

```ts
'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { recordHearingAnswer } from '@/application/usecases/record-hearing-answer';
import { SupabaseHearingNodeRepository } from '@/infrastructure/repositories/supabase-hearing-node-repository';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server-client';

const InputSchema = z.object({
  goalId: z.string().uuid(),
  questionNodeId: z.string().uuid(),
  answerText: z.string().min(1).max(1000),
});

export async function submitAnswer(formData: FormData) {
  const parsed = InputSchema.safeParse({
    goalId: formData.get('goalId'),
    questionNodeId: formData.get('questionNodeId'),
    answerText: formData.get('answerText'),
  });
  if (!parsed.success) return { error: 'Invalid input' };

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const hearingNodeRepo = new SupabaseHearingNodeRepository(supabase);
  try {
    await recordHearingAnswer({
      goalId: parsed.data.goalId,
      userId: user.id,
      questionNodeId: parsed.data.questionNodeId,
      answerText: parsed.data.answerText,
      hearingNodeRepo,
    });
  } catch (e) {
    // application 層が forbidden / mismatch を投げる。攻撃可否を漏らさず一律 Forbidden に丸める。
    return { error: 'Forbidden' };
  }

  revalidatePath(`/hearing/${parsed.data.goalId}`);
  return { ok: true };
}
```

- [ ] **Step 5.11: Hearing ページを書く**

`src/app/hearing/[goalId]/page.tsx`:

```tsx
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { startHearing } from '@/application/usecases/start-hearing';
import { SupabaseGoalRepository } from '@/infrastructure/repositories/supabase-goal-repository';
import { SupabaseHearingNodeRepository } from '@/infrastructure/repositories/supabase-hearing-node-repository';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server-client';
import { submitAnswer } from '@/presentation/actions/hearing.action';

export default async function HearingPage({
  params,
}: {
  params: { goalId: string };
}) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // 自分のゴールであることを確認（RLS と二重防御）。
  const goalRepo = new SupabaseGoalRepository(supabase);
  const goal = await goalRepo.findById(params.goalId, user.id);
  if (!goal) redirect('/goals');

  const hearingRepo = new SupabaseHearingNodeRepository(supabase);
  await startHearing({
    goalId: params.goalId,
    userId: user.id,
    hearingNodeRepo: hearingRepo,
  });

  const nodes = await hearingRepo.findByGoal(params.goalId, user.id);
  const questions = nodes
    .filter((n) => n.props.nodeType === 'question')
    .sort((a, b) => a.props.sortOrder - b.props.sortOrder);
  const answers = new Map(
    nodes
      .filter((n) => n.props.nodeType === 'answer')
      .map((a) => [a.props.parentId, a.props.label])
  );

  const allAnswered = questions.every((q) => answers.has(q.props.id));

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-6 text-2xl font-semibold">ヒアリング</h1>
      <ol className="space-y-4">
        {questions.map((q) => {
          const ans = answers.get(q.props.id);
          return (
            <li key={q.props.id} className="rounded border p-4">
              <p className="mb-2 font-medium">
                {q.props.sortOrder}. {q.props.label}
              </p>
              {ans ? (
                <p className="text-sm text-gray-700">回答: {ans}</p>
              ) : (
                <form action={submitAnswer} className="space-y-2">
                  <input type="hidden" name="goalId" value={params.goalId} />
                  <input
                    type="hidden"
                    name="questionNodeId"
                    value={q.props.id}
                  />
                  <textarea
                    name="answerText"
                    rows={2}
                    required
                    className="w-full rounded border px-3 py-2 text-sm"
                  />
                  <button
                    type="submit"
                    className="rounded bg-black px-3 py-1 text-sm text-white"
                  >
                    回答する
                  </button>
                </form>
              )}
            </li>
          );
        })}
      </ol>
      {allAnswered && (
        <Link
          href={`/tree/${params.goalId}`}
          className="mt-6 inline-block rounded bg-black px-4 py-2 text-white"
        >
          ツリーを生成する
        </Link>
      )}
    </main>
  );
}
```

- [ ] **Step 5.12: 動作確認**

Run: `pnpm dev`

手動確認:
1. ゴール作成後 `/hearing/<goalId>` に遷移
2. 質問が 5 件表示される
3. 順番に回答 → 全回答後「ツリーを生成する」ボタン表示
4. ボタンをクリック → `/tree/<goalId>`（まだ存在しないので 404）にリダイレクト
5. 別ユーザーの goalId を URL に直接入れる → `/goals` にリダイレクトされる

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: 全 PASS、エラーゼロ。

- [ ] **Step 5.13: コミット**

```bash
git add src/infrastructure/mocks/ src/domain/entities/hearing-node.ts src/domain/enums/hearing-node-type.ts src/domain/enums/hearing-status.ts src/application/interfaces/hearing-node-repository.ts src/application/usecases/start-hearing.ts src/application/usecases/record-hearing-answer.ts src/application/usecases/complete-hearing.ts src/infrastructure/repositories/supabase-hearing-node-repository.ts src/presentation/actions/hearing.action.ts src/app/hearing/ tests/domain/entities/hearing-node.test.ts tests/application/usecases/start-hearing.test.ts tests/application/usecases/record-hearing-answer.test.ts
git commit -m "feat(hearing): add mock-driven hearing flow with HearingNode aggregate"
```

---

## Task 6: Tree Mock Generation

**Files:**
- Create: `src/infrastructure/mocks/tree-template.ts`
- Create: `src/application/usecases/generate-mock-tree.ts`
- Create: `src/presentation/actions/tree.action.ts`
- Create: `src/presentation/components/TreeView.tsx`
- Create: `src/app/tree/[goalId]/page.tsx`
- Test: `tests/application/usecases/generate-mock-tree.test.ts`

設計上の注意: v0.1 では AI を呼ばず、固定モックテンプレートからツリーを生成する。生成は冪等（既にツリーがあれば再生成しない）。

- [ ] **Step 6.1: モックツリーテンプレートを定義**

`src/infrastructure/mocks/tree-template.ts`:

```ts
export interface MockTreeMethod {
  axisPosition: number;
  label: string;
  tasks: readonly string[];
}

export const MOCK_TREE_TEMPLATE: readonly MockTreeMethod[] = [
  {
    axisPosition: 1,
    label: '基礎スキルを毎日積む',
    tasks: ['朝に 10 分のドリルをやる', '夜に振り返りを 1 行書く'],
  },
  {
    axisPosition: 2,
    label: '小さな習慣を固定する',
    tasks: ['同じ時刻に同じ場所で取りかかる'],
  },
  {
    axisPosition: 3,
    label: '集中できる環境を整える',
    tasks: ['通知をオフにする時間帯を作る'],
  },
] as const;
```

- [ ] **Step 6.1.5: TreeNodeRepository インターフェース宣言**

`src/application/interfaces/tree-node-repository.ts`:

```ts
import type { TreeNode } from '@/domain/entities/tree-node';
import type { NodeStatus } from '@/domain/enums/node-status';

export interface CreateTreeNodeInput {
  goalId: string;
  userId: string;
  parentId: string | null;
  axisId: string | null;
  nodeType: 'goal' | 'sub_goal' | 'method' | 'task';
  label: string;
  status: NodeStatus;
  depth: number;
  position: number;
  metadata: Record<string, unknown>;
}

export interface TreeNodeRepository {
  create(input: CreateTreeNodeInput): Promise<TreeNode>;
  bulkCreate(inputs: CreateTreeNodeInput[]): Promise<TreeNode[]>;
  /**
   * userId 必須。所有権境界はリポジトリ実装側で `eq('user_id', userId)` を強制し、
   * RLS が緩む / service_role 経由でアクセスされるケースに備えた多層防御とする（I1 fix）。
   */
  findById(id: string, userId: string): Promise<TreeNode | null>;
  findByGoal(goalId: string): Promise<TreeNode[]>;
  /**
   * userId 必須。第二条件として WHERE 句に user_id = $userId を追加すること。
   * これにより、誤って他ユーザーの node id を渡されても update が空ヒットになる。
   */
  updateStatus(id: string, userId: string, status: NodeStatus): Promise<void>;
  updateLabel(id: string, userId: string, label: string): Promise<void>;
}
```

- [ ] **Step 6.1.7: SupabaseTreeNodeRepository を実装**

`src/infrastructure/repositories/supabase-tree-node-repository.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  CreateTreeNodeInput,
  TreeNodeRepository,
} from '@/application/interfaces/tree-node-repository';
import { TreeNode } from '@/domain/entities/tree-node';
import type { NodeStatus } from '@/domain/enums/node-status';
import type { Database } from '@/infrastructure/supabase/types';

type Row = Database['public']['Tables']['tree_nodes']['Row'];
type Insert = Database['public']['Tables']['tree_nodes']['Insert'];

function toDomain(row: Row): TreeNode {
  return TreeNode.reconstruct({
    id: row.id,
    goalId: row.goal_id,
    userId: row.user_id,
    parentId: row.parent_id,
    axisId: row.axis_id,
    nodeType: row.node_type as 'goal' | 'sub_goal' | 'method' | 'task',
    label: row.label,
    status: row.status as NodeStatus,
    depth: row.depth,
    position: row.position,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    deletedAt: row.deleted_at ? new Date(row.deleted_at) : null,
  });
}

function toInsert(input: CreateTreeNodeInput): Insert {
  return {
    goal_id: input.goalId,
    user_id: input.userId,
    parent_id: input.parentId,
    axis_id: input.axisId,
    node_type: input.nodeType,
    label: input.label,
    status: input.status,
    depth: input.depth,
    position: input.position,
    metadata: input.metadata,
  };
}

export class SupabaseTreeNodeRepository implements TreeNodeRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async create(input: CreateTreeNodeInput): Promise<TreeNode> {
    const { data, error } = await this.db
      .from('tree_nodes')
      .insert(toInsert(input))
      .select('*')
      .single();
    if (error || !data) throw error ?? new Error('insert returned no row');
    return toDomain(data);
  }

  async bulkCreate(inputs: CreateTreeNodeInput[]): Promise<TreeNode[]> {
    if (inputs.length === 0) return [];
    const { data, error } = await this.db
      .from('tree_nodes')
      .insert(inputs.map(toInsert))
      .select('*');
    if (error) throw error;
    return (data ?? []).map(toDomain);
  }

  async findById(id: string, userId: string): Promise<TreeNode | null> {
    const { data, error } = await this.db
      .from('tree_nodes')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId) // 多層防御: RLS が落ちても user_id 不一致は弾く
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw error;
    return data ? toDomain(data) : null;
  }

  async findByGoal(goalId: string): Promise<TreeNode[]> {
    const { data, error } = await this.db
      .from('tree_nodes')
      .select('*')
      .eq('goal_id', goalId)
      .is('deleted_at', null)
      .order('depth')
      .order('position');
    if (error) throw error;
    return (data ?? []).map(toDomain);
  }

  async updateStatus(
    id: string,
    userId: string,
    status: NodeStatus
  ): Promise<void> {
    const { error } = await this.db
      .from('tree_nodes')
      .update({ status })
      .eq('id', id)
      .eq('user_id', userId); // userId 条件を必須にし、誤って他ユーザー行を更新しない
    if (error) throw error;
  }

  async updateLabel(
    id: string,
    userId: string,
    label: string
  ): Promise<void> {
    const { error } = await this.db
      .from('tree_nodes')
      .update({ label })
      .eq('id', id)
      .eq('user_id', userId);
    if (error) throw error;
  }
}
```

- [ ] **Step 6.2: GenerateMockTree のテストを書く**

`tests/application/usecases/generate-mock-tree.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { generateMockTree } from '@/application/usecases/generate-mock-tree';
import type { TreeNodeRepository } from '@/application/interfaces/tree-node-repository';
import type { FrameworkAxisRepository } from '@/application/interfaces/framework-axis-repository';
import { FrameworkAxis } from '@/domain/entities/framework-axis';
import { MOCK_TREE_TEMPLATE } from '@/infrastructure/mocks/tree-template';

const VALID_GOAL = '00000000-0000-7000-8000-000000000010';
const VALID_USER = '00000000-0000-7000-8000-000000000020';

function makeAxis(position: number, id: string) {
  return FrameworkAxis.reconstruct({
    id,
    goalId: VALID_GOAL,
    userId: VALID_USER,
    name: 'axis',
    position,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe('generateMockTree', () => {
  it('既にゴール以外のノードがあれば bulkCreate しない', async () => {
    const treeRepo: TreeNodeRepository = {
      create: vi.fn(),
      bulkCreate: vi.fn(),
      findByGoal: vi.fn().mockResolvedValue([
        { props: { nodeType: 'goal' } },
        { props: { nodeType: 'method' } },
      ] as never),
      findById: vi.fn(),
      updateStatus: vi.fn(),
      updateLabel: vi.fn(),
    };
    const axisRepo: FrameworkAxisRepository = {
      bulkCreate: vi.fn(),
      findByGoal: vi.fn(),
    };
    await generateMockTree({
      goalId: VALID_GOAL,
      userId: VALID_USER,
      goalLabel: '英語',
      treeRepo,
      axisRepo,
    });
    expect(treeRepo.bulkCreate).not.toHaveBeenCalled();
  });

  it('Goal → Method → Task の 3 層を生成する', async () => {
    const treeRepo: TreeNodeRepository = {
      create: vi
        .fn()
        .mockResolvedValueOnce({
          props: { id: 'goal-id', nodeType: 'goal' },
        })
        .mockResolvedValue({ props: { id: 'method-id', nodeType: 'method' } }),
      bulkCreate: vi.fn().mockResolvedValue([]),
      findByGoal: vi.fn().mockResolvedValue([]),
      findById: vi.fn(),
      updateStatus: vi.fn(),
      updateLabel: vi.fn(),
    };
    const axisRepo: FrameworkAxisRepository = {
      bulkCreate: vi.fn(),
      findByGoal: vi
        .fn()
        .mockResolvedValue([
          makeAxis(1, '00000000-0000-7000-8000-000000000101'),
          makeAxis(2, '00000000-0000-7000-8000-000000000102'),
          makeAxis(3, '00000000-0000-7000-8000-000000000103'),
        ]),
    };

    await generateMockTree({
      goalId: VALID_GOAL,
      userId: VALID_USER,
      goalLabel: '英語',
      treeRepo,
      axisRepo,
    });

    // Goal 1 + Method 数だけ create が呼ばれる（goal+3 method=4）
    expect((treeRepo.create as ReturnType<typeof vi.fn>).mock.calls.length).toBe(
      1 + MOCK_TREE_TEMPLATE.length
    );
    // Task は bulkCreate
    expect(treeRepo.bulkCreate).toHaveBeenCalled();
  });
});
```

Run: `pnpm test tests/application/usecases/generate-mock-tree.test.ts`
Expected: FAIL。

- [ ] **Step 6.3: GenerateMockTree ユースケースを実装**

`src/application/usecases/generate-mock-tree.ts`:

```ts
import type { FrameworkAxisRepository } from '@/application/interfaces/framework-axis-repository';
import type { TreeNodeRepository } from '@/application/interfaces/tree-node-repository';
import { NodeStatus } from '@/domain/enums/node-status';
import { NodeType } from '@/domain/enums/node-type';
import { MOCK_TREE_TEMPLATE } from '@/infrastructure/mocks/tree-template';

export interface GenerateMockTreeInput {
  goalId: string;
  userId: string;
  goalLabel: string;
  treeRepo: TreeNodeRepository;
  axisRepo: FrameworkAxisRepository;
}

export async function generateMockTree(
  input: GenerateMockTreeInput
): Promise<void> {
  const existing = await input.treeRepo.findByGoal(input.goalId);
  const hasNonHearing = existing.some((n) => {
    const t = (n.props as { nodeType: string }).nodeType;
    return t === NodeType.Goal || t === NodeType.Method || t === NodeType.Task;
  });
  if (hasNonHearing) return;

  const axes = await input.axisRepo.findByGoal(input.goalId);
  const axisByPosition = new Map(
    axes.map((a) => [a.props.position, a.props.id])
  );

  const goalNode = await input.treeRepo.create({
    goalId: input.goalId,
    userId: input.userId,
    parentId: null,
    axisId: null,
    nodeType: NodeType.Goal,
    label: input.goalLabel,
    status: NodeStatus.Active,
    depth: 0,
    position: 0,
    metadata: { mock: true },
  });
  const goalNodeId = (goalNode.props as { id: string }).id;

  const methodNodes: { id: string; tasks: readonly string[] }[] = [];
  let methodPosition = 1;
  for (const m of MOCK_TREE_TEMPLATE) {
    const axisId = axisByPosition.get(m.axisPosition) ?? null;
    const created = await input.treeRepo.create({
      goalId: input.goalId,
      userId: input.userId,
      parentId: goalNodeId,
      axisId,
      nodeType: NodeType.Method,
      label: m.label,
      status: NodeStatus.Pending,
      depth: 1,
      position: methodPosition++,
      metadata: { mock: true },
    });
    methodNodes.push({
      id: (created.props as { id: string }).id,
      tasks: m.tasks,
    });
  }

  const taskInputs = methodNodes.flatMap((m) =>
    m.tasks.map((t, i) => ({
      goalId: input.goalId,
      userId: input.userId,
      parentId: m.id,
      axisId: null,
      nodeType: NodeType.Task,
      label: t,
      status: NodeStatus.Pending,
      depth: 2,
      position: i + 1,
      metadata: { recurrence: 'daily', mock: true },
    }))
  );
  if (taskInputs.length > 0) {
    await input.treeRepo.bulkCreate(taskInputs);
  }
}
```

Run: `pnpm test tests/application/usecases/generate-mock-tree.test.ts`
Expected: PASS（2 件）。

- [ ] **Step 6.4: Tree Server Action を書く**

`src/presentation/actions/tree.action.ts`:

```ts
'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { generateMockTree } from '@/application/usecases/generate-mock-tree';
import { SupabaseFrameworkAxisRepository } from '@/infrastructure/repositories/supabase-framework-axis-repository';
import { SupabaseGoalRepository } from '@/infrastructure/repositories/supabase-goal-repository';
import { SupabaseTreeNodeRepository } from '@/infrastructure/repositories/supabase-tree-node-repository';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server-client';

const InputSchema = z.object({ goalId: z.string().uuid() });

export async function generateTreeAction(formData: FormData) {
  const parsed = InputSchema.safeParse({ goalId: formData.get('goalId') });
  if (!parsed.success) return { error: 'Invalid input' };

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const goalRepo = new SupabaseGoalRepository(supabase);
  const goal = await goalRepo.findById(parsed.data.goalId, user.id);
  if (!goal) return { error: 'Not found' };

  const treeRepo = new SupabaseTreeNodeRepository(supabase);
  const axisRepo = new SupabaseFrameworkAxisRepository(supabase);

  await generateMockTree({
    goalId: parsed.data.goalId,
    userId: user.id,
    goalLabel: goal.props.label.value,
    treeRepo,
    axisRepo,
  });

  revalidatePath(`/tree/${parsed.data.goalId}`);
  return { ok: true };
}
```

- [ ] **Step 6.5: TreeView コンポーネントを書く**

`src/presentation/components/TreeView.tsx`:

```tsx
import type { TreeNode } from '@/domain/entities/tree-node';
import { NodeType } from '@/domain/enums/node-type';

export function TreeView({ nodes }: { nodes: TreeNode[] }) {
  const goal = nodes.find((n) => n.props.nodeType === NodeType.Goal);
  const methods = nodes
    .filter((n) => n.props.nodeType === NodeType.Method)
    .sort((a, b) => a.props.position - b.props.position);
  const tasks = nodes.filter((n) => n.props.nodeType === NodeType.Task);

  if (!goal) return <p className="text-gray-500">ツリーがまだ生成されていません。</p>;

  return (
    <div className="space-y-4">
      <div className="rounded border bg-gray-50 p-3 font-medium">
        {goal.props.label}
      </div>
      {methods.map((m) => (
        <div key={m.props.id} className="ml-4">
          <p className="rounded border bg-white p-2 text-sm">
            {m.props.label}
          </p>
          <ul className="ml-6 mt-2 list-disc space-y-1 text-sm text-gray-700">
            {tasks
              .filter((t) => t.props.parentId === m.props.id)
              .sort((a, b) => a.props.position - b.props.position)
              .map((t) => (
                <li key={t.props.id}>{t.props.label}</li>
              ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 6.6: Tree ページを書く**

`src/app/tree/[goalId]/page.tsx`:

```tsx
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { generateMockTree } from '@/application/usecases/generate-mock-tree';
import { SupabaseFrameworkAxisRepository } from '@/infrastructure/repositories/supabase-framework-axis-repository';
import { SupabaseGoalRepository } from '@/infrastructure/repositories/supabase-goal-repository';
import { SupabaseTreeNodeRepository } from '@/infrastructure/repositories/supabase-tree-node-repository';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server-client';
import { TreeView } from '@/presentation/components/TreeView';

export default async function TreePage({
  params,
}: {
  params: { goalId: string };
}) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const goalRepo = new SupabaseGoalRepository(supabase);
  const goal = await goalRepo.findById(params.goalId, user.id);
  if (!goal) redirect('/goals');

  const treeRepo = new SupabaseTreeNodeRepository(supabase);
  const axisRepo = new SupabaseFrameworkAxisRepository(supabase);

  await generateMockTree({
    goalId: params.goalId,
    userId: user.id,
    goalLabel: goal.props.label.value,
    treeRepo,
    axisRepo,
  });

  const nodes = await treeRepo.findByGoal(params.goalId);

  return (
    <main className="mx-auto max-w-2xl p-6">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{goal.props.label.value}</h1>
        <Link
          href="/today"
          className="rounded bg-black px-3 py-2 text-sm text-white"
        >
          今日のタスクへ
        </Link>
      </header>
      <TreeView nodes={nodes} />
    </main>
  );
}
```

- [ ] **Step 6.7: 動作確認**

Run: `pnpm dev`

手動確認:
1. ヒアリング完了後 `/tree/<goalId>` を開く
2. Goal → Method 3 件 → 各 Method 配下に Task が並ぶことを確認
3. ページ再読み込みしてもツリーが重複生成されないこと（idempotent）
4. 「今日のタスクへ」ボタン押下 → `/today`（まだ存在しない）へ遷移

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: 全 PASS、エラーゼロ。

- [ ] **Step 6.8: コミット**

```bash
git add src/infrastructure/mocks/tree-template.ts src/application/usecases/generate-mock-tree.ts src/presentation/actions/tree.action.ts src/presentation/components/TreeView.tsx src/app/tree/ tests/application/usecases/generate-mock-tree.test.ts
git commit -m "feat(tree): add idempotent mock tree generation with Goal-Method-Task layers"
```

---

## Task 7: Daily Task View

**Files:**
- Create: `src/application/interfaces/task-log-repository.ts`
- Create: `src/application/usecases/get-daily-tasks.ts`
- Create: `src/application/usecases/complete-task.ts`
- Create: `src/application/usecases/uncomplete-task.ts`
- Create: `src/infrastructure/repositories/supabase-task-log-repository.ts`
- Create: `src/presentation/hooks/use-up-swipe.ts`
- Create: `src/presentation/components/TaskCard.tsx`
- Create: `src/presentation/actions/task.action.ts`
- Create: `src/app/today/page.tsx`
- Test: `tests/application/usecases/complete-task.test.ts`

設計上の注意: v0.1 のジェスチャーは「上スワイプ」と「キーボード Enter」のみ。横スワイプ・端タップ・取消スタックは v0.3 へ。`task_logs` の UNIQUE INDEX `(user_id, node_id, completed_on)` で同日二重記録を防ぐ。

- [ ] **Step 7.1: TaskLog Repository インターフェースを定義**

`src/application/interfaces/task-log-repository.ts`:

```ts
import type { TaskLog } from '@/domain/entities/task-log';

export interface CompleteTaskInput {
  userId: string;
  taskNodeId: string;
  completedAt: Date;
  dayStartHour: number;
  timezone: string;
  note: string | null;
}

export interface TaskLogRepository {
  upsert(input: CompleteTaskInput): Promise<TaskLog>;
  deleteForLogicalDate(input: {
    userId: string;
    taskNodeId: string;
    logicalDate: string;
  }): Promise<void>;
  findCompletedForLogicalDate(input: {
    userId: string;
    logicalDate: string;
  }): Promise<TaskLog[]>;
}
```

- [ ] **Step 7.2: GetDailyTasks ユースケースを実装**

`src/application/usecases/get-daily-tasks.ts`:

```ts
import type { ProfileRepository } from '@/application/interfaces/profile-repository';
import type { TaskLogRepository } from '@/application/interfaces/task-log-repository';
import type { TreeNodeRepository } from '@/application/interfaces/tree-node-repository';
import type { TreeNode } from '@/domain/entities/tree-node';
import { NodeType } from '@/domain/enums/node-type';
import { computeLogicalDate } from '@/domain/utils/logical-date';

export interface DailyTask {
  node: TreeNode;
  completed: boolean;
}

export interface GetDailyTasksInput {
  userId: string;
  goalId: string;
  treeRepo: TreeNodeRepository;
  taskLogRepo: TaskLogRepository;
  profileRepo: ProfileRepository;
}

export async function getDailyTasks(
  input: GetDailyTasksInput
): Promise<{ logicalDate: string; tasks: DailyTask[] }> {
  const profile = await input.profileRepo.findById(input.userId);
  if (!profile) throw new Error('profile not found');

  const logicalDate = computeLogicalDate({
    at: new Date(),
    dayStartHour: profile.props.dayStartHour.value,
    timezone: profile.props.timezone,
  });

  const nodes = await input.treeRepo.findByGoal(input.goalId);
  const tasks = nodes.filter(
    (n) => (n.props as { nodeType: string }).nodeType === NodeType.Task
  );

  const logs = await input.taskLogRepo.findCompletedForLogicalDate({
    userId: input.userId,
    logicalDate,
  });
  const completedTaskIds = new Set(
    logs.map((l) => l.props.taskNodeId)
  );

  return {
    logicalDate,
    tasks: tasks.map((node) => ({
      node,
      completed: completedTaskIds.has(node.props.id),
    })),
  };
}
```

- [ ] **Step 7.3: CompleteTask ユースケースのテストと実装**

`tests/application/usecases/complete-task.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { completeTask } from '@/application/usecases/complete-task';
import type { ProfileRepository } from '@/application/interfaces/profile-repository';
import type { TaskLogRepository } from '@/application/interfaces/task-log-repository';
import { Profile } from '@/domain/entities/profile';
import { DayStartHour } from '@/domain/value-objects/day-start-hour';
import { UserId } from '@/domain/value-objects/user-id';

const VALID_USER = '00000000-0000-7000-8000-000000000020';

function makeProfile() {
  return Profile.reconstruct({
    id: UserId.create(VALID_USER),
    displayName: '',
    avatarUrl: null,
    dayStartHour: DayStartHour.create(4),
    timezone: 'Asia/Tokyo',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  });
}

describe('completeTask', () => {
  it('TaskLog.upsert に day_start_hour と timezone を渡す', async () => {
    const profileRepo: ProfileRepository = {
      findById: vi.fn().mockResolvedValue(makeProfile()),
    };
    const taskLogRepo: TaskLogRepository = {
      upsert: vi.fn().mockResolvedValue({} as never),
      deleteForLogicalDate: vi.fn(),
      findCompletedForLogicalDate: vi.fn(),
    };

    await completeTask({
      userId: VALID_USER,
      taskNodeId: '00000000-0000-7000-8000-000000000030',
      profileRepo,
      taskLogRepo,
    });

    const call = (taskLogRepo.upsert as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.dayStartHour).toBe(4);
    expect(call.timezone).toBe('Asia/Tokyo');
  });
});
```

`src/application/usecases/complete-task.ts`:

```ts
import type { ProfileRepository } from '@/application/interfaces/profile-repository';
import type { TaskLogRepository } from '@/application/interfaces/task-log-repository';

export interface CompleteTaskInput {
  userId: string;
  taskNodeId: string;
  note?: string | null;
  profileRepo: ProfileRepository;
  taskLogRepo: TaskLogRepository;
}

export async function completeTask(input: CompleteTaskInput): Promise<void> {
  const profile = await input.profileRepo.findById(input.userId);
  if (!profile) throw new Error('profile not found');

  await input.taskLogRepo.upsert({
    userId: input.userId,
    taskNodeId: input.taskNodeId,
    completedAt: new Date(),
    dayStartHour: profile.props.dayStartHour.value,
    timezone: profile.props.timezone,
    note: input.note ?? null,
  });
}
```

Run: `pnpm test tests/application/usecases/complete-task.test.ts`
Expected: PASS（1 件）。

- [ ] **Step 7.4: UncompleteTask ユースケースを実装**

`src/application/usecases/uncomplete-task.ts`:

```ts
import type { ProfileRepository } from '@/application/interfaces/profile-repository';
import type { TaskLogRepository } from '@/application/interfaces/task-log-repository';
import { computeLogicalDate } from '@/domain/utils/logical-date';

export interface UncompleteTaskInput {
  userId: string;
  taskNodeId: string;
  profileRepo: ProfileRepository;
  taskLogRepo: TaskLogRepository;
}

export async function uncompleteTask(
  input: UncompleteTaskInput
): Promise<void> {
  const profile = await input.profileRepo.findById(input.userId);
  if (!profile) throw new Error('profile not found');

  const logicalDate = computeLogicalDate({
    at: new Date(),
    dayStartHour: profile.props.dayStartHour.value,
    timezone: profile.props.timezone,
  });

  await input.taskLogRepo.deleteForLogicalDate({
    userId: input.userId,
    taskNodeId: input.taskNodeId,
    logicalDate,
  });
}
```

- [ ] **Step 7.5: SupabaseTaskLogRepository を実装**

`src/infrastructure/repositories/supabase-task-log-repository.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  CompleteTaskInput,
  TaskLogRepository,
} from '@/application/interfaces/task-log-repository';
import { TaskLog } from '@/domain/entities/task-log';
import type { Database } from '@/infrastructure/supabase/types';

type Row = Database['public']['Tables']['task_logs']['Row'];

function toDomain(row: Row): TaskLog {
  return TaskLog.reconstruct({
    id: row.id,
    userId: row.user_id,
    taskNodeId: row.node_id,
    completedAt: new Date(row.completed_at),
    dayStartHourAtCompletion: row.day_start_hour_at_completion,
    timezoneAtCompletion: row.timezone_at_completion,
    completedOn: row.completed_on,
    note: row.note,
    createdAt: new Date(row.created_at),
  });
}

export class SupabaseTaskLogRepository implements TaskLogRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async upsert(input: CompleteTaskInput): Promise<TaskLog> {
    const { data, error } = await this.db
      .from('task_logs')
      .upsert(
        {
          user_id: input.userId,
          node_id: input.taskNodeId,
          completed_at: input.completedAt.toISOString(),
          day_start_hour_at_completion: input.dayStartHour,
          timezone_at_completion: input.timezone,
          note: input.note,
        },
        { onConflict: 'user_id,node_id,completed_on' }
      )
      .select('*')
      .single();
    if (error || !data) throw error ?? new Error('upsert returned no row');
    return toDomain(data);
  }

  async deleteForLogicalDate(input: {
    userId: string;
    taskNodeId: string;
    logicalDate: string;
  }): Promise<void> {
    const { error } = await this.db
      .from('task_logs')
      .delete()
      .eq('user_id', input.userId)
      .eq('node_id', input.taskNodeId)
      .eq('completed_on', input.logicalDate);
    if (error) throw error;
  }

  async findCompletedForLogicalDate(input: {
    userId: string;
    logicalDate: string;
  }): Promise<TaskLog[]> {
    const { data, error } = await this.db
      .from('task_logs')
      .select('*')
      .eq('user_id', input.userId)
      .eq('completed_on', input.logicalDate);
    if (error) throw error;
    return (data ?? []).map(toDomain);
  }
}
```

- [ ] **Step 7.6: SupabaseProfileRepository を実装**

`src/infrastructure/repositories/supabase-profile-repository.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ProfileRepository } from '@/application/interfaces/profile-repository';
import { Profile } from '@/domain/entities/profile';
import { DayStartHour } from '@/domain/value-objects/day-start-hour';
import { UserId } from '@/domain/value-objects/user-id';
import type { Database } from '@/infrastructure/supabase/types';

type Row = Database['public']['Tables']['profiles']['Row'];

function toDomain(row: Row): Profile {
  return Profile.reconstruct({
    id: UserId.create(row.id),
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    dayStartHour: DayStartHour.create(row.day_start_hour),
    timezone: row.timezone,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    deletedAt: row.deleted_at ? new Date(row.deleted_at) : null,
  });
}

export class SupabaseProfileRepository implements ProfileRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async findById(userId: string): Promise<Profile | null> {
    const { data, error } = await this.db
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw error;
    return data ? toDomain(data) : null;
  }
}
```

- [ ] **Step 7.7: Up-swipe フックを実装**

`src/presentation/hooks/use-up-swipe.ts`:

```ts
'use client';
import { useEffect, useRef } from 'react';

interface UseUpSwipeOptions {
  threshold?: number;
  velocityThreshold?: number;
  angleToleranceDeg?: number;
  onUpSwipe: () => void;
}

export function useUpSwipe<T extends HTMLElement>(
  ref: React.RefObject<T>,
  opts: UseUpSwipeOptions
) {
  const startRef = useRef<{ x: number; y: number; t: number } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const threshold = opts.threshold ?? 80;
    const velocityThreshold = opts.velocityThreshold ?? 0.4; // px/ms
    const angleTol = opts.angleToleranceDeg ?? 30;

    const onStart = (e: PointerEvent) => {
      startRef.current = { x: e.clientX, y: e.clientY, t: performance.now() };
    };
    const onEnd = (e: PointerEvent) => {
      if (!startRef.current) return;
      const dx = e.clientX - startRef.current.x;
      const dy = e.clientY - startRef.current.y;
      const dt = performance.now() - startRef.current.t;
      startRef.current = null;
      if (dy > -threshold) return;
      const angle = (Math.atan2(-dy, Math.abs(dx)) * 180) / Math.PI;
      if (angle < 90 - angleTol) return;
      const velocity = Math.abs(dy) / Math.max(dt, 1);
      if (velocity < velocityThreshold) return;
      opts.onUpSwipe();
    };

    el.addEventListener('pointerdown', onStart);
    el.addEventListener('pointerup', onEnd);
    el.addEventListener('pointercancel', () => (startRef.current = null));
    return () => {
      el.removeEventListener('pointerdown', onStart);
      el.removeEventListener('pointerup', onEnd);
    };
  }, [opts, ref]);
}
```

- [ ] **Step 7.8: TaskCard コンポーネントを書く**

`src/presentation/components/TaskCard.tsx`:

```tsx
'use client';
import { useRef, useTransition } from 'react';
import { useUpSwipe } from '@/presentation/hooks/use-up-swipe';
import {
  completeTaskAction,
  uncompleteTaskAction,
} from '@/presentation/actions/task.action';

export interface TaskCardProps {
  taskNodeId: string;
  label: string;
  completed: boolean;
}

export function TaskCard({ taskNodeId, label, completed }: TaskCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isPending, startTransition] = useTransition();

  const submitComplete = () => {
    if (completed || isPending) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set('taskNodeId', taskNodeId);
      await completeTaskAction(fd);
    });
  };

  const submitUncomplete = () => {
    if (!completed || isPending) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set('taskNodeId', taskNodeId);
      await uncompleteTaskAction(fd);
    });
  };

  useUpSwipe(ref, { onUpSwipe: submitComplete });

  return (
    <div
      ref={ref}
      tabIndex={0}
      role="button"
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (completed) submitUncomplete();
          else submitComplete();
        }
      }}
      className={`touch-pan-y select-none rounded-xl border p-4 transition ${
        completed ? 'bg-emerald-50 line-through opacity-70' : 'bg-white'
      }`}
      style={{ touchAction: 'pan-y' }}
    >
      <p className="text-base">{label}</p>
      <p className="mt-1 text-xs text-gray-500">
        {completed
          ? 'Enter / Space で取消'
          : '上スワイプ or Enter で完了'}
      </p>
    </div>
  );
}
```

- [ ] **Step 7.9: Task Server Action を書く**

`src/presentation/actions/task.action.ts`:

```ts
'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { NodeType } from '@/domain/tree/node-type';
import { completeTask } from '@/application/usecases/complete-task';
import { uncompleteTask } from '@/application/usecases/uncomplete-task';
import { SupabaseProfileRepository } from '@/infrastructure/repositories/supabase-profile-repository';
import { SupabaseTaskLogRepository } from '@/infrastructure/repositories/supabase-task-log-repository';
import { SupabaseTreeNodeRepository } from '@/infrastructure/repositories/supabase-tree-node-repository';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server-client';

const InputSchema = z.object({ taskNodeId: z.string().uuid() });

export async function completeTaskAction(formData: FormData) {
  const parsed = InputSchema.safeParse({
    taskNodeId: formData.get('taskNodeId'),
  });
  if (!parsed.success) return { error: 'Invalid input' };

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  // 所有権 & ノード型検証（多層防御: RLS + アプリ層）
  const treeRepo = new SupabaseTreeNodeRepository(supabase);
  const node = await treeRepo.findById(parsed.data.taskNodeId, user.id);
  if (!node) return { error: 'Forbidden' };
  if (node.props.nodeType !== NodeType.Task) return { error: 'Not a task' };

  const profileRepo = new SupabaseProfileRepository(supabase);
  const taskLogRepo = new SupabaseTaskLogRepository(supabase);

  await completeTask({
    userId: user.id,
    taskNodeId: parsed.data.taskNodeId,
    profileRepo,
    taskLogRepo,
  });
  revalidatePath('/today');
  return { ok: true };
}

export async function uncompleteTaskAction(formData: FormData) {
  const parsed = InputSchema.safeParse({
    taskNodeId: formData.get('taskNodeId'),
  });
  if (!parsed.success) return { error: 'Invalid input' };

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  // 所有権 & ノード型検証
  const treeRepo = new SupabaseTreeNodeRepository(supabase);
  const node = await treeRepo.findById(parsed.data.taskNodeId, user.id);
  if (!node) return { error: 'Forbidden' };
  if (node.props.nodeType !== NodeType.Task) return { error: 'Not a task' };

  const profileRepo = new SupabaseProfileRepository(supabase);
  const taskLogRepo = new SupabaseTaskLogRepository(supabase);

  await uncompleteTask({
    userId: user.id,
    taskNodeId: parsed.data.taskNodeId,
    profileRepo,
    taskLogRepo,
  });
  revalidatePath('/today');
  return { ok: true };
}
```

> **所有権検証の意図**: form 由来の `taskNodeId` を `completeTask` / `uncompleteTask` ユースケースへ渡す前に、ノードが認証ユーザーに属し、かつ `task` 型であることを確認する。RLS は最後の防衛線だが、誤って service_role client を使った場合や repository の `updateStatus(id, status)` のように userId 条件のない API を使った場合に備え、アプリケーション層でも明示的に検証する。

- [ ] **Step 7.10: Today ページを書く**

`src/app/today/page.tsx`:

```tsx
import { redirect } from 'next/navigation';
import { getDailyTasks } from '@/application/usecases/get-daily-tasks';
import { SupabaseGoalRepository } from '@/infrastructure/repositories/supabase-goal-repository';
import { SupabaseProfileRepository } from '@/infrastructure/repositories/supabase-profile-repository';
import { SupabaseTaskLogRepository } from '@/infrastructure/repositories/supabase-task-log-repository';
import { SupabaseTreeNodeRepository } from '@/infrastructure/repositories/supabase-tree-node-repository';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server-client';
import { TaskCard } from '@/presentation/components/TaskCard';

export default async function TodayPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const goalRepo = new SupabaseGoalRepository(supabase);
  const goals = await goalRepo.findByUser(user.id);
  if (goals.length === 0) redirect('/goals');

  // v0.1 は最初のゴール固定
  const goal = goals[0];

  const profileRepo = new SupabaseProfileRepository(supabase);
  const treeRepo = new SupabaseTreeNodeRepository(supabase);
  const taskLogRepo = new SupabaseTaskLogRepository(supabase);

  const { logicalDate, tasks } = await getDailyTasks({
    userId: user.id,
    goalId: goal.props.id.value,
    treeRepo,
    taskLogRepo,
    profileRepo,
  });

  return (
    <main className="mx-auto max-w-md p-6">
      <header className="mb-6">
        <p className="text-xs text-gray-500">{logicalDate}</p>
        <h1 className="text-2xl font-semibold">今日のタスク</h1>
      </header>
      <ol className="space-y-3">
        {tasks.length === 0 ? (
          <p className="text-gray-500">タスクがありません。ツリーを生成してください。</p>
        ) : (
          tasks.map((t) => (
            <li key={t.node.props.id}>
              <TaskCard
                taskNodeId={t.node.props.id}
                label={t.node.props.label}
                completed={t.completed}
              />
            </li>
          ))
        )}
      </ol>
    </main>
  );
}
```

- [ ] **Step 7.11: 動作確認**

Run: `pnpm dev`

手動確認:
1. `/today` にアクセス → 4 件のタスクカードが並ぶ
2. 上スワイプ → そのカードが完了状態（緑＆打ち消し線）に変わる
3. ページ再読み込みしても完了状態が維持される
4. 完了済みカードに Tab フォーカスして Enter → 取消される
5. SQL で `select * from task_logs;` を確認 → ユニーク制約で同日二重 INSERT が起きないこと

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: 全 PASS、エラーゼロ。

- [ ] **Step 7.12: コミット**

```bash
git add src/application/interfaces/task-log-repository.ts src/application/interfaces/profile-repository.ts src/application/usecases/get-daily-tasks.ts src/application/usecases/complete-task.ts src/application/usecases/uncomplete-task.ts src/infrastructure/repositories/supabase-task-log-repository.ts src/infrastructure/repositories/supabase-profile-repository.ts src/presentation/hooks/use-up-swipe.ts src/presentation/components/TaskCard.tsx src/presentation/actions/task.action.ts src/app/today/ tests/application/usecases/complete-task.test.ts
git commit -m "feat(today): add daily task view with up-swipe gesture and idempotent task logs"
```

---

## Task 8: Smoke Test (End-to-End Manual)

**Files:**
- Create: `docs/test-plan-v0.1.md`

このタスクは Playwright を入れずに手動 e2e で検証する。v0.2 で Playwright を導入予定。

- [ ] **Step 8.1: 受け入れシナリオを書く**

`docs/test-plan-v0.1.md`:

```markdown
# Mentor Tree v0.1 Smoke Test

## 前提
- `pnpm db:reset` で初期化済み
- `pnpm dev` 起動済み
- ブラウザで `http://localhost:3000` を開く
- Supabase Studio の Inbucket: `http://127.0.0.1:54324`
- 検証用に 2 つのメールアドレスを用意する（`alice@test.local`, `bob@test.local`）

## シナリオ（基本フロー: alice）
1. ✅ `/` → `/login` にリダイレクトされる
2. ✅ alice でメール送信、Inbucket でリンクをクリック → `/goals` に着く
3. ✅ `/goals` で「新しいゴール」を押す → `/goals/new` に遷移
4. ✅ ラベル「英語を流暢に話せるようになる」で作成 → `/hearing/<goalId_a>` に遷移
   - 内部で `create_goal_with_axes` RPC が走り、`goals` 1 行 + `framework_axes` 4 行が同時に入ること（SQL Studio で確認）
5. ✅ 5 つの質問に順番に回答 → 全て答えると「ツリーを生成する」ボタンが現れる
6. ✅ ボタン押下 → `/tree/<goalId_a>` に遷移、Goal-Method-Task の 3 層が表示される
7. ✅ ページ再読み込みしてもツリーが重複生成されない
8. ✅ 「今日のタスクへ」を押す → `/today` に遷移、タスクカード 4 件が並ぶ
9. ✅ カードを上スワイプ → 完了状態になる
10. ✅ ページ再読み込み → 完了状態維持
11. ✅ 完了カードに Tab フォーカスして Enter → 取消され、再度上スワイプで完了できる
12. ✅ SQL Studio で `select user_id, node_id, completed_on from task_logs;` 実行 → 同日同タスクが 1 行に正規化されている

## シナリオ（クロスユーザー RLS 検証: bob と alice の分離）

> **意図**: アプリケーション層の所有権チェックと RLS の二段構えが、別ユーザーのリソースを完全に遮断していることを確認する（I6 fix）。

13. ✅ alice からログアウト後、bob でログインする
14. ✅ bob の `/goals` で alice の goal が**見えない**（`SupabaseGoalRepository.findByUser` の `eq('user_id', userId)` + RLS）
15. ✅ bob で URL に alice の goalId を直接入れる:
    - `/hearing/<goalId_a>` → `/goals` に redirect（HearingPage の `goalRepo.findById(id, user.id)` が null を返す）
    - `/tree/<goalId_a>` → 同様に redirect
    - `/today?goalId=<goalId_a>` → 同様に redirect（または bob 自身の今日のタスクのみ表示）
16. ✅ bob の DevTools で `/today` の `completeTaskAction` を直接叩いて alice の `taskNodeId` を送る
    - サーバーアクションは `treeRepo.findById(taskNodeId, bob.id)` が null になるため `{ error: 'Forbidden' }` を返す
    - `task_logs` に bob による alice ノードの行は**入らない**こと（SQL Studio で確認）
17. ✅ SQL Studio で **anon ロール** として実行（`set role anon; set request.jwt.claims = '{"sub":"<bob_uuid>"}'`）:
    - `select * from goals where user_id = '<alice_uuid>'` → 0 行
    - `select * from hearing_nodes where user_id = '<alice_uuid>'` → 0 行
    - `select * from tree_nodes where user_id = '<alice_uuid>'` → 0 行
    - `select * from task_logs where user_id = '<alice_uuid>'` → 0 行
    - `reset role;` で戻す

## 不合格条件
- いずれかのページで例外が出る
- ツリーが重複する
- task_logs の同日二重行が出る
- ログアウト状態で /goals 等にアクセスして見えてしまう
- **bob のセッションで alice の goal/hearing/tree/task_logs が 1 行でも見える**
- **bob の completeTaskAction が alice の taskNodeId に対して `{ ok: true }` を返す**
- **anon ロール経由で別ユーザーの行が SELECT できる**
```

- [ ] **Step 8.2: 全体テスト・lint・typecheck の最終確認**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build`
Expected: 全て成功。`pnpm build` が完了することで Cloudflare 互換ビルドの前段検証になる。

- [ ] **Step 8.3: コミット**

```bash
git add docs/test-plan-v0.1.md
git commit -m "docs: add v0.1 smoke test plan"
```

- [ ] **Step 8.4: PR を draft で作成**

```bash
git checkout -b feat/v0.1-mvp
git push -u origin feat/v0.1-mvp
gh pr create --draft --title "feat: Mentor Tree v0.1 MVP" --body "$(cat <<'EOF'
## Summary
- ローカルで動く Mentor Tree v0.1 を実装
- ログイン → ゴール作成 → モックヒアリング → モックツリー → デイリータスクの end-to-end が通る
- AI / Cloudflare デプロイ / Streak 等は v0.2 以降

## Test plan
- [ ] docs/test-plan-v0.1.md の 12 シナリオを全てパス
- [ ] pnpm test / typecheck / lint / build が全てゼロエラー
EOF
)"
```

---

## 完了基準

- 全 8 タスクのチェックボックスが埋まっている
- `pnpm test` `pnpm typecheck` `pnpm lint` `pnpm build` が全てゼロエラー
- `docs/test-plan-v0.1.md` の 12 シナリオが全てパス
- PR が draft 状態で作成されている

## v0.2 以降への引き継ぎ事項

- Anthropic Claude API 連携（claude-sonnet-4-6 / claude-sonnet-4-5 系の正式 ID を確認の上）
- Cloudflare Workers + OpenNext デプロイ
- 横スワイプ・端タップ・取消スタック・連打防止
- Streak / 完了率 / Garden View
- Playwright e2e
- フレームワーク編集 UI
- Profile 設定画面（day_start_hour 編集）

---

