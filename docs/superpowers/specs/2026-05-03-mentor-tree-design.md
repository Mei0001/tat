# メンターツリー（Mentor Tree）設計書

> 作成日: 2026-05-03
> ベース: PRD_MentorTree_Full.md（個人開発・自分用アプリ）

---

## 1. プロダクト概要

### コンセプト

抽象的な大目標に対して、AI がツリー形式でヒアリングを行い、目標 → サブ目標 → 手段 → タスクに分解するメンターアプリ。タスクは「これなら毎日できる」レベルまで最小化し、達成状況に応じて密度を適応的に調整する。

### コアバリュー

- **ツリーが育つ体験**: 選択肢をタップすると消えて、下にノードが生えていく「気持ちいい」UI
- **思考の可視化**: 漠然とした目標が構造化されていく過程を目で見て実感できる
- **最小タスクからの着手**: 挫折しにくい粒度まで落としてから始める
- **適応的調整**: 達成状況に応じてタスクの密度・難易度を AI が提案

### スコープ（MVP）

#### 含まれるもの

- 複数ゴールの管理（達成宣言・アーカイブ可）
- AI ヒアリング（完全ユーザー主導・ツリー UI）
- 4 層タスクツリー（ノード単位の編集・部分再生成）
- 日次タスク管理（カードデッキ型 UX）
- ストリーク・バッジ・プログレスバー
- 適応調整（ルールベース検知 + AI 提案）
- 週次 AI フィードバック（自動生成）

#### 含まれないもの（v1.x 以降）

- リマインダー通知（LINE / Push）
- コミュニティ機能
- フレームワーク共有・マーケットプレイス
- コーチ / メンター連携機能
- 多言語対応（日本語のみ）
- 課金機能

---

## 2. 技術スタック

| レイヤー | 技術 | 備考 |
|---|---|---|
| ホスティング | Cloudflare Pages | `@cloudflare/next-on-pages` 経由 |
| フレームワーク | Next.js 14 App Router + TypeScript | RSC + Server Actions |
| 認証 + DB | Supabase（PostgreSQL + Auth） | Google / GitHub / Email Magic Link |
| AI | Anthropic SDK（`claude-sonnet-4-6`） | Route Handler（Node.js Runtime） |
| 状態管理 | Zustand（UI 状態）+ TanStack Query（サーバー状態） | |
| スタイリング | Tailwind CSS + `next-themes` | ダークモード対応 |
| アニメーション | Framer Motion + canvas-confetti | スワイプジェスチャー含む |
| バリデーション | Zod | DTO・フォーム共通 |
| 自動生成 | Cloudflare Cron Triggers + Workers | 週次 FB |
| エラー追跡 | Sentry（無料枠） | 全環境 |
| テスト | Vitest（unit）+ Playwright（E2E） | |

### ランタイム分離

```
[Cloudflare Pages: Edge Runtime]
  ├─ ページレンダリング（RSC）
  ├─ Server Actions（CRUD）
  └─ ミドルウェア（認証）

[Cloudflare Pages: Node.js Runtime]  ← export const runtime = 'nodejs'
  └─ Route Handler /api/ai/*（AI 呼び出し）

[Cloudflare Workers: Cron Trigger]
  └─ 毎週日曜 23:00 JST → /api/cron/weekly-feedback
```

---

## 3. ディレクトリ構成（DDD レイヤード簡易版）

```
src/
├── app/                      # Next.js App Router
│   ├── (auth)/login/
│   ├── (app)/
│   │   ├── goals/
│   │   │   ├── new/
│   │   │   ├── [goalId]/
│   │   │   │   ├── framework/
│   │   │   │   ├── hearing/
│   │   │   │   ├── tree/
│   │   │   │   ├── today/
│   │   │   │   ├── dashboard/
│   │   │   │   └── archive/
│   │   │   └── page.tsx       # ゴール一覧
│   │   └── settings/
│   └── api/
│       ├── ai/
│       │   ├── framework/
│       │   ├── hearing/
│       │   ├── tree/
│       │   └── adjustment/
│       └── cron/
│           └── weekly-feedback/
├── domain/
│   ├── entities/             # Goal, FrameworkAxis, TreeNode, TaskLog, Badge
│   ├── value-objects/        # GoalLabel, TaskLabel, Streak など
│   └── types/
├── application/
│   ├── usecases/
│   └── interfaces/           # Repository ports
├── infrastructure/
│   ├── supabase/
│   └── ai/
├── presentation/
│   ├── components/           # 共通 UI
│   └── features/             # 機能別コンポーネント
└── shared/                   # 共通ユーティリティ
```

---

## 4. データモデル

### 4.1 テーブル一覧

| テーブル | 役割 |
|---|---|
| `profiles` | ユーザー情報（auth.users 拡張） |
| `goals` | 大目標（複数可・論理削除対応） |
| `framework_axes` | フレームワークの軸 |
| `tree_nodes` | ツリー全ノード（goal/sub_goal/method/task/question/answer） |
| `task_logs` | タスク完了ログ |
| `ai_feedbacks` | 週次 FB / 適応調整提案 |
| `user_badges` | 獲得バッジ |
| `ai_call_logs` | AI 呼び出し記録（コスト把握） |

### 4.2 SQL スキーマ

```sql
-- ユーザー情報
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  display_name TEXT,
  day_start_hour INT NOT NULL DEFAULT 4 CHECK (day_start_hour BETWEEN 0 AND 23),
  theme TEXT NOT NULL DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
  notifications_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- 大目標（複数可）
CREATE TABLE goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  label VARCHAR(50) NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('hearing', 'active', 'completed', 'archived')),
  framework_type TEXT NOT NULL DEFAULT 'preset'
    CHECK (framework_type IN ('preset', 'ai_generated')),
  sort_order INT NOT NULL DEFAULT 0,
  achieved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- フレームワーク軸
CREATE TABLE framework_axes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  label VARCHAR(50) NOT NULL,
  description VARCHAR(200),
  color TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'completed')),
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ツリーノード
CREATE TABLE tree_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  parent_id UUID REFERENCES tree_nodes(id) ON DELETE CASCADE,
  axis_id UUID REFERENCES framework_axes(id) ON DELETE SET NULL,
  node_type TEXT NOT NULL CHECK (node_type IN (
    'goal', 'sub_goal', 'method', 'task',
    'question', 'answer'
  )),
  label VARCHAR(200) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'completed', 'skipped')),
  metadata JSONB NOT NULL DEFAULT '{}',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- タスク実行ログ
CREATE TABLE task_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id UUID NOT NULL REFERENCES tree_nodes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  completed_on DATE NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  note VARCHAR(200),
  UNIQUE(node_id, completed_on)
);

-- AI フィードバック
CREATE TABLE ai_feedbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  feedback_type TEXT NOT NULL CHECK (feedback_type IN (
    'weekly_review',
    'low_completion_warning',
    'task_adjustment_suggestion',
    'density_increase',
    'density_decrease'
  )),
  target_node_id UUID REFERENCES tree_nodes(id) ON DELETE CASCADE,
  content JSONB NOT NULL,
  is_accepted BOOLEAN,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- バッジ
CREATE TABLE user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  goal_id UUID REFERENCES goals(id) ON DELETE CASCADE,
  badge_type TEXT NOT NULL,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}',
  UNIQUE(user_id, goal_id, badge_type)
);

-- AI 呼び出しログ
CREATE TABLE ai_call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  endpoint TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INT NOT NULL,
  output_tokens INT NOT NULL,
  duration_ms INT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'error')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- インデックス
CREATE INDEX idx_goals_user_status ON goals(user_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_tree_nodes_goal ON tree_nodes(goal_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_tree_nodes_parent ON tree_nodes(parent_id);
CREATE INDEX idx_tree_nodes_axis ON tree_nodes(axis_id);
CREATE INDEX idx_tree_nodes_type_status ON tree_nodes(node_type, status);
CREATE INDEX idx_task_logs_node_date ON task_logs(node_id, completed_on);
CREATE INDEX idx_task_logs_user_date ON task_logs(user_id, completed_on);
CREATE INDEX idx_ai_feedbacks_user_unread ON ai_feedbacks(user_id, read_at);
CREATE INDEX idx_ai_call_logs_user_date ON ai_call_logs(user_id, created_at);
```

### 4.3 metadata JSONB Zod スキーマ

```typescript
// question ノード
const QuestionMetadataSchema = z.object({
  options: z.array(z.string()).max(4),
  allow_custom_input: z.boolean(),
  is_fixed_question: z.boolean(),
  question_index: z.number().int(),
  reasoning: z.string().optional(),
});

// answer ノード
const AnswerMetadataSchema = z.object({
  selected_option: z.string(),
  is_custom_input: z.boolean(),
});

// task ノード
const TaskMetadataSchema = z.object({
  task_type: z.enum(['routine', 'progress']),
  frequency: z.enum(['daily', 'weekly', 'monthly', 'once']),
  estimated_minutes: z.number().int().min(1),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  priority: z.enum(['high', 'medium', 'low']),
  rationale: z.string().optional(),
});
```

### 4.4 RLS ポリシー

論理削除カラム（`deleted_at`）を持つテーブルと持たないテーブルで条件を分ける。

| テーブル | 論理削除 | RLS 条件 |
|---|---|---|
| `profiles` | あり | `id = auth.uid() AND deleted_at IS NULL` |
| `goals` | あり | `user_id = auth.uid() AND deleted_at IS NULL` |
| `tree_nodes` | あり | `user_id = auth.uid() AND deleted_at IS NULL` |
| `framework_axes` | なし（`is_active` で論理状態管理） | `goal_id IN (SELECT id FROM goals WHERE user_id = auth.uid() AND deleted_at IS NULL)` |
| `task_logs` | なし | `user_id = auth.uid()` |
| `ai_feedbacks` | なし | `user_id = auth.uid()` |
| `user_badges` | なし | `user_id = auth.uid()` |
| `ai_call_logs` | なし | `user_id = auth.uid()` |

```sql
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE framework_axes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tree_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_feedbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_call_logs ENABLE ROW LEVEL SECURITY;

-- 論理削除あり
CREATE POLICY "Users access own non-deleted goals"
  ON goals FOR ALL
  USING (user_id = auth.uid() AND deleted_at IS NULL)
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users access own non-deleted tree_nodes"
  ON tree_nodes FOR ALL
  USING (user_id = auth.uid() AND deleted_at IS NULL)
  WITH CHECK (user_id = auth.uid());

-- 論理削除なし（user_id 直接保持）
CREATE POLICY "Users access own task_logs"
  ON task_logs FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
-- ai_feedbacks / user_badges / ai_call_logs も同パターン

-- 論理削除なし（goal_id 経由で所有権チェック）
CREATE POLICY "Users access own framework_axes"
  ON framework_axes FOR ALL
  USING (goal_id IN (
    SELECT id FROM goals WHERE user_id = auth.uid() AND deleted_at IS NULL
  ))
  WITH CHECK (goal_id IN (
    SELECT id FROM goals WHERE user_id = auth.uid() AND deleted_at IS NULL
  ));
```

### 4.5 「論理日」関数

```sql
CREATE OR REPLACE FUNCTION current_logical_date(p_user_id UUID)
RETURNS DATE AS $$
DECLARE
  v_hour INT;
  v_now TIMESTAMPTZ;
BEGIN
  SELECT day_start_hour INTO v_hour FROM profiles WHERE id = p_user_id;
  v_now := timezone('Asia/Tokyo', now());
  IF EXTRACT(HOUR FROM v_now) < v_hour THEN
    RETURN (v_now - INTERVAL '1 day')::DATE;
  ELSE
    RETURN v_now::DATE;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;
```

---

## 5. 主要 UX フロー

### 5.1 ヒアリング（コア体験）

#### 仕様

- **完全ユーザー主導**: AI は質問を出し続け、ユーザーが「このカテゴリ完了」を押すまで継続
- **完全復元**: 全ノードを DB に永続化、再開時に同じ状態を再現
- **カテゴリジャンプ**: 完了済みカテゴリには戻れる、未着手には不可
- **入力**: 選択肢 3〜4 個 + 自由入力（200 文字制限）
- **手戻り**: 選択後も前の質問に戻って修正可能

#### ノードの状態

| 状態 | 見た目 |
|---|---|
| 確定（completed） | 緑ドット + ラベル + 「確定」バッジ |
| 回答中（active） | 青ドット + 質問文 + 選択肢群 |
| 待機中（waiting） | 灰色ドット + 半透明ラベル |
| スキップ（skipped） | 灰色ドット + 取り消し線 |

#### アニメーション

| トリガー | アニメーション |
|---|---|
| 選択肢タップ（非選択） | フェードアウト 0.3s + translateY(-8px) |
| 選択肢タップ（選択） | バウンス 0.4s + 確定ノードへ変化 |
| 新ノード出現 | スライドイン 0.5s（opacity 0→1, translateY -10→0） |
| カテゴリ遷移 | 待機→アクティブ（opacity 0.35→1, 0.4s） |

### 5.2 タスクツリー（4 層編集 UI）

#### 構造

```
- 大目標
  - サブ目標（軸ごと）
    - 手段
      - タスク α  ☐
      - タスク β  ☐
      - ＋ 自分で追加（インライン）
      - 🔄 このノードの子を再生成（プロンプト入力可）
```

#### ノード編集

| アクション | 挙動 |
|---|---|
| ＋ 自分で追加 | インライン入力 → Enter で子ノード追加（AI 不使用） |
| 🔄 再生成 | プロンプト入力欄展開（任意）→ 「実行」で配下サブツリーのみ AI 再生成 |
| ノード編集 | テキストクリックでインライン編集 |
| ノード削除 | hover でゴミ箱アイコン |

#### 文字数制限

- ノードラベル（追加・編集）: 50 文字
- 再生成プロンプト・ヒアリング自由入力: 200 文字
- 大目標: 50 文字

### 5.3 日次タスク（カードデッキ型 UX）

#### モバイルレイアウト

```
┌─────────────┐
│ ●●●●○ │ ⊞   │  進捗ドット + 俯瞰ボタン
├─────────────┤
│             │
│  [タスク α]  │  メインカード
│             │
└─────────────┘
```

#### ジェスチャー

| ジェスチャー | アクション |
|---|---|
| 横スワイプ | デッキ（ゴール）切替 |
| 横タップ（端） | デッキ内のタスク切替 |
| 上スワイプ | 現在のタスクを完了 |
| 俯瞰ボタン | 全カード一覧表示 |

#### PC レイアウト

俯瞰がデフォルト。左側に俯瞰リスト、右側に現在のカード詳細。

#### キーボードショートカット

| キー | アクション |
|---|---|
| ← / → | デッキ（ゴール）切替 |
| Tab / Shift+Tab | デッキ内タスク切替 |
| ↑ / Space | 完了 |
| Z | 直前の完了を取消 |
| ? | ショートカット一覧 |

#### タスクの種類

- **routine**: 毎日継続する習慣（ストレッチ、瞑想等）。当日中に完了しないと翌日には繰り越されない
- **progress**: 累積で進める活動（読書、執筆等）。当日未完了なら翌日のリストに持ち越し

#### 完了時のアニメーション

- 個別完了: scale 1→1.1→0.9 + 後ろに沈む + 小型 confetti（30 粒）
- 全完了: 「今日のタスク完了!」画面 + 大型 confetti（200 粒）

#### 完了タスクの扱い

薄い灰色 + ✅ で最後尾へ回る（デッキから消えない、横タップでアクセス可）。

### 5.4 ゴールのライフサイクル

```
[hearing] → ヒアリング中
   ↓ ヒアリング完了 + タスクツリー生成
[active] → 運用中
   ↓ ユーザーが「達成」ボタンを押す
[completed] → 達成済み（アーカイブで閲覧可）
   ↓ ユーザーが「アーカイブ」を選択
[archived] → 完全アーカイブ
```

ゴールは複数同時にアクティブ可能。

### 5.5 適応調整（二段構成）

#### 段階 1: ルールベース検知（DB クエリのみ・無料）

| 検知条件 | 警告レベル | 表示 |
|---|---|---|
| 1 タスクが過去 7 日で達成率 40% 以下 | ⚠️ 黄色 | タスクカードに「最近うまく続いてないみたい」バナー |
| 1 ゴール全体で過去 14 日が 40% 以下 | 🔴 赤 | 日次タスク画面に「ゴール全体の見直しを検討」バナー |
| 1 ゴール全体で過去 14 日が 80% 以上 | ✨ 緑 | 「もっとチャレンジしてみませんか?」サジェスト |

#### 段階 2: AI 提案（ユーザー承認後）

警告バナーの「調整を依頼」ボタン押下時のみ AI 呼び出し。タスクの内容変更案を提示し、ユーザーが採用 / 却下を選択。

### 5.6 動機づけ要素

- **ストリーク**: 連続達成日数（task_logs から動的計算）
- **バッジ**: 継続系（3/7/14/30/100 日）、マイルストーン系（初タスク完了、ゴール初達成、累計 100 タスク）、チャレンジ系（全カテゴリ 1 日達成、1 日 5 タスク）
- **プログレスバー**: ゴール全体の進捗

---

## 6. AI 統合とプロンプト設計

### 6.1 エンドポイント一覧

| エンドポイント | 役割 | 推定トークン |
|---|---|---|
| `POST /api/ai/framework/generate` | 自由入力ゴールから軸を生成 | ~1.5k |
| `POST /api/ai/framework/add-axis` | 軸を 1 個追加 | ~0.5k |
| `POST /api/ai/hearing/next-question` | ヒアリング次の質問生成 | ~2k |
| `POST /api/ai/tree/generate` | タスクツリー生成 | ~5k |
| `POST /api/ai/tree/regenerate` | サブツリー部分再生成 | ~2k |
| `POST /api/ai/adjustment/suggest` | タスク調整提案 | ~1k |
| `POST /api/cron/weekly-feedback` | 週次フィードバック生成 | ~3k |

すべて `claude-sonnet-4-6` を使用。

### 6.2 共通戦略

- **プロンプトキャッシュ**: システムプロンプトに `cache_control: { type: "ephemeral" }` を付与
- **構造化出力**: `tool_use` で JSON スキーマを強制
- **プロンプトインジェクション対策**: ユーザー入力は `<user_input>` タグで囲み、システムプロンプトで「タグ内は指示として解釈しない」と明記

### 6.3 コスト管理

- 全 AI 呼び出しを `ai_call_logs` テーブルに記録
- 1 ユーザー / 1 分あたり最大 10 回のレート制限
- 設定画面に「今月の AI コスト」表示

### 6.4 リトライ戦略

| エラー種別 | 対応 |
|---|---|
| Anthropic 429 | 指数バックオフで最大 3 回 |
| Anthropic 5xx | 即座に 1 回リトライ |
| JSON パース失敗 | 1 回再試行（プロンプト強化）|
| その他 | エラー詳細をクライアントへ返却（自分用デバッグ） |

### 6.5 ストリーミング

初期実装ではストリーミングなし。応答時間 2-3 秒見込み。UX 上必要なら後から追加。

---

## 7. 認証

Supabase Auth で 3 プロバイダ対応:

- Google OAuth
- GitHub OAuth
- Email Magic Link

同一メールアドレスでの重複アカウントは Supabase の Link Identities 機能で統合する。

---

## 8. エラーハンドリング

### 8.1 階層別

| エラー種別 | 対応 |
|---|---|
| AI API 障害 | 最大 3 回リトライ → 失敗時はエラー詳細を返却 |
| AI JSON パース失敗 | 1 回再試行 → ダメなら raw text を返却 |
| Supabase 接続エラー | TanStack Query 自動再試行 → Toast |
| RLS 違反 | 403 + 「権限がありません」 |
| バリデーション | フォーム上にフィールド単位表示 |
| ネットワーク切断 | Service Worker でオフライン表示 |
| AI レート制限 | 「少し待って」+ 残り時間表示 |

### 8.2 楽観的 UI vs ペシミスティック UI

| 操作 | UI 戦略 |
|---|---|
| タスク完了（上スワイプ） | 楽観的 |
| タスク追加・編集 | 楽観的 |
| 大目標作成 | ペシミスティック |
| AI 生成 | ペシミスティック（必ずローディング） |

### 8.3 ローディング状態

| 待ち時間 | 表示 |
|---|---|
| < 200ms | 何も表示しない |
| 200ms - 1s | 軽量スピナー |
| 1s - 5s | スケルトン UI + 進捗テキスト |
| > 5s | 進捗テキスト + キャンセルボタン |

---

## 9. テスト戦略

### 9.1 Unit テスト（Vitest）

- Domain 層: Value Object・Entity・ビジネスロジック
- Application 層: ユースケース（リポジトリはモック）
- AI 層: プロンプト構築（Claude API はモック）
- カバレッジ目標: 主要ユースケース 80% 以上

### 9.2 Integration テスト

- Supabase Local 起動 + Repository 実装の疎通確認
- RLS ポリシー（別ユーザー越境チェック）
- Migration の適用確認

### 9.3 E2E テスト（Playwright）

クリティカルパスのみ:

1. ログイン → 大目標作成 → ヒアリング → タスクツリー生成
2. 日次タスクで上スワイプ完了 → 取消
3. 設定変更の反映
4. 複数ゴール間の横スワイプ切替

AI 呼び出しはモック（コスト削減）。

---

## 10. 運用

### 10.1 Sentry 設定

```typescript
// src/instrumentation.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  environment: process.env.NODE_ENV,
  beforeSend(event) {
    if (event.extra?.user_input) {
      delete event.extra.user_input;
    }
    return event;
  },
});
```

### 10.2 AI コストダッシュボード

設定画面の「今月の AI コスト」セクションで以下を表示:

```sql
SELECT
  DATE_TRUNC('day', created_at) as day,
  endpoint,
  COUNT(*) as calls,
  SUM(input_tokens) as input,
  SUM(output_tokens) as output,
  ROUND(SUM(input_tokens) * 3.0 / 1000000.0 +
        SUM(output_tokens) * 15.0 / 1000000.0, 4) as cost_usd
FROM ai_call_logs
WHERE user_id = $1
  AND created_at > now() - interval '30 days'
GROUP BY day, endpoint;
```

### 10.3 ログ方針

- 正常系の処理完了ログは出さない
- AI 呼び出しは `ai_call_logs` テーブルで構造化記録
- 異常時のみ `logger.error` + Sentry へ送信
- 二重報告（Sentry + ログ）は避ける

### 10.4 CI/CD

| ステージ | 内容 |
|---|---|
| PR push | Lint + TypeCheck + Unit Test |
| main マージ | 上記 + E2E + Cloudflare Pages デプロイ |
| マイグレーション | `supabase migration up` |

GitHub Actions で実装。

### 10.5 環境変数

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
SENTRY_DSN=
NEXT_PUBLIC_SENTRY_DSN=
CLOUDFLARE_ACCOUNT_ID=
```

---

## 11. 画面構成

| # | 画面 | 主要コンポーネント |
|---|---|---|
| 1 | `/login` | アプリ名 + 1 行説明 + 3 つのログインボタン |
| 2 | `/goals/new` | プリセットカード + 自由入力 |
| 3 | `/goals/[id]/framework` | 軸一覧 + 追加/削除/並び替え |
| 4 | `/goals/[id]/hearing` | ツリー UI + 進捗バッジ + コントロール |
| 5 | `/goals/[id]/tree` | 4 層ツリー + ノード単位編集 + 再生成 |
| 6 | `/goals/[id]/today` | カードデッキ + スワイプ + 俯瞰 |
| 7 | `/goals/[id]/dashboard` | 達成率グラフ + ストリーク + バッジ + 週次 FB |
| 8 | `/goals` | アクティブ + アーカイブのゴール一覧 |
| 9 | `/settings` | アカウント / 通知 / 表示 / 日付切替時間 / AI コスト |

---

## 12. プリセットフレームワーク

| 大目標 | 軸 |
|---|---|
| 思考力を上げたい | 速さ / 深さ / 広さ / 体力 / 素直さ |
| モテたい | 身体 / 清潔感・外見 / 出会い / コミュニケーション / マインド |
| 英語を話せるようになりたい | インプット / アウトプット / 環境 / 継続力 |
| 健康になりたい | 運動 / 食事 / 睡眠 / メンタル / 習慣化 |
| お金を貯めたい | 収入 / 支出管理 / 投資 / マインド |

---

## 13. 開発ロードマップ

### v0.1 — 基盤・ヒアリング（コア体験）

- プロジェクトセットアップ（Next.js + Cloudflare Pages + Supabase + Tailwind）
- Supabase Auth（Google / GitHub / Email Magic Link）
- DB スキーマ + RLS
- 大目標選択画面（プリセット + 自由入力）
- フレームワーク確認・編集画面
- ヒアリング UI（ツリー構造 + 選択肢 + アニメーション + 完全復元）
- Claude API 連携（フレームワーク生成・ヒアリング質問生成）
- タスクツリー生成・表示
- ai_call_logs 記録

### v0.2 — タスク運用（カードデッキ UX）

- 日次タスクビュー（カードデッキ + スワイプ）
- 上スワイプ完了 + confetti
- 横スワイプでゴール切替
- 横タップでタスク切替
- 俯瞰モード（モバイル / PC レイアウト分岐）
- 完了取消ドロワー
- 当日のみ完了記録、progress タスクの翌日繰越

### v0.3 — タスクツリー編集 + 動機づけ

- タスクツリー画面（ノード単位編集）
- ＋ 自分で追加（インライン）
- 🔄 部分再生成（プロンプト入力）
- ストリーク計算
- バッジ獲得ロジック + 表示
- プログレスバー
- ダッシュボード画面

### v0.4 — 適応調整 + 週次 FB

- ルールベース検知（過去 7/14 日達成率の SQL 集計）
- 警告バナー表示
- AI 調整提案エンドポイント
- 週次 FB 自動生成（Cloudflare Cron）
- AI コストダッシュボード

### v0.5 — 磨き込み

- レスポンシブ対応の最終調整
- ダークモード対応
- キーボードショートカット
- エラーハンドリングの全面強化
- パフォーマンス最適化

### v1.0 — ローンチ準備（個人利用）

- Sentry 統合の確認
- E2E テストのクリティカルパス完成
- バグ修正・QA

### v1.x — 将来構想

- リマインダー通知
- 多言語対応
- コミュニティ機能
- フレームワーク共有

---

## 14. 確定済み主要決定事項

| # | 項目 | 決定 |
|---|---|---|
| 1 | AI モデル | claude-sonnet-4-6 |
| 2 | 削除方針 | profiles / goals / tree_nodes は論理削除（deleted_at）、その他は物理削除 |
| 3 | timezone/locale | Asia/Tokyo / ja-JP 固定 |
| 4 | ゴール数 | 複数可（達成・アーカイブ可） |
| 5 | 文字数制限 | ラベル 50 / プロンプト 200 |
| 6 | カテゴリ完了判断 | 完全ユーザー主導 |
| 7 | ヒアリング再開 | 完全復元 |
| 8 | カテゴリジャンプ | 完了済みのみ可 |
| 9 | タスクツリー再生成 | 部分再生成のみ |
| 10 | タスク種別 | routine / progress |
| 11 | 過去日への記録 | 不可、当日のみ |
| 12 | progress 持ち越し | 翌日へ自動繰越 |
| 13 | 達成率計算 | 一律（区別なし） |
| 14 | 日次タスク UX | カードデッキ + 上スワイプ完了 |
| 15 | ゴール切替 | 横スワイプ |
| 16 | タスク切替 | 横タップ |
| 17 | 完了カードの扱い | 灰色 + ✅ で最後尾 |
| 18 | 全完了時 | confetti + お祝い画面 |
| 19 | 俯瞰モード | あり、PC はデフォルト |
| 20 | 認証 | Google + GitHub + Email Magic Link |
| 21 | エラー表示 | フル開示（自分用デバッグ） |
| 22 | 日付切替時間 | ユーザー設定可（00/03/04/05/06） |
| 23 | 適応調整 | ルールベース検知 + AI 提案 |
| 24 | 週次 FB | 自動生成（毎週日曜 23:00 JST） |
| 25 | デプロイ | Cloudflare Pages + Supabase |
| 26 | デバイス対応 | 完全レスポンシブ |
| 27 | 動機づけ | ストリーク + バッジ + プログレスバー |
| 28 | 通知 | アプリ内のみ |
| 29 | 課金 | なし |
| 30 | i18n | 日本語のみ |
