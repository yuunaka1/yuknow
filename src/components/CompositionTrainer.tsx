import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, Globe, Loader, AlertTriangle, GraduationCap, LogOut, Trash2 } from 'lucide-react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { AudioStreamPlayer, AudioRecorder } from '../utils/audioUtils';

type LiveState = 'idle' | 'connecting' | 'listening' | 'processing' | 'speaking' | 'error';
type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

interface LogMessage {
  id: string;
  sender: 'user' | 'model' | 'system';
  text: string;
  isStream?: boolean;
}

export default function CompositionTrainer({ geminiApiKey }: { geminiApiKey: string }) {
  const [appState, setAppState] = useState<LiveState>('idle');
  const [logs, setLogs] = useLocalStorage<LogMessage[]>('uknow_composition_logs', []);
  const [errorDetails, setErrorDetails] = useState("");
  const [trainingLevel, setTrainingLevel] = useLocalStorage<CEFRLevel>('uknow_composition_level', 'B1');

  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<AudioRecorder | null>(null);
  const playerRef = useRef<AudioStreamPlayer | null>(null);
  const logEndRef = useRef<HTMLDivElement | null>(null);
  const wakeLockRef = useRef<any>(null);

  const modelOverride = "models/gemini-3.1-flash-live-preview";

  const addLog = useCallback((text: string, sender: 'user' | 'model' | 'system', isStream: boolean = false) => {
    setLogs(prev => {
      const last = prev[prev.length - 1];
      if (last && last.sender === sender && last.isStream) {
        const newLogs = [...prev];
        newLogs[newLogs.length - 1] = { ...last, text: last.text + text, isStream };
        return newLogs;
      }
      const arr = [...prev, { id: Math.random().toString(), text, sender, isStream }];
      return arr.slice(-150);
    });
  }, [setLogs]);

  const finalizeStream = useCallback((sender: 'user' | 'model') => {
    setLogs(prev => {
      const last = prev[prev.length - 1];
      if (last && last.sender === sender && last.isStream) {
        const newLogs = [...prev];
        newLogs[newLogs.length - 1] = { ...last, isStream: false };
        return newLogs;
      }
      return prev;
    });
  }, [setLogs]);

  const clearLogs = () => {
    if (window.confirm("Clear Session Logs?")) setLogs([]);
  };

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const startSession = async () => {
    if (!geminiApiKey) {
      addLog("API Key missing.", "system");
      return;
    }

    try {
      setAppState('connecting');
      setErrorDetails("");
      playerRef.current = new AudioStreamPlayer();
      recorderRef.current = new AudioRecorder();

      if ('wakeLock' in navigator) {
        try {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
          addLog("Screen wake lock acquired.", "system");
        } catch (err: any) {
          console.warn("Wake lock failed:", err);
        }
      }

      const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${geminiApiKey}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        addLog(`Connected to Trainer API (${modelOverride}, Level: ${trainingLevel})`, "system");
        
        const systemPrompt = `You are a continuous English composition trainer. The current difficulty level is CEFR ${trainingLevel}.
Reflex Training Loop:
1. Provide a Japanese sentence for the user to translate. 
   CRITICAL: ONLY say the Japanese sentence itself. Do NOT add conversational fillers like "How do you say...", "Translate this...", or "Here is the next one:". Just output the bare Japanese sentence.
2. Wait for the user to say the English translation.
3. Provide concise verbal feedback.
  - Praise what they did well.
  - Correct unnatural phrasing or grammar.
  - Provide a native alternative.
  - Speak your explanations in Japanese, but pronounce the English examples clearly in English.
4. Immediately output the next Japanese sentence to translate.
   CRITICAL: Again, ONLY say the Japanese sentence. Do NOT say anything else.
Do not break this loop. Keep feedback practical and short. Speak naturally.`;

        const setupMsg = {
          setup: {
            model: modelOverride,
            generationConfig: {
              responseModalities: ["AUDIO"],
            },
            systemInstruction: {
              parts: [{ text: systemPrompt }]
            },
            inputAudioTranscription: {},
            outputAudioTranscription: {}
          }
        };
        ws.send(JSON.stringify(setupMsg));
      };

      ws.onclose = (event) => {
        stopSession();
        if (event.code !== 1000) {
           let detail = "";
           if (event.code === 1007) detail = "(1007: Unsupported Payload/Model Mismatch.)";
           addLog(`Disconnected (${event.code}) ${detail}`, "system");
           setErrorDetails(`Disconnect code: ${event.code} ${detail}`);
           setAppState('error');
        } else {
           addLog("Session ended gracefully.", "system");
        }
      };

      ws.onerror = (e) => {
        console.error("WebSocket Error", e);
        setAppState('error');
        addLog("WebSocket Error occurred.", "system");
      };

      ws.onmessage = async (event) => {
        let msgStr = "";
        if (event.data instanceof Blob) {
           msgStr = await event.data.text();
        } else {
           msgStr = event.data;
        }

        try {
          const payload = JSON.parse(msgStr);

          if (payload.setupComplete) {
            setAppState('listening');
            addLog(`Training session started at level ${trainingLevel}. Listening...`, "system");
            
            // Trigger the AI to speak the first sentence automatically
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              const triggerMsg = {
                clientContent: {
                  turns: [{
                    role: "user",
                    parts: [{ text: "Start the training now." }]
                  }],
                  turnComplete: true
                }
              };
              wsRef.current.send(JSON.stringify(triggerMsg));
            }

            // Delay microphone streaming slightly to avoid a known race condition 1008 
            // where realtimeInput streaming collides with the initial clientContent parsing.
            setTimeout(async () => {
              if (wsRef.current?.readyState !== WebSocket.OPEN) return;
              await recorderRef.current?.start((base64pcm) => {
                 if (wsRef.current?.readyState === WebSocket.OPEN) {
                   const audioMessage = {
                     realtimeInput: {
                       audio: { mimeType: "audio/pcm;rate=16000", data: base64pcm }
                     }
                   };
                   wsRef.current.send(JSON.stringify(audioMessage));
                 }
              });
            }, 800);
          }

          if (payload.serverContent) {
             const content = payload.serverContent;
             
             if (content.interrupted) {
                addLog("Interrupted by user.", "system");
                playerRef.current?.stop();
                finalizeStream('model');
                finalizeStream('user');
                setAppState('listening');
             }

             if (content.modelTurn) {
                finalizeStream('user');
                if (content.modelTurn.parts) {
                   for (const part of content.modelTurn.parts) {
                     if (part.text) {
                        addLog(part.text, "model", true);
                     }
                     if (part.inlineData && part.inlineData.mimeType.startsWith("audio/pcm")) {
                        setAppState('speaking');
                        await playerRef.current?.playPcmData(part.inlineData.data);
                     }
                   }
                }
             }

             if (content.inputTranscription && content.inputTranscription.text) {
                addLog(content.inputTranscription.text, "user", true);
             }
             
             if (content.outputTranscription && content.outputTranscription.text) {
                addLog(content.outputTranscription.text, "model", true);
             }
             
             if (content.turnComplete) {
                setAppState('listening');
                finalizeStream('model');
             }
          }

        } catch (e) {
          console.error("Message Parsing Error:", e);
        }
      };

    } catch (e: any) {
      console.error(e);
      setAppState('error');
      setErrorDetails(e.message);
      addLog(`Failed to start session: ${e.message}`, "system");
    }
  };

  const stopSession = useCallback(() => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    
    playerRef.current?.stop();
    playerRef.current = null;
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    if (wakeLockRef.current) {
      wakeLockRef.current.release().catch(console.warn);
      wakeLockRef.current = null;
    }
    
    setAppState(prev => (prev !== 'idle' && prev !== 'error' ? 'idle' : prev));
  }, []);

  useEffect(() => {
    return () => {
      stopSession();
    };
  }, [stopSession]);

  const btnBaseStyles = {
    padding: '0.5rem 1rem',
    borderRadius: '6px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    fontSize: '0.85rem',
    fontWeight: 'bold',
    textTransform: 'uppercase' as const,
    border: '1px solid currentColor',
    transition: 'all 0.2s',
  };

  const statusColors = {
    idle: '#aaa',
    connecting: '#ffaa00',
    listening: '#00ccff',
    processing: 'var(--brand-primary)',
    speaking: 'var(--brand-primary)',
    error: '#ff3333'
  };

  const currentColor = statusColors[appState];

  return (
    <div className="animate-fade-in glass-panel" style={{ padding: 'clamp(1rem, 2vw, 1.5rem)', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 140px)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#00ccff', margin: 0, fontSize: '1.25rem' }}>
          <GraduationCap size={20} /> REFLEX
        </h2>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <select
            value={trainingLevel}
            onChange={(e) => setTrainingLevel(e.target.value as CEFRLevel)}
            disabled={appState !== 'idle' && appState !== 'error'}
            style={{ 
              padding: '0.4rem 0.5rem', 
              borderRadius: '4px', 
              backgroundColor: 'rgba(0, 204, 255, 0.1)', 
              color: '#00ccff', 
              border: '1px solid #00ccff', 
              fontSize: '0.85rem',
              outline: 'none',
              cursor: (appState === 'idle' || appState === 'error') ? 'pointer' : 'not-allowed'
            }}
          >
            {['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map(level => (
              <option key={level} value={level} style={{ backgroundColor: '#0a0a0a' }}>CEFR: {level}</option>
            ))}
          </select>

          {appState === 'idle' || appState === 'error' ? (
            <button 
              onClick={startSession}
              style={{ ...btnBaseStyles, color: '#00ccff', backgroundColor: 'rgba(0, 204, 255, 0.1)' }}
            >
              <Mic size={16} /> START
            </button>
          ) : (
            <button 
              onClick={stopSession}
              style={{ ...btnBaseStyles, color: '#ff3333', backgroundColor: 'rgba(255, 51, 51, 0.1)' }}
            >
              <LogOut size={16} /> END
            </button>
          )}

          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.4rem', 
            fontWeight: 'bold', 
            color: currentColor,
            backgroundColor: 'rgba(0,0,0,0.4)',
            padding: '0.4rem 0.75rem',
            borderRadius: '4px',
            border: `1px solid ${currentColor}22`,
            fontSize: '0.85rem'
          }}>
            {(appState === 'connecting' || appState === 'processing') && <Loader size={14} className="animate-spin" />}
            {appState === 'error' && <AlertTriangle size={14} />}
            {appState === 'listening' && <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: currentColor, boxShadow: `0 0 8px ${currentColor}`, animation: 'pulse 1.5s infinite' }}></div>}
            {appState === 'speaking' && <Globe size={14} className="animate-pulse" />}
            
            <span style={{ letterSpacing: '1px' }}>{appState.toUpperCase()}</span>
          </div>
        </div>
      </div>

      {errorDetails && (
         <div style={{ padding: '1rem', marginBottom: '2rem', color: '#ff3333', backgroundColor: 'rgba(255,0,0,0.1)', border: '1px solid #ff3333', borderRadius: '4px' }}>
            <AlertTriangle size={18} style={{ marginBottom: '0.5rem' }}/>
            <br />
            {errorDetails}
         </div>
      )}

      <div style={{
        flex: 1,
        padding: '1rem',
        backgroundColor: '#050a14',
        border: '1px solid #002244',
        borderRadius: '4px',
        overflowY: 'auto',
        fontFamily: "'Fira Code', monospace"
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '0.9rem', color: '#0055aa', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            TRAINING_STREAM_LOG
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
          <div style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>&gt; Select a level and START to begin...</div>
        ) : (
          logs.map((log) => (
            <div 
              key={log.id} 
              style={{
                marginBottom: '0.5rem',
                color: log.sender === 'model' ? '#00ccff' : log.sender === 'user' ? '#888' : '#0055aa',
                fontSize: '0.9rem',
                fontStyle: log.sender === 'system' ? 'italic' : 'normal',
                opacity: log.sender === 'system' ? 0.7 : 1,
              }}
            >
              <span style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                {log.sender === 'user' ? '> ' : log.sender === 'model' ? '< ' : '* '}
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
