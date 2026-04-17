import { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Globe, RefreshCcw, Loader, Trash2, XCircle } from 'lucide-react';
import { useLocalStorage } from '../hooks/useLocalStorage';

export interface Utterance {
  id: string;
  type: 'utterance' | 'system';
  originalText: string;
  translatedText?: string;
  status?: 'queued' | 'translating' | 'speaking' | 'completed' | 'canceled' | 'error';
  errorMessage?: string;
}

export default function MonologueREST({ geminiApiKey, textModelName = "gemini-3.1-flash-lite-preview", title = "MONOLOGUE" }: { geminiApiKey: string, textModelName?: string, title?: string }) {
  const [isRecording, setIsRecording] = useState(false);
  const [logs, setLogs] = useLocalStorage<Utterance[]>('uknow_monologue2_logs', []);
  const [activeProcessingCount, setActiveProcessingCount] = useState(0);
  
  const recognitionRef = useRef<any>(null);
  const logEndRef = useRef<HTMLDivElement | null>(null);
  const isActiveSessionRef = useRef(false);
  
  // Queue tracking
  const queueRef = useRef<{ id: string, text: string }[]>([]);
  const isWorkerRunningRef = useRef(false);
  const currentProcessingIdRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const canceledIdsRef = useRef<Set<string>>(new Set());

  const addSystemLog = (text: string) => {
    setLogs(prev => {
      const newLog: Utterance = { id: Math.random().toString(), type: 'system', originalText: text };
      const newLogs = [...prev, newLog];
      return newLogs.slice(-100);
    });
  };

  const updateLog = (id: string, partial: Partial<Utterance>) => {
    setLogs(prev => prev.map(l => l.id === id ? { ...l, ...partial } : l));
  };

  const clearLogs = () => {
    if (window.confirm("Do you want to clear the logs?")) {
      setLogs([]);
    }
  };

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // STT Setup
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      addSystemLog("SpeechRecognition API is not supported in this browser. Please use Chrome/Edge.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'ja-JP';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (transcript.trim()) {
        const id = Math.random().toString();
        setLogs(prev => {
          const newLog: Utterance = { id, type: 'utterance', originalText: transcript, status: 'queued' };
          const newArray = [...prev, newLog];
          return newArray.slice(-100);
        });
        queueRef.current.push({ id, text: transcript });
        processQueue();
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech Recognition Error:", event.error);
      if (event.error === 'not-allowed' || event.error === 'audio-capture') {
        addSystemLog(`Microphone access error (${event.error}). Please check permissions and try again.`);
        setIsRecording(false);
        isActiveSessionRef.current = false; // Stop the auto-restart loop
      }
    };

    recognition.onend = () => {
      // Non-blocking: automatically restart as long as session is active!
      if (isActiveSessionRef.current) {
        try { recognition.start(); } catch { /* ignore */ }
      } else {
        setIsRecording(false);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch { /* ignore */ }
      }
      window.speechSynthesis?.cancel(); // cleanup TTS
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const playBrowserTTS = (text: string, abortController: AbortController): Promise<void> => {
    return new Promise((resolve) => {
      if (!window.speechSynthesis) {
        resolve();
        return;
      }
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      
      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(v => v.name.includes("Google") && v.lang.startsWith("en")) 
                          || voices.find(v => v.lang === "en-US") 
                          || null;
      if (preferredVoice) utterance.voice = preferredVoice;

      let isDone = false;

      const finish = () => {
        if (isDone) return;
        isDone = true;
        abortController.signal.removeEventListener('abort', handleAbort);
        resolve();
      };

      const handleAbort = () => {
        window.speechSynthesis.cancel();
        finish();
      };
      
      // If already aborted before speaking
      if (abortController.signal.aborted) {
         finish();
         return;
      }
      
      abortController.signal.addEventListener('abort', handleAbort);

      utterance.onend = () => finish();
      utterance.onerror = (e) => {
        console.error("TTS Error", e);
        finish();
      };

      window.speechSynthesis.speak(utterance);
    });
  };

  const processQueue = async () => {
    if (isWorkerRunningRef.current) return;
    isWorkerRunningRef.current = true;
    setActiveProcessingCount(queueRef.current.length);

    while (queueRef.current.length > 0) {
      setActiveProcessingCount(queueRef.current.length);
      const item = queueRef.current[0];
      const { id, text } = item;
      
      if (canceledIdsRef.current.has(id)) {
        queueRef.current.shift();
        continue;
      }

      currentProcessingIdRef.current = id;
      updateLog(id, { status: 'translating' });

      try {
        const abortController = new AbortController();
        abortControllerRef.current = abortController;
        
        const translatePrompt = `You are a professional voice translator. Translate the following Japanese text into natural, flowing English. Output ONLY the English translation, without any quotes or conversational filler. \n\nInput: ${text}`;
        
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${textModelName}:generateContent?key=${geminiApiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: translatePrompt }] }]
          }),
          signal: abortController.signal
        });

        if (!response.ok) {
          const errData = await response.text();
          throw new Error(`API Error: ${response.status} ${errData}`);
        }

        const data = await response.json();
        let englishText = "";
        if (data.candidates && data.candidates[0].content.parts) {
          for (const part of data.candidates[0].content.parts) {
            if (part.text) englishText += part.text;
          }
        }

        const cleanEnglish = englishText.trim();
        if (!cleanEnglish) throw new Error("Translation output was empty");

        if (canceledIdsRef.current.has(id)) {
          throw new Error("AbortError");
        }

        updateLog(id, { translatedText: cleanEnglish, status: 'speaking' });
        await playBrowserTTS(cleanEnglish, abortController);
        
        if (canceledIdsRef.current.has(id)) {
           updateLog(id, { status: 'canceled' });
        } else {
           updateLog(id, { status: 'completed' });
        }
      } catch (err: any) {
        if (err.name === 'AbortError' || err.message === 'AbortError') {
          updateLog(id, { status: 'canceled' });
        } else {
          console.error(err);
          updateLog(id, { status: 'error', errorMessage: err.message || String(err) });
        }
      } finally {
        abortControllerRef.current = null;
        currentProcessingIdRef.current = null;
        queueRef.current.shift();
      }
    }
    
    isWorkerRunningRef.current = false;
    setActiveProcessingCount(0);
  };

  const cancelUtterance = (id: string) => {
    canceledIdsRef.current.add(id);
    updateLog(id, { status: 'canceled' });
    
    if (currentProcessingIdRef.current === id) {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      window.speechSynthesis.cancel();
    }
  };

  const startListening = () => {
    if (!recognitionRef.current) return;
    try {
      isActiveSessionRef.current = true;
      recognitionRef.current.start();
      setIsRecording(true);
      addSystemLog("MIC IS ON (Speak Japanese)...");
    } catch (err) {
      console.error(err);
    }
  };

  const stopListening = () => {
    if (!recognitionRef.current) return;
    try {
      isActiveSessionRef.current = false;
      recognitionRef.current.stop();
      setIsRecording(false);
      addSystemLog("MIC TURNED OFF");
    } catch (err) {
      console.error(err);
    }
  };

  const btnStyle = {
    backgroundColor: 'transparent',
    border: '1px solid currentColor',
    borderRadius: '4px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.9rem',
    textTransform: 'uppercase' as const,
    padding: '0.5rem 1rem',
    fontWeight: 'bold',
  };

  const statusColors = {
    queued: '#aaa',
    translating: 'var(--brand-primary)',
    speaking: 'var(--brand-primary)',
    completed: '#005000',
    canceled: '#ff3333',
    error: '#ff3333'
  };

  return (
    <div className="animate-fade-in glass-panel" style={{ padding: 'clamp(1rem, 4vw, 2rem)' }}>
      <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', color: '#00ff41' }}>
        <Globe size={24} /> {title}
      </h2>

      {/* Control Panel */}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '2rem', padding: '1.5rem', backgroundColor: 'rgba(0,0,0,0.3)', border: '1px dashed #005000', borderRadius: '4px' }}>
        <button 
          onClick={isRecording ? stopListening : startListening} 
          style={{ 
            ...btnStyle, 
            color: isRecording ? '#ff3333' : '#00ff41',
            borderColor: isRecording ? '#ff3333' : '#00ff41',
            backgroundColor: isRecording ? 'rgba(255,51,51,0.1)' : 'transparent',
          }}
        >
          {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
          {isRecording ? 'TURN OFF MIC' : 'TURN ON MIC'}
        </button>

        {activeProcessingCount > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--brand-primary)', fontWeight: 'bold' }}>
            <Loader size={18} className="animate-spin" />
            PROCESSING ({activeProcessingCount} ITEMS)
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: 'auto', fontWeight: 'bold', color: isRecording ? '#ff3333' : 'var(--text-tertiary)' }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: isRecording ? '#ff3333' : '#333', boxShadow: isRecording ? '0 0 8px #ff3333' : 'none', transition: 'all 0.3s' }}></div>
          {isRecording ? 'LISTENING (STT)...' : 'MIC OFF'}
        </div>
      </div>

      {/* Terminal Log */}
      <div style={{
        marginTop: '1.5rem',
        padding: '1.5rem',
        backgroundColor: '#0a0a00',
        border: '1px solid #005000',
        borderRadius: '4px',
        height: '400px',
        overflowY: 'auto',
        fontFamily: "'Fira Code', monospace"
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '0.9rem', color: '#005000', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <RefreshCcw size={14} /> ASYNC_PIPELINE_LOG
          </h3>
          {logs.length > 0 && (
            <button 
              onClick={clearLogs}
              style={{ backgroundColor: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem' }}
            >
              <Trash2 size={12} /> CLEAR
            </button>
          )}
        </div>
        
        {logs.length === 0 ? (
          <div style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>&gt; Ready waiting for microphone input...</div>
        ) : (
          logs.map((log) => (
            <div 
              key={log.id} 
              style={{
                marginBottom: '1rem',
                paddingBottom: '1rem',
                borderBottom: '1px dashed #222',
                fontSize: '0.9rem',
                color: '#888'
              }}
            >
              {log.type === 'system' ? (
                <div style={{ fontStyle: 'italic', color: '#005000' }}>
                  {log.originalText}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, whiteSpace: 'pre-wrap', lineHeight: 1.5, opacity: 0.9 }}>
                      <span style={{ marginRight: '0.5rem' }}>&gt;</span>
                      {log.status === 'canceled' ? <s>{log.originalText}</s> : log.originalText}
                    </div>
                    
                    {/* Status & Cancel Button */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', flexShrink: 0, marginLeft: '1rem' }}>
                      {log.status === 'canceled' ? (
                        <span style={{ color: statusColors.canceled, fontStyle: 'italic' }}>[CANCELED]</span>
                      ) : log.status === 'error' ? (
                        <span style={{ color: statusColors.error, fontStyle: 'italic' }}>[ERROR]</span>
                      ) : log.status === 'completed' ? (
                        <span style={{ color: statusColors.completed }}>[COMPLETED]</span>
                      ) : (
                        <span style={{ color: log.status ? statusColors[log.status] : '#888', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {(log.status === 'queued' || log.status === 'translating' || log.status === 'speaking') && (
                            <Loader size={12} className="animate-spin" />
                          )}
                          [{log.status?.toUpperCase()}]
                        </span>
                      )}

                      {/* Cancel Button */}
                      {(log.status === 'queued' || log.status === 'translating' || log.status === 'speaking') && (
                        <button 
                          onClick={() => cancelUtterance(log.id)}
                          style={{
                            backgroundColor: 'rgba(255,51,51,0.1)',
                            border: '1px solid #ff3333',
                            color: '#ff3333',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            padding: '0.1rem 0.4rem',
                            fontSize: '0.75rem',
                          }}
                        >
                          <XCircle size={10} /> CANCEL
                        </button>
                      )}
                    </div>
                  </div>

                  {log.translatedText && (
                    <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5, color: '#00ff41', display: 'flex' }}>
                       <span style={{ marginRight: '0.5rem' }}>&lt;</span>
                       <span style={{ textDecoration: log.status === 'canceled' ? 'line-through' : 'none' }}>
                         {log.translatedText}
                       </span>
                    </div>
                  )}
                  {log.errorMessage && (
                    <div style={{ color: statusColors.error, fontStyle: 'italic' }}>
                      <span style={{ marginRight: '0.5rem' }}>!</span> {log.errorMessage}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
        <div ref={logEndRef} />
      </div>
    </div>
  );
}
