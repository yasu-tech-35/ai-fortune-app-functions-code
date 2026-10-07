const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { GoogleGenAI } = require("@google/genai");

/**
 * Cloud Functions: Secret Manager から GEMINI_API_KEY を安全に注入して実行
 */
exports.callGeminiApi = onCall(
  {
    cors: true,
    region: "asia-northeast1",
    secrets: ["GEMINI_API_KEY"], // Secret Manager から安全に読み込む設定
  },
  async (request) => {
    // 認証チェック（ログイン必須化）
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "この機能を利用するにはログインが必要です。"
      );
    }

    // Secret Manager から環境変数に安全に注入された API キーを取得
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new HttpsError(
        "failed-precondition",
        "APIキーが設定されていません。"
      );
    }

    const ai = new GoogleGenAI({ apiKey });
    const { action, payload } = request.data;

    try {
      // 1. 新規・派生 AI 占い鑑定
      if (action === "runFortuneTelling") {
        const {
          profile,
          images = [],
          fortunePrompt,
          correctionPrompt,
          previousResult,
        } = payload;

        let systemInstruction =
          fortunePrompt || "あなたは親切で高度な鑑定技術を持つプロの占い師です。";
        if (correctionPrompt) {
          systemInstruction += `\n\n【用語・誤り正し補正ルール】:\n${correctionPrompt}`;
        }

        let userText = `【相談者プロフィール】\n`;
        userText += `氏名/ニックネーム: ${profile.name}\n`;
        userText += `生年月日: ${profile.birthDate}\n`;
        userText += `出生時間: ${profile.birthTime || "不明"}\n`;
        userText += `性別: ${profile.gender || "未回答"}\n`;

        if (previousResult) {
          userText += `\n【過去の鑑定結果との比較・変化の分析依頼】\n`;
          userText += `以下は相談者の過去の鑑定結果です:\n"${previousResult}"\n`;
          userText += `上記の過去結果と今回新しく提供されたプロフィール・画像を比較し、どのような変化や新たな運勢の兆しが出ているかを詳しく解説・アドバイスしてください。\n`;
        }

        const contents = [userText];

        // クライアントから渡された Base64 画像 Part を追加
        for (const imgPart of images) {
          if (imgPart && imgPart.inlineData) {
            contents.push(imgPart);
          }
        }

        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: contents,
          config: {
            systemInstruction: systemInstruction,
            temperature: 0.7,
          },
        });

        return { text: response.text };
      }

      // 2. 鑑定結果に対する対話チャット分析
      if (action === "analyzeFortuneChat") {
        const { newQuestion, fortuneContext } = payload;

        const systemInstruction = `あなたは経験豊富な占い師です。以下の【元の鑑定結果】に基づいて、ユーザーからの追加質問や深掘りの分析リクエストに丁寧かつ具体的に回答してください。\n\n【元の鑑定結果】:\n${fortuneContext}`;

        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: `【ユーザーの追加質問】:\n${newQuestion}`,
          config: {
            systemInstruction: systemInstruction,
            temperature: 0.7,
          },
        });

        return { text: response.text };
      }

      throw new HttpsError("invalid-argument", "無効なアクションです。");
    } catch (err) {
      console.error("Gemini API 実行エラー:", err);
      throw new HttpsError("internal", "AI鑑定処理中にエラーが発生しました。");
    }
  }
);