import { useState, useEffect } from 'react';
import { RefreshCw, Play, Loader2 } from 'lucide-react';
import { useGoogleAuth } from '../hooks/useGoogleAuth';
import { fetchGoogleDocText } from '../utils/googleDocs';
import { parseVocabularyWithGemini } from '../utils/gemini';
import { getDueCards, addCards } from '../utils/db';
import type { SRItem } from '../utils/db';

interface DashboardProps {
  googleClientId: string;
  geminiApiKey: string;
  docId: string;
  onStartQuiz: () => void;
}

export default function Dashboard({ googleClientId, geminiApiKey, docId, onStartQuiz }: DashboardProps) {
  const { token, isReady, login, logout } = useGoogleAuth(googleClientId);
  const [syncing, setSyncing] = useState(false);
  const [dueCards, setDueCards] = useState<SRItem[]>([]);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  useEffect(() => {
    loadDueCards();
  }, []);

  const loadDueCards = async () => {
    const cards = await getDueCards();
    setDueCards(cards);
  };

  const handleSync = async () => {
    if (!token) {
        login();
        return;
    }
    setSyncing(true);
    setSyncMessage("Fetching document text...");
    try {
      const text = await fetchGoogleDocText(docId, token);
      if (!text) throw new Error("Document is empty.");
      
      setSyncMessage("Parsing vocabulary with Gemini 3.1 Flash Lite Preview...");
      const items = await parseVocabularyWithGemini(geminiApiKey, text);
      
      if (items.length > 0) {
        const addedCount = await addCards(items);
        setSyncMessage(`Successfully parsed ${items.length} items. ${addedCount} new cards added.`);
        await loadDueCards();
      } else {
        setSyncMessage("No vocabulary found in the document.");
      }
    } catch (err: any) {
      console.error(err);
      setSyncMessage(`Error: ${err.message}`);
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMessage(null), 10000);
    }
  };

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2>Dashboard</h2>
        <div>
          {!token ? (
            <button 
              className="btn btn-primary" 
              onClick={login} 
              disabled={!isReady}
            >
              Sign in with Google
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--success)' }}>Connected</span>
              <button className="btn btn-secondary" onClick={logout} style={{ padding: '0.4rem 0.8rem', fontSize: '0.875rem' }}>
                Disconnect
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <RefreshCw size={20} className={syncing ? 'animate-pulse' : ''} /> Sync Vocabulary
        </h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          Import the latest notes from your Google Docs and convert them into flashcards using Gemini.
        </p>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button 
              className="btn btn-secondary" 
              disabled={syncing}
              onClick={handleSync}
            >
              {syncing ? <><Loader2 className="animate-pulse" size={18}/> Syncing...</> : 'Launch AI Sync'}
            </button>
            {syncMessage && (
                <span style={{ fontSize: '0.875rem', color: syncMessage.includes('Error') ? 'var(--error)' : 'var(--text-secondary)' }}>
                    {syncMessage}
                </span>
            )}
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Play size={20} /> Today's Review
        </h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          {dueCards.length > 0 
            ? `You have ${dueCards.length} cards due for review today.`
            : "You have no cards to review yet. Try syncing your vocabulary first."}
        </p>
        <button 
           className="btn btn-primary" 
           disabled={dueCards.length === 0}
           onClick={onStartQuiz}
        >
          Start Quiz Session
        </button>
      </div>
    </div>
  );
}
