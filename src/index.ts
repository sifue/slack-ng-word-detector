import * as fs from 'fs';
import moment from 'moment';

// WebAPI Method について → https://api.slack.com/methods
// Slack SDK WebAPI について → https://slack.dev/node-slack-sdk/web-api
import { WebClient } from '@slack/web-api';
import {
  SearchAllResponse,
  ChatPostMessageResponse,
  ConversationsInfoResponse
} from 'seratch-slack-types/web-api';
import csvSync = require('csv-parse/lib/sync');

let lastTimestampMap: Map<string, string> = new Map(); // チャンネルIDごとの最終タイムスタンプのMap
const lastTimestampsFilename = './last-timestamps.json';

const SEARCH_COUNT = 100; // 一度の実行で取得するメッセージ数

// チャンネルごとの最終タイムスタンプデータがあれば復元
if (fs.existsSync(lastTimestampsFilename)) {
  const jsonText = fs.readFileSync('./last-timestamps.json', {
    encoding: 'utf8'
  });
  const json = JSON.parse(jsonText);
  lastTimestampMap = new Map(json);
}

if (!process.env.CHANNEL_ID) {
  console.log(`[ERROR] 環境変数 CHANNEL_ID が設定されていません。`);
  process.exit(1);
}
const channel: string = process.env.CHANNEL_ID; // チャンネルID形式

// メインループを指定秒ごとに実行
// search.all API アクセスは Tier2 なので3秒1回まで許されそう

(async () => {
  try {
    const token = process.env.SLACK_TOKEN;
    if (!token) {
      console.log(`[ERROR] 環境変数 SLACK_TOKEN が設定されていません。`);
      return;
    }
    const web = new WebClient(token);
    const ngwordsFileName = process.env.NGWORDS_CSV;
    if (!ngwordsFileName) {
      console.log(`[ERROR] 環境変数 NGWORDS_CSV が設定されていません。`);
      return;
    }
    const csvText = fs.readFileSync(ngwordsFileName);

    const records = csvSync(csvText);
    const ngwords: Array<string> = records.map((e: Array<string>) => e[0]);

    const searchAllResponse = (await web.search.all({
      query: 'after:yesterday type:message',
      sort: 'timestamp',
      sort_dir: 'desc',
      count: SEARCH_COUNT
    })) as SearchAllResponse;

    if (!searchAllResponse.ok) {
      console.log(`[ERROR] APIアクセスに失敗しました。 searchAllResponse:`);
      console.log(searchAllResponse);
      return;
    }

    const messages = searchAllResponse.messages;
    if (!messages) {
      console.log(`[ERROR] messagesがありませんでした。 messages:`);
      console.log(messages);
      return;
    }

    const matches = messages.matches;
    if (!matches) {
      console.log(`[ERROR] matchesがありませんでした。 matches:`);
      console.log(matches);
      return;
    }

    let counter = 0;
    let ngCounter = 0;

    for (let i = matches.length - 1; i >= 0; i--) {
      const match = matches[i];
      if (!match.channel) continue;
      if (!match.channel.id) continue;

      let ts = match.ts;
      if (!ts) ts = '';

      let lastTimestamp = lastTimestampMap.get(match.channel.id);
      if (!lastTimestamp) lastTimestamp = '';

      // パブリックチャンネルのみに限定
      if (
        ts > lastTimestamp &&
        match.text &&
        match.channel &&
        match.channel.is_channel &&
        !match.channel.is_im &&
        !match.channel.is_private &&
        !match.channel.is_mpim &&
        match.channel.name &&
        match.user &&
        match.username &&
        match.permalink
      ) {
        const targetText: string = match.text;

        const containNgwords = ngwords.filter((word: string) => {
          if (!word) return false;
          return targetText.includes(word);
        });

        if (containNgwords.length > 0) {
          // なにかNGワードがあれば
          ngCounter++;

          // チャンネル参加者数情報を取得
          const conversationsInfoResponse = (await web.conversations.info({
            channel: match.channel.id,
            include_num_members: true
          })) as ConversationsInfoResponse;
          let channelMemberCount =
            conversationsInfoResponse.channel?.num_members;
          if (!channelMemberCount) channelMemberCount = -1;

          let text = match.permalink + '\n';
          text += `${match.username} (${match.user}) at #${
            match.channel.name
          } (${channelMemberCount})\nNG: ${containNgwords.join(',')}`;

          const chatPostMessageResponse = (await web.chat.postMessage({
            channel: channel,
            text: text,
            link_names: true,
            unfurl_links: true,
            unfurl_media: true
          })) as ChatPostMessageResponse;

          if (!chatPostMessageResponse.ok) {
            console.log(
              `[ERROR] APIアクセスに失敗しました。 chatPostMessageResponse:`
            );
            console.log(chatPostMessageResponse);
            return;
          }
        }

        counter++;
        lastTimestampMap.set(match.channel.id, ts);
      }
    }

    // ファイル書き出し
    const jsonLastTimestamps = JSON.stringify(Array.from(lastTimestampMap));
    fs.writeFileSync(lastTimestampsFilename, jsonLastTimestamps);

    console.log(
      `[INFO] ${moment().format(
        'YYYY/MM/DD HH:mm:ss'
      )} 検索結果 ${SEARCH_COUNT} 件中 ${counter} 件新規、 ${ngCounter} 件NGの投稿がありました。`
    );
  } catch (err) {
    console.log(`[ERROR] エラーが発生しました。 err:`);
    console.log(err);
  }
})();
