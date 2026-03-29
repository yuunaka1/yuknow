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
