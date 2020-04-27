# パブリックチャンネルの NG ワードを含む発言を発見するスクリプト

### 使い方

Node.js の v10.16.3 以上をインストール。コンソールにて

```
$ npm install
$ env SLACK_TOKEN=xoxp-999999999 CHANNEL_ID=GS08GT32P NGWORDS_CSV=ngwords_n_junior.csv npm start
```

を実行。 SLACK_TOKEN には、

- search:read
- chat:write:bot
- identify
- link:read
- link:write
- channels:read

のスコープが付いている必要がある。 チャンネルはチャンネル ID をスクリプトに直書いているため、修正する場合には修正のこと。
NG は、ngwords.csv ファイルを確認のこと、なお起動しながら編集しても問題ない作りになっている。

なお環境変数として、

- CHANNEL_ID : 投稿チャンネル ID
- NGWORDS_CSV : NG ワードの CSV ファイルパス

がそれぞれ設定可能です。

実行は、 `npm run build` 後、

```
env SLACK_TOKEN=xoxp-191919191919 CHANNEL_ID=XXXXXXXX NGWORDS_CSV=ngwords_n_junior.csv node dist/index.js
```

で、cron で毎分実行されることを前提とする。
