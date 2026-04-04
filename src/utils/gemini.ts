import { GoogleGenerativeAI } from '@google/generative-ai';

export interface VocabItem {
  id: string; // generated unique id
  term: string;
  meaning: string;
  partOfSpeech: string;
  exampleSentence: string;
}

export async function parseVocabularyWithGemini(apiKey: string, text: string): Promise<VocabItem[]> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite-preview" });

  const prompt = `
以下のテキストは英語学習のメモです。このテキストから、学習すべき「英単語」または「フレーズ」を抽出し、JSON形式の配列で出力してください。
各要素は以下のキーを持つオブジェクトにしてください。1回の抽出で10から50個の単語・フレーズを見つけてください（テキストが短い場合は見つかるだけで構いません）。

- term: 英単語またはフレーズ
- meaning: 日本語の意味
- partOfSpeech: 品詞（名詞、動詞など。フレーズの場合は"phrase"等）
- exampleSentence: その単語/フレーズを使った英語の例文（メモ内にあればそれを優先し、なければ自然な例文を生成してください）

JSONフォーマットのみを出力し、マークダウンのコードブロック (\`\`\`json など) は含めないでください。空の配列の場合は [] を出力してください。

[学習メモ]:
${text}
`;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  let textResponse = response.text().trim();
  
  // Remove potential markdown fences
  if (textResponse.startsWith('\`\`\`')) {
    textResponse = textResponse.replace(/^\`\`\`json/i, '').replace(/^\`\`\`/, '');
    textResponse = textResponse.replace(/\`\`\`$/, '');
  }

  try {
    const parsed = JSON.parse(textResponse.trim());
    if (Array.isArray(parsed)) {
      return parsed.map(item => ({
        id: crypto.randomUUID(),
        term: item.term || '',
        meaning: item.meaning || '',
        partOfSpeech: item.partOfSpeech || '',
        exampleSentence: item.exampleSentence || ''
      }));
    }
    return [];
  } catch (e) {
    console.error("Gemini JSON parse error:", e, textResponse);
    throw new Error("Failed to parse AI response into vocabulary format.");
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64data = (reader.result as string).split(',')[1];
      resolve(base64data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function transcribeAudioWithGemini(apiKey: string, audioBlob: Blob): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite-preview" });
  
  const base64data = await blobToBase64(audioBlob);
  const mimeType = audioBlob.type || 'audio/mp4';

  const prompt = "Please transcribe the English speech in this audio precisely. Output only the transcribed text without extra commentary or markdown. If there is no audible speech, output nothing.";

  try {
    const result = await model.generateContent([
      {
        inlineData: {
          data: base64data,
          mimeType: mimeType
        }
      },
      { text: prompt }
    ]);
    const response = await result.response;
    return response.text().trim();
  } catch (e) {
    console.error("Gemini Transcription error:", e);
    throw new Error("Failed to transcribe audio.");
  }
}

export async function evaluateShadowingWithGemini(apiKey: string, sourceBlob: Blob, recordedBlob: Blob): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite-preview" });
  
  const sourceBase64 = await blobToBase64(sourceBlob);
  const recordedBase64 = await blobToBase64(recordedBlob);

  const prompt = `
以下の2つの音声データを比較し、2つ目の音声（英語学習者のシャドーイング録音）を評価してください。
1番目の音声: ネイティブのお手本音声
2番目の音声: 学習者の録音音声

以下の形式で評価を出力してください。
SCORE: [100点満点中の点数]/100

[IMPROVEMENTS]
- 優先的に直すべき発音のミス（上手く発音できていなかった単語）を指摘してください。
- リズム感やイントネーションについても、違和感や直すべき部分があれば具体的に指摘してください。

TRANSCRIPT: [1番目の音声の文字起こし]
`;

  try {
    const result = await model.generateContent([
      {
        inlineData: { data: sourceBase64, mimeType: sourceBlob.type || 'audio/wav' }
      },
      {
        inlineData: { data: recordedBase64, mimeType: recordedBlob.type || 'audio/mp4' }
      },
      { text: prompt.trim() }
    ]);
    const response = await result.response;
    return response.text().trim();
  } catch (e) {
    console.error("Gemini Evaluation error:", e);
    throw new Error("Failed to evaluate audio.");
  }
}
