export interface TopicState {
  id: string;
  title: string;
  isCustom: boolean;
  status: 'unstarted' | 'drafted' | 'scripted' | 'practiced' | 'completed';
  rawNotesJa: string;
  organizedOutlineJa: string;
  englishScript: string;
  lastFeedback: string;
  updatedAt: number;
}

export const PRESET_TOPICS: Omit<TopicState, 'updatedAt'>[] = [
  { id: 'preset_school', title: '学校(高校や大学など)で勉強したこと', isCustom: false, status: 'unstarted', rawNotesJa: '', organizedOutlineJa: '', englishScript: '', lastFeedback: '' },
  { id: 'preset_job', title: '今やっている仕事の内容(その業界の現在地や市況、今後の展望など)', isCustom: false, status: 'unstarted', rawNotesJa: '', organizedOutlineJa: '', englishScript: '', lastFeedback: '' },
  { id: 'preset_career', title: 'それに至るまでの職歴などの変遷', isCustom: false, status: 'unstarted', rawNotesJa: '', organizedOutlineJa: '', englishScript: '', lastFeedback: '' },
  { id: 'preset_turning_point', title: '人生のターニングポイントになった出来事', isCustom: false, status: 'unstarted', rawNotesJa: '', organizedOutlineJa: '', englishScript: '', lastFeedback: '' },
  { id: 'preset_values', title: '大事にしている価値観', isCustom: false, status: 'unstarted', rawNotesJa: '', organizedOutlineJa: '', englishScript: '', lastFeedback: '' },
  { id: 'preset_future_goals', title: '将来やりたいこと', isCustom: false, status: 'unstarted', rawNotesJa: '', organizedOutlineJa: '', englishScript: '', lastFeedback: '' },
  { id: 'preset_concerns', title: '今悩んでいること', isCustom: false, status: 'unstarted', rawNotesJa: '', organizedOutlineJa: '', englishScript: '', lastFeedback: '' },
  { id: 'preset_hobbies', title: '好きなこと、趣味', isCustom: false, status: 'unstarted', rawNotesJa: '', organizedOutlineJa: '', englishScript: '', lastFeedback: '' },
  { id: 'preset_holidays', title: '休日の過ごし方', isCustom: false, status: 'unstarted', rawNotesJa: '', organizedOutlineJa: '', englishScript: '', lastFeedback: '' },
  { id: 'preset_travel_food', title: '旅行や食などの好み', isCustom: false, status: 'unstarted', rawNotesJa: '', organizedOutlineJa: '', englishScript: '', lastFeedback: '' },
  { id: 'preset_living', title: '今住んでいるところ、これまでに住んできたところ', isCustom: false, status: 'unstarted', rawNotesJa: '', organizedOutlineJa: '', englishScript: '', lastFeedback: '' },
  { id: 'preset_family', title: '家族やパートナーについて', isCustom: false, status: 'unstarted', rawNotesJa: '', organizedOutlineJa: '', englishScript: '', lastFeedback: '' },
  { id: 'preset_friends', title: '友達について', isCustom: false, status: 'unstarted', rawNotesJa: '', organizedOutlineJa: '', englishScript: '', lastFeedback: '' },
  { id: 'preset_recommendations', title: '自分が好きな場所、人に紹介したいところ', isCustom: false, status: 'unstarted', rawNotesJa: '', organizedOutlineJa: '', englishScript: '', lastFeedback: '' },
  { id: 'preset_japan', title: '日本のいいと思っていること、問題だと思っているところ', isCustom: false, status: 'unstarted', rawNotesJa: '', organizedOutlineJa: '', englishScript: '', lastFeedback: '' },
  { id: 'preset_english_motivation', title: '英語を勉強することになったきっかけ', isCustom: false, status: 'unstarted', rawNotesJa: '', organizedOutlineJa: '', englishScript: '', lastFeedback: '' }
];
