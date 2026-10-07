import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";

/**
 * File オブジェクトまたは Base64 Data URL を InlineData 形式に変換
 * @param {File|string} fileOrBase64
 * @returns {Promise<{inlineData: {data: string, mimeType: string}}>}
 */
async function fileToGenerativePart(fileOrBase64) {
  if (typeof fileOrBase64 === "string" && fileOrBase64.startsWith("data:")) {
    const [header, base64Data] = fileOrBase64.split(",");
    const mimeType = header.match(/:(.*?);/)[1];
    return { inlineData: { data: base64Data, mimeType } };
  }

  const arrayBuffer = await fileOrBase64.arrayBuffer();
  const base64 = btoa(
    new Uint8Array(arrayBuffer).reduce(
      (data, byte) => data + String.fromCharCode(byte),
      ""
    )
  );
  return { inlineData: { data: base64, mimeType: fileOrBase64.type } };
}

/**
 * AI占い鑑定の実行関数（Cloud Functions 経由）
 */
export async function runFortuneTelling({
  profile,
  images = [],
  fortunePrompt,
  correctionPrompt,
  previousResult = null,
}) {
  const imageParts = [];
  for (const img of images) {
    if (img) {
      const part = await fileToGenerativePart(img);
      imageParts.push(part);
    }
  }

  const callGemini = httpsCallable(functions, "callGeminiApi");
  const response = await callGemini({
    action: "runFortuneTelling",
    payload: {
      profile,
      images: imageParts,
      fortunePrompt,
      correctionPrompt,
      previousResult,
    },
  });

  return response.data.text;
}

/**
 * 鑑定結果に対する追加チャット分析の実行関数（Cloud Functions 経由）
 */
export async function analyzeFortuneChat(newQuestion, fortuneContext) {
  const callGemini = httpsCallable(functions, "callGeminiApi");
  const response = await callGemini({
    action: "analyzeFortuneChat",
    payload: {
      newQuestion,
      fortuneContext,
    },
  });

  return response.data.text;
}