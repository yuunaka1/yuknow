# Changelog

All notable changes to this project will be documented in this file.

## [1.5.0] - 2026-04-17

### ✨ Features
- **Live Translation Mode**: 追加！Gemini Multimodal Live API (`gemini-2.5-flash-native-audio-preview`等) を使用した、完全リアルタイムの双方向・音声翻訳（日本語→英語）モードを実装。
- **Native PCM WebSocket**: APIの仕様に従い、マイク入力を内部で `16kHz PCM` にリアルタイム変換し、WebSocketを通じてGeminiと連続的な音声データの送受信を行う機能を構築。

## [1.4.1] - 2026-04-17

### 💄 UI/UX Improvements
- **Navigation**: ヘッダーのメニューの並び順を `Shadowing` → `Coaching` → `Flashcards` の順に変更しました。
- **Settings**: Settings画面内の表示順を見直し、`Google Client ID` の設定項目を一番下に移動しました。

## [1.4.0] - 2026-04-17

### ✨ Features
- **Settings**: Geminiの使用モデルをSettings画面から自由に設定できるようになりました（デフォルト: `gemini-3.1-flash-lite-preview`, `gemini-3.1-pro-preview` などの最新モデルも選択可能）(Resolves #9)

## [1.3.0] - 2026-04-17

### 🔒 Security
- **SECURITY.md**: 脆弱性情報の報告手順やサポート対象バージョンを一覧で確認できるよう `SECURITY.md` を追加しました (Resolves #8)

### 📦 Dependencies
- **npm deps**: Dependabot による自動アップグレードPRをまとめてマージし、依存パッケージ（`react@19.2.5`, `react-dom@19.2.5`, `vite@8.0.8`, `lucide-react@1.8.0`, `typescript-eslint@8.58.2`）を更新しました。

## [1.2.2] - 2026-04-12

### 💄 UI/UX Improvements
- **Shadowing**: `REPEAT` および `SPD` セレクトボックスの右側に空いていた余分な余白（padding）を削除し、テキストが他ボタンと同様に中央揃えになるようデザインを統一しました。

## [1.2.1] - 2026-04-12

### ✨ Features
- **Lesson Coaching**: 分析結果（LOG）を日付入りのマークダウンファイル（`yuknow_coaching_YYYY-MM-DD.md`）としてダウンロード・保存できる「EXPORT」機能を追加。

## [1.2.0] - 2026-04-12

### ✨ Features
- **Lesson Coaching**: オンライン英会話レッスンの振り返りに特化した新メニュー「Coaching」を追加 (Fixes #5)
  - 録音したオンライン英会話の音声ファイル（MP3等、最大20MB）をアップロードし、Geminiに生徒側の発言のみにフォーカスして分析させる機能を実装。
  - プロンプトをカスタマイズし、「今日の総評」「良かった点」「改善点」「不自然だった表現とその修正案」「そのまま使える言い換え例」といった実践的なフィードバックをハッカー風UIで表示するようにしました。

## [1.1.1] - 2026-04-12

### 🐛 Bug Fixes
- **Shadowing**: マイクでの録音開始時に、再生中の音声品質が劣化し、スマホが「通話モード」になってしまう問題を解消 (Fixes #6)
  - ブラウザ標準のハードウェア・エコーキャンセル処理 (`echoCancellation: true`) が Bluetoothイヤホン等を強制的に低音質モード（HFP仕様）に切り替えてしまう現象を回避するため、マイク取得時の各種DSP処理を無効化する修正を行いました。

### ♻️ Refactoring (機能統合)
- **Shadowing**: 「TRACK Repeat（トラック全体ループ）」機能と「目標ループ回数表示」を一つのセレクトボックスに統合。
  - 単純な1回再生（OFF）、無限ループ（INF）、指定回数ループ（5, 10, 20...）などを1箇所で一元管理できるように改修。
  - 重複していたトラックリピート専用ボタンを削除し、UIをより直感的に操作できるようにシンプル化。

## [1.1.0] - 2026-04-12

### ✨ Features
- **Shadowing**: 目標ループ回数の設定とカウントダウン機能を追加 (Fixes #3)
  - シャドーイングの反復練習用に「指定回数（5/10/20/30回）ループすると自動停止する」機能を追加。
  - 残りループ回数を表示するリアルタイムインジケーターをコントロールパネルに設置。
  - A-B間リピート、およびトラック全体リピートの両方に対応。

### 🐛 Bug Fixes & Refactoring
- **Shadowing**: 選択したオーディオファイルがページリロード後に失われる問題を修正 (Fixes #2)
  - `idb-keyval` を利用し、読み込んだ音声ファイル自体をブラウザのローカルデータベース (IndexedDB) に自動キャッシュ。
  - 次回アクセス時やリロード時に、アップロード済みファイルを自動で復元再開する機能を実装。

## [1.0.0] - 2026-04-11

### ✨ Features (新機能・大規模な更新)

**[Flashcards] Google Docs からの自動単語帳生成機能**
- `Google OAuth 2.0` を用いたログイン機能を実装し、非公開のGoogle Docsから安全にノートを読み込み可能に。
- `Gemini 3.1 Flash Lite` を用いて、テキストから自動的に「英熟語・単語」と「意味」のペアを抽出する構造化抽出機能を実装。
- 間隔反復（Spaced Repetition）アルゴリズムに基づいたクイズ機能を実装し、学習記録を IndexedDB に永続化。

**[Shadowing] ハッカー風 UI を備えた AI 直接評価付きメディアプレイヤー**
- ローカルのMP3ファイルを独自プレイヤーで再生し、A-B間リピート機能・複数段階の再生速度調整（0.75x 〜 1.25x）を実装。
- **Auto Rec（自動録音）機能**: Web Audio API と `MediaRecorder` を用いて、再生と同時に自身の声を一時保存するマイク制御機能を実装。
- **Gemini EVALUATE機能**: お手本音声トラックから「自身が録音していた区間」だけをミリ秒単位で完全にオフラインレンダリング（WAV抽出）し、自身で録音した音声と同時にGeminiに送信。「100点満点での採点」「リズム・イントネーションの違い」「修正すべき箇所」のフィードバックと「自動文字起こし（TRANSCRIBE）」を実装。

**[UI / UX] デザインの全画面統一・最適化**
- アプリ全体のテーマを `ShadowTerm Edition`（ハッカー風テイスト: 漆黒背景、ネオングリーン文字、Fira Code等のプログラミングフォント）に統一。
- すべてのアイコンボタンに黒緑のホバーフリッカーエフェクトを追加。
- スマートフォンの狭い横幅でも美しく操作できるよう、CSSの `clamp` 関数を用いて余白（padding/margin）を手作業で徹底的に縮小。
- **Screen Wake Lock 機能**: Shadowingの再生中、ブラウザの画面が自動で暗くなったりスリープに入らないようにするOS連動ロック機能を実装。

### 🔧 Chores (その他の更新)
- プロジェクト（およびGitHubリポジトリ）の名称を `uKnow` から `yuKnow` に正式に変更。（関連する全ドメイン表記の修正完了）
- 汎用性の高い取扱説明書（`README.md`）の作成と、アプリ画面右端の `[Help]` パネルからのリアルタイム埋め込み読み込みの実装完了。
- バージョンと Changelog 更新を半自動化する npm リリーススクリプト (`npm run release:patch` など) の追加。

---

*※ これより過去の開発履歴は割愛されています。このファイルは以降、アップデートのたびにAIエージェント（Antigravity）によって自動生成・追記されます。*
