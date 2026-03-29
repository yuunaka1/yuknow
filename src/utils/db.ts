import { get, update } from 'idb-keyval';
import type { VocabItem } from './gemini';

export interface SRItem {
  vocab: VocabItem;
  nextReviewAt: number; // timestamp
  interval: number; // days
  repetition: number;
  easinessFactor: number; // default 2.5
}

const STORE_KEY = 'uknow_vocab_db';

export async function getVocabDB(): Promise<SRItem[]> {
  const data = await get<SRItem[]>(STORE_KEY);
  return data || [];
}

export async function addCards(newItems: VocabItem[]): Promise<number> {
  let addedCount = 0;
  await update(STORE_KEY, (val: any) => {
    const existing: SRItem[] = val || [];
    const existingTerms = new Set(existing.map(e => e.vocab.term.toLowerCase()));
    
    const added: SRItem[] = [];
    newItems.forEach(item => {
      if (!existingTerms.has(item.term.toLowerCase())) {
        added.push({
           vocab: item,
           nextReviewAt: 0, // due immediately
           interval: 0,
           repetition: 0,
           easinessFactor: 2.5
        });
        addedCount++;
      }
    });

    return [...existing, ...added];
  });
  return addedCount;
}

export async function getDueCards(): Promise<SRItem[]> {
  const db = await getVocabDB();
  const now = Date.now();
  // Filter cards due now or earlier
  return db.filter(item => item.nextReviewAt <= now);
}

// Simplified SM-2 Algorithm
export async function updateCardResult(cardId: string, quality: number) {
    await update(STORE_KEY, (val: any) => {
        const db: SRItem[] = val || [];
        const index = db.findIndex(c => c.vocab.id === cardId);
        if (index === -1) return db;

        const card = db[index];
        let { interval, repetition, easinessFactor } = card;

        if (quality >= 3) {
            // Correct answer
            if (repetition === 0) {
                interval = 1;
            } else if (repetition === 1) {
                interval = 6;
            } else {
                interval = Math.round(interval * easinessFactor);
            }
            repetition++;
        } else {
            // Incorrect answer
            repetition = 0;
            interval = 0; // Show again soon
        }

        easinessFactor = easinessFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
        if (easinessFactor < 1.3) easinessFactor = 1.3;

        const nextReviewAt = quality >= 3 
          ? Date.now() + interval * 24 * 60 * 60 * 1000
          : Date.now() + 5 * 60 * 1000; // 5 minutes later if wrong

        db[index] = {
            ...card,
            interval,
            repetition,
            easinessFactor,
            nextReviewAt
        };

        return db;
    });
}
