# yuKnow (ShadowTerm Edition) 🕶️🟢

🚀 **Play instantly on the web:** [https://yuunaka1.github.io/yuknow/](https://yuunaka1.github.io/yuknow/)

yuKnow は、独自のバックエンドサーバーを持たずに完全クライアントサイド（ブラウザ）で動作する、語学学習・シャドーイング支援アプリケーションです。AI解析（Gemini API）やデータ同期（Google Docs API）などの外部サービスとブラウザが直接通信するため、専用バックエンドの維持費「0円」で高度なAI語学学習を実践できます。

## ✨ Core Features

### 1. Flashcards (自動単語帳生成 & AI復習)
Google Docs で取った語学学習のメモやノートを自動で読み込み、Gemini 3.1 Flash Lite を使って「英単語・フレーズ」と「意味・翻訳」のペア形式のフラッシュカードを抽出します。
- **Google連携**: OAuth 2.0 クライアント機能を利用し、非公開ドキュメントを安全に読み込みます。
- **Spaced Repetition**: 抽出されたカードはブラウザ側のデータベース（IndexedDB）に保存され、iKnowのような間隔反復（Spaced Repetition）アルゴリズムに基づいたクイズとして出題されます。

### 2. Shadowing (AI採点付き シャドーイングプレイヤー)
お手本の英語MP3音声を使った「シャドーイング練習」に特化したメディアプレイヤーを搭載しています。
- **基本機能**: 再生速度調整、トラックリピート、A-B間リピートなど、語学学習に必要な基本機能を網羅。
- **録音と文字起こし**: マイクからの音声を録音し、自分の声を聴き返すことができます。さらにGemini APIを用いて録音した音声を直接 `TRANSCRIBE (文字起こし)` させることが可能です。
- **🤖 EVALUATE (AI直接評価)**:
  - お手本音声と、録音した自分の音声をGemini 3.1に比較させ、**「発音の正確性 (100点満点)」「リズムやイントネーションの違和感」「特に修正すべき単語」** をダイレクトに指摘させます。
  - Web Audio APIの高度なオフラインレンダリングを使い、「自分が録音していた秒数区間」の元の音声をブラウザ上でWAVとして自動切り出しし、Geminiに投げるため驚くほど高精度・高速です。

### 3. Coaching (AI英会話コーチ・発音診断レポート)
英会話のレッスン音声や、自分が英語を話している長めの音声をアップロードすることで、Gemini APIが総合的なコーチングを行います。
- **Transcript & Analysis**: 録音データから文字起こしを生成し、文法エラーの修正や、より自然で洗練された表現の提案を行います。
- **Downloadable Report**: AIからのフィードバックをテキスト（Markdown形式）のレポートとしてダウンロードし、後から復習記録として保存・管理することが可能です。

### 4. Monologue (Live Translation)
Gemini Multimodal Live APIを用いた、超低遅延・双方向のリアルタイム音声翻訳・通訳モードを搭載しています。
- **WebSocket Streaming**: ブラウザのマイク音声を 16kHz PCM にリアルタイム変換して API に直接ストリーミングし、遅延のない音声レスポンスを確立します。Screen Wake Lock 機能により、セッション中の画面スリープも防止します。
- **Voice-to-Voice**: こちらが話した日本語を即座にネイティブな英語音声に翻訳して読み上げ、英語を話した場合は日本語に翻訳して出力します。「口に出して考える（Thinking Outloud）」練習や、独白による思考整理に最適です。

### 5. Reflex (瞬間英作文トレーニング)
Monologue と同じリアルタイム Live API ベースエンジンを利用した、「瞬間英作文（Instant English Composition）」ドリルモードです。
- **CEFR レベル別トレーニング**: A1～C2の中から自分のレベルを設定すると、AIがそのレベルに最適化された日本語の短文を出題します。
- **Interactive Feedback Loop**: AIの出題に対してユーザーが英語で回答すると、AIがすかさず「良かった点」「文法や不自然な箇所の指摘」「よりネイティブな別表現の提案」を日本語と英語を交えて音声で解説し、すぐに次の問題へ移行します。手を触れずに声だけでエンドレスにトレーニングを続けることが可能です。

### 6. Serverless & Privacy First
- 設定するAPIキー (Google Client ID, Gemini API Key) は `localStorage` にのみ保存され、開発者を含むいかなる外部サーバーにも送信されません。
- 学習履歴や暗記スコアもすべてユーザーのブラウザ (IndexedDB) 内に留まります。

---

## 🚀 Getting Started

### Prerequisites (前提条件)
本アプリを利用するためには、ご自身で以下の2つのキーを取得する必要があります。
1. **Google Client ID (OAuth 2.0)**: Google Cloud Console から取得 (Google Docs読み込み用)
2. **Gemini API Key**: Google AI Studio から取得 (文字起こし・解析用)

### Installation (ローカルや自前サーバーで動かしたい人向け)
本アプリをローカル環境や、自身のサーバーでビルド・ホスティングしたい方向けの起動手順です。yuKnow は React + Vite で作られています。

```bash
# 1. 依存関係のインストール
npm install

# 2. 開発サーバーの起動 (ローカルで確認する場合)
npm run dev
```

### Deployment (本番環境・スマホ用)
自分のスマホからいつでもアクセスしたい場合は、GitHub Pages 等へデプロイしてください。
（本プロジェクトには GitHub Actions による CI/CD パイプライン `.github/workflows/ci-cd.yml` が設定されており、タグをプッシュするだけで自動的に GitHub Pages へのビルドと公開が行われます。）

```bash
# バージョンを上げてGitHubへ自動デプロイさせる場合
npm run release:patch
```

---

## 🛠️ Usage Workflow

1. **[Settings] タブでの初期設定**:
   あらかじめ取得した `Google Client ID`, `Gemini API Key`, そして読み込みたい Google Docs の `Document ID` を入力します。
2. **[Flashcards] タブで単語帳作成**:
   「Launch AI Sync」を実行し、ノートから単語帳を生成します。その後、その日の復習タスク（Quiz）を開始します。
3. **[Shadowing] / [Coaching] タブで発音・総合練習**:
   手持ちのリスニング用MP3をロードして再生し、A-Bリピートで練習しつつ「AUTO REC」で自分の声を録音。AIからの厳しいフィードバックをもらって発音を改善したり、長尺な会話の録音から全体の詳細レポートを作成します。
4. **[Monologue] / [Reflex] タブで実践スピーキング**:
   WebSocket による低遅延リアルタイムAPIを利用し、日本語から英語への同時通訳によるシャドーイングや、瞬間英作文の無限ループ特訓を声だけでハンズフリーで行います。

## 📄 License
This project is licensed under the [MIT License](LICENSE).
