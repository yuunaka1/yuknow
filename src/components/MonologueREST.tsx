import { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Globe, RefreshCcw, Loader, Trash2 } from 'lucide-react';
import { useLocalStorage } from '../hooks/useLocalStorage';

// removed base64 function

interface LogEntry {
  id: string;
  text: string;
  type: 'user' | 'bot' | 'system';
}

export default function MonologueREST({ geminiApiKey, textModelName = "gemini-3.1-flash-lite-preview", modelName, title = "MONOLOGUE 2 (REST)" }: { geminiApiKey: string, textModelName?: string, modelName: string, title?: string }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useLocalStorage<LogEntry[]>('uknow_monologue2_logs', []);
  
  const recognitionRef = useRef<any>(null);
  const logEndRef = useRef<HTMLDivElement | null>(null);
  const isActiveSessionRef = useRef(false);
  const isProcessingRef = useRef(false);

  const addLog = (text: string, type: 'user' | 'bot' | 'system') => {
    setLogs(prev => {
      const newLogs = [...prev, { id: Math.random().toString(), text, type }];
      return newLogs.slice(-100); // 過去100件まで保持
    });
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
      addLog("SpeechRecognition API is not supported in this browser. Please use Chrome/Edge.", "system");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'ja-JP';
    // continuous is false so we resolve per sentence/utterance
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (transcript.trim()) {
        addLog(transcript, "user");
        sendToGemini(transcript);
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech Recognition Error:", event.error);
      if (event.error === 'not-allowed') {
        addLog("Microphone access denied.", "system");
        setIsRecording(false);
      }
    };

    recognition.onend = () => {
      // Auto-restart if we are in an active session and NOT currently processing Gemini audio
      if (isActiveSessionRef.current && !isProcessingRef.current) {
        try { recognition.start(); } catch { /* ignore */ }
      } else if (!isActiveSessionRef.current) {
        setIsRecording(false);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        try { 
          recognitionRef.current.stop(); 
        } catch {
          // ignore
        }
      }
      // removed playbackAudioContext ref cleanup
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startListening = () => {
    if (!recognitionRef.current) return;
    try {
      isActiveSessionRef.current = true;
      recognitionRef.current.start();
      setIsRecording(true);
      addLog("MIC IS ON (Speak Japanese)...", "system");
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
      addLog("MIC TURNED OFF", "system");
    } catch (err) {
      console.error(err);
    }
  };

  const sendToGemini = async (japaneseText: string) => {
    setIsProcessing(true);
    isProcessingRef.current = true;
    try {
      // Step 1: Translate text
      const translatePrompt = `You are a professional voice translator. Translate the following Japanese text into natural, flowing English. Output ONLY the English translation, without any quotes or conversational filler. \n\nInput: ${japaneseText}`;
      
      const translatePayload = {
        contents: [
          { role: "user", parts: [{ text: translatePrompt }] }
        ]
      };

      const translateResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${textModelName}:generateContent?key=${geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(translatePayload)
      });

      if (!translateResponse.ok) {
        const errData = await translateResponse.text();
        throw new Error(`Translation API Error: ${translateResponse.status} - ${errData}`);
      }

      const translateData = await translateResponse.json();
      let englishText = "";
      if (translateData.candidates && translateData.candidates[0].content.parts) {
        for (const part of translateData.candidates[0].content.parts) {
          if (part.text) {
            englishText += part.text;
          }
        }
      }

      if (!englishText.trim()) {
        throw new Error("Failed to translate the text.");
      }

      // Display translation immediately
      addLog(englishText.trim(), "bot");

      // Step 2: Convert to TTS using Browser API
      await playBrowserTTS(englishText.trim());

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(err);
      addLog(`Error: ${errorMessage}`, "system");
    } finally {
      setIsProcessing(false);
      isProcessingRef.current = false;
      // Restart listening automatically if session is still active
      if (isActiveSessionRef.current) {
        try { recognitionRef.current?.start(); } catch { /* ignore */ }
      }
    }
  };

  const playBrowserTTS = (text: string): Promise<void> => {
    return new Promise((resolve) => {
      if (!window.speechSynthesis) {
        addLog("Browser TTS is not supported.", "system");
        resolve();
        return;
      }
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      
      // Try to find a high quality native voice if available
      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(v => v.name.includes("Google") && v.lang.startsWith("en")) 
                          || voices.find(v => v.lang === "en-US") 
                          || null;
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      utterance.onend = () => resolve();
      utterance.onerror = (e) => {
        console.error("TTS Error", e);
        resolve();
      };

      window.speechSynthesis.speak(utterance);
    });
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

  return (
    <div className="animate-fade-in glass-panel" style={{ padding: 'clamp(1rem, 4vw, 2rem)' }}>
      <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', color: '#00ff41' }}>
        <Globe size={24} /> {title}
      </h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
        [Native Browser TTS Mode] Text model: {textModelName}
      </p>

      {/* Control Panel */}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '2rem', padding: '1.5rem', backgroundColor: 'rgba(0,0,0,0.3)', border: '1px dashed #005000', borderRadius: '4px' }}>
        
        <button 
          onClick={isRecording ? stopListening : startListening} 
          disabled={isProcessing}
          style={{ 
            ...btnStyle, 
            color: isRecording ? '#ff3333' : isProcessing ? 'var(--text-tertiary)' : '#00ff41',
            borderColor: isRecording ? '#ff3333' : isProcessing ? 'var(--text-tertiary)' : '#00ff41',
            backgroundColor: isRecording ? 'rgba(255,51,51,0.1)' : 'transparent',
            opacity: isProcessing ? 0.5 : 1,
            cursor: isProcessing ? 'not-allowed' : 'pointer'
          }}
        >
          {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
          {isRecording ? 'TURN OFF MIC' : 'TURN ON MIC'}
        </button>

        {isProcessing && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--brand-primary)', fontWeight: 'bold' }}>
            <Loader size={18} className="animate-spin" />
            PROCESSING...
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
            <RefreshCcw size={14} /> REST_PIPELINE_LOG
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
                marginBottom: log.type === 'bot' ? '1.5rem' : '0.5rem',
                color: log.type === 'bot' ? '#00ff41' : log.type === 'user' ? '#888' : '#005000',
                fontSize: log.type === 'bot' ? '1.2rem' : '0.9rem',
                fontStyle: log.type === 'system' ? 'italic' : 'normal',
                opacity: log.type === 'user' ? 0.8 : 1,
              }}
            >
              <span style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                {log.type === 'user' && <span style={{ marginRight: '0.5rem' }}>&gt;</span>}
                {log.text}
              </span>
            </div>
          ))
        )}
        <div ref={logEndRef} />
      </div>
    </div>
  );
}
