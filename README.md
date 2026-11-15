# AWS FlowLab — AWS Service Playground

AWS サービスの仕組みを、リクエストの流れを見ながら学べるインタラクティブな Playground です。例を選び、リクエストを送信し、設定を変えて結果を比べられます。順番に読み進める必要はありません。

React / TypeScript / Vite で構成された静的アプリです。バックエンド、AWS アカウント、有料 API は不要です。

## オンラインで試す

[AWS FlowLab を開く](https://rongrongrabbit.github.io/awsflowlab/)

公開サイトには main ブランチの内容が反映されます。開発ブランチの内容は、ローカルで確認できます。

## ローカルで起動する

Node.js 22.12 以降の 22.x、24.x、または 26 以降が必要です。

```bash
npm ci
npm run dev
```

ターミナルに表示された URL の `/awsflowlab/` を開いてください。ほかのプロジェクトがポートを使用している場合、Vite は別のポートを選びます。

ポートを指定して起動する場合：

```bash
npm run dev -- --host 127.0.0.1 --port 5180 --strictPort
```

この場合は `http://127.0.0.1:5180/awsflowlab/` にアクセスします。指定ポートが使用中の場合はエラーで停止します。

## AWS WAF

利用者からアプリケーションへ届くリクエストを、ルールで確認する流れを体験できます。

- 通常アクセス、攻撃サンプル、Block から Count への変更、Priority の変更を試す4つの例。
- リクエストの種類、ルールの ON/OFF、Allow / Block / Count を変更。
- 折りたたみ設定で Priority と Default Action を調整。
- Allow / Block は判定を終了し、Count は記録して次のルールへ進む動作を表示。
- Match / No Match、無効なルール、終了後の未評価ルールを区別。
- 前回の結果と設定を表示し、変更前後を比較。

## Application Load Balancer（ALB）

リクエストのパスに応じて、転送先の Target Group を選ぶ流れを体験できます。

```text
利用者 → ALB → Target Group → アプリケーション
```

- 既定の Web アプリ、API パス、画像パス、Priority による転送先の変更を試す4つの例。
- `/`、`/api/users`、`/images/logo.png` などのパスを選択。
- Priority の小さい順に条件を確認し、最初の Match で転送先を決定。
- 一致するルールがなければ、最後に Default Rule を適用。
- ルールの ON/OFF、Priority（1〜50000）、各ルールと Default Rule の転送先を変更。
- Forward と最終的に到達するアプリを、実際のシミュレーション結果に沿って表示。

ルールの ON/OFF は、評価対象から外すための学習用操作です。実際の ALB に同じ有効・無効スイッチがあることを示すものではありません。

## Amazon CloudFront

キャッシュとオリジンのどちらから応答するかを、単一のエッジキャッシュで体験できます。

```text
利用者 ⇄ CloudFront（キャッシュ）⇄ Origin
```

- 初回と2回目、オリジン更新、TTL の期限切れ、言語とキャッシュキー、画像と API、Invalidation の6つの例。
- パスと `lang` を選び、送信して Hit / Miss や返ってきた内容の言語・バージョンを確認。
- 時間を10秒ずつ進め、選択パスのオリジンを更新し、キャッシュと比較。
- キャッシュ表でキー、保存した内容、残り TTL を表示。
- 「キャッシュの設定」で Behavior ごとの TTL と、`lang` をキーに含めるかを変更。
- 指定パスの Invalidation 後、次のリクエストで再取得する流れを確認。

一部の例はキャッシュや更新済みオリジンを準備した状態で始まります。例の選択だけでは送信せず、準備内容は画面に表示します。`lang` はキーに含めない場合も常にオリジンへ転送するモデルです。

TTL はオリジンにキャッシュ制御ヘッダーがない成功応答に適用します。TTL 0 はキャッシュ無効です。時間は操作ボタンでのみ進み、Invalidation は即時完了の簡易モデルです。BYPASS は学習用の表示です。

## 共通の操作

画面上部で AWS WAF / ALB / CloudFront を切り替えられます。サービスを切り替えると、設定と実行履歴は初期化されます。

- 例を選ぶと設定だけを読み込みます。「リクエストを送信」で実行します。
- 自動再生、ステップ実行、一時停止、実行時の設定を使った再生、リセットに対応。
- 設定変更後は再送信で結果を更新。表示中の実行は元の設定を保持します。
- 各サービスの6枚のナレッジカードは、必要なものから展開できます。
- `Alt + ← / →` で例を切り替え、`Tab` で操作項目を移動できます。
- 狭い画面では図の中を横スクロールできます。アニメーションを減らす端末設定にも対応します。

## テストとビルド

```bash
npm test
npm run typecheck
npm run build
npm run docs:check
npm run preview
```

`build` は型チェック、アプリのビルド、Developer Guide の生成を実行します。プレビュー時も、ターミナルに表示されたアドレスの `/awsflowlab/` を開きます。ガイドは `/awsflowlab/developer-guide/` です。

## 開発ドキュメント

- [Developer Guide（中国語）](docs/developer-guide.md)：構成、シミュレーションの仕様、処理フロー、テスト、公開方法。
- [AGENTS.md](AGENTS.md)：開発・保守ルール。

ドキュメントのソースは Markdown です。`npm run docs:build` で `dist/developer-guide/index.html` を生成します。生成した HTML は直接編集せず、Git にコミットしません。

## GitHub Pages

GitHub Actions でテストとビルドを行い、main ブランチへの更新時に公開します。feature ブランチや PR からの本番デプロイは行いません。

Vite の base は、リポジトリ名に合わせた `/awsflowlab/` です。アプリと Developer Guide を同じ `dist/` から配信します。

リポジトリの Settings → Pages → Build and deployment では **GitHub Actions** を選択します。公開状況は **Deploy GitHub Pages** の実行結果で確認してください。環境の承認が必要な場合は、管理者による承認後にデプロイされます。

## シミュレーションの範囲

教育用の簡易モデルであり、実際の AWS サービスではありません。HTTP 通信、実際の攻撃検知、AWS API 呼び出しは行いません。設定と実行履歴はメモリー内だけに保存されます。

WAF は2つの固定条件、ALB は3つの固定パスパターンを扱います。任意のルール追加はできません。WAF の Count は今回のリクエスト内の記録です。全リクエストを Allow する例は、優先順位を学ぶためのもので、本番設定の推奨ではありません。

ALB は各 Target Group に正常なアプリが1台あるモデルです。ヘルスチェック、複数台への負荷分散、TLS、Redirect、Fixed Response、WAF との連携は再現しません。

CloudFront は固定の3パス、2言語、1つのオリジンを扱います。複数エッジ、ブラウザーキャッシュ、Cookie、ヘッダー、条件付き再検証（304）や実際の設定反映時間は再現しません。

各サービスの評価ロジックは、それぞれ独立した決定的なモデルとして実装しています。認証情報や API キーをソースコードやフロントエンドの環境変数に含めないでください。
