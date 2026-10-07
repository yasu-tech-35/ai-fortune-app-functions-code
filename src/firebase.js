// ----------------------------------------------------
// 【1. Firebase SDK モジュールのインポート】
// 必要な機能（認証、データベース、ストレージ、サーバーレス関数など）を個別に読み込みます
// ----------------------------------------------------
import { initializeApp } from "firebase/app"; // Firebase アプリ本体の初期化機能
import { getAuth } from "firebase/auth"; // ユーザー認証機能 (Firebase Auth)
import { getFirestore } from "firebase/firestore"; // データベース機能 (Cloud Firestore)
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage"; // ファイル保存機能 (Firebase Storage)
import { getFunctions } from "firebase/functions"; // サーバー側処理の呼び出し機能 (Cloud Functions)

// ----------------------------------------------------
// 【2. Firebase 接続設定の読み込み】
// Vite の環境変数 (.env ファイル) から設定値を読み込みます。
// import.meta.env.VITE_*** を使うことで、キーを直書きせずに安全に管理できます。
// ----------------------------------------------------
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY, // Firebase Web API キー
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN, // 認証ドメイン
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID, // GCP / Firebase プロジェクトID
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET, // ストレージバケット名
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID, // メッセージ送信者ID
  appId: import.meta.env.VITE_FIREBASE_APP_ID, // Firebase アプリID
};

// ----------------------------------------------------
// 【3. Firebase アプリの初期化】
// 設定情報（firebaseConfig）を渡して Firebase アプリを起動します
// ----------------------------------------------------
const app = initializeApp(firebaseConfig);

// ----------------------------------------------------
// 【4. 各機能のインスタンス化とエクスポート】
// 他のファイル（ページやコンポーネント）から呼び出して使えるように export します
// ----------------------------------------------------
export const auth = getAuth(app); // ログイン状態の管理やログイン処理に使用
export const db = getFirestore(app); // データの保存・読み込み・削除に使用
export const storage = getStorage(app); // 画像などのファイルアップロードに使用

// Cloud Functions を東京リージョン (asia-northeast1) に指定して接続インスタンスを作成
export const functions = getFunctions(app, "asia-northeast1");

/**
 * 【5. 共通ヘルパー関数: 画像保存処理】
 * プランの契約状態（無料 Spark / 有料 Blaze）に応じて、画像の保存先・保存形式を自動切り替えします。
 * 
 * @param {File} file - ブラウザのファイル選択で取得した File オブジェクト
 * @param {string} path - Firebase Storage 内での保存先パス（例: "users/uid/fortunes/123.jpg"）
 * @param {boolean} isPaidPlan - 有料プラン(Blaze)を使用中かどうか（デフォルトは false）
 * @returns {Promise<string>} 画像にアクセスするための URL 文字列 または Base64 データ文字列
 */
export async function saveImage(file, path, isPaidPlan = false) {
  // --- 分岐A: 有料プラン (Blaze) の場合 ---
  // 実際に Firebase Storage へ画像をアップロードし、公開用 URL を発行します
  if (isPaidPlan) {
    // 1. 保存先パスの参照（リファレンス）を作成
    const storageRef = ref(storage, path);
    // 2. ファイルをクラウドストレージへ送信（アップロード）
    await uploadBytes(storageRef, file);
    // 3. アップロード完了後、表示用のダウンロード URL を取得して返却
    return await getDownloadURL(storageRef);

  // --- 分岐B: 無料プラン (Spark) の場合 ---
  // Firebase Storage の利用上限を回避するため、画像を文字データ(Base64)に変換して保持します
  } else {
    // 非同期処理を扱うために Promise を返します
    return new Promise((resolve, reject) => {
      // ブラウザ標準のファイル読み込みオブジェクトを作成
      const reader = new FileReader();

      // 読み込みが正常に完了した時の処理
      reader.onload = () => resolve(reader.result); // Base64形式の文字列（"data:image/png;base64,..."）を返却

      // エラーが発生した時の処理
      reader.onerror = (error) => reject(error);

      // ファイルを Data URL (Base64形式のテキスト) として読み込み開始
      reader.readAsDataURL(file);
    });
  }
}