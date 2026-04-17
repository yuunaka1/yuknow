import { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Globe, Wifi, WifiOff, RefreshCcw } from 'lucide-react';

const WEBSOCKET_URL = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent";
const SAMPLE_RATE = 16000;

function base64ToArrayBuffer(base64: string) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

interface LogEntry {
  id: string;
  text: string;
  type: 'user' | 'bot' | 'system';
}

export default function LiveTranslation({ geminiApiKey, modelName }: { geminiApiKey: string, modelName: string }) {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const nextPlayTimeRef = useRef<number>(0);
  const logEndRef = useRef<HTMLDivElement | null>(null);

  const addLog = (text: string, type: 'user' | 'bot' | 'system') => {
    setLogs(prev => {
      // Append text to the last bot log if the previous one was also a bot log to prevent scattering
      if (type === 'bot' && prev.length > 0 && prev[prev.length - 1].type === 'bot') {
        const newLogs = [...prev];
        newLogs[newLogs.length - 1].text += " " + text;
        return newLogs;
      }
      return [...prev, { id: Math.random().toString(), text, type }];
    });
  };

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const connect = () => {
    if (wsRef.current) return;
    
    addLog("Connecting to Gemini Live API via WebSocket...", "system");
    const ws = new WebSocket(`${WEBSOCKET_URL}?key=${geminiApiKey}`);
    wsRef.current = ws;

    ws.onopen = () => {
      addLog("WebSocket connected.", "system");
      setIsConnected(true);
      
      const setupMsg = {
        setup: {
          model: `models/${modelName}`,
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: "Kore"
                }
              }
            }
          },
          systemInstruction: {
            parts: [{ text: "You are a professional, real-time voice translator. Listen to the Japanese speech from the user, translate it into natural, flowing English, and output ONLY the spoken English translation. Do not add conversational filler, do not reply as an assistant, just translate." }]
          }
        }
      };
      ws.send(JSON.stringify(setupMsg));
    };

    ws.onmessage = async (event) => {
      let data;
      if (event.data instanceof Blob) {
        const text = await event.data.text();
        data = JSON.parse(text);
      } else {
        data = JSON.parse(event.data);
      }

      if (data.serverContent?.modelTurn) {
        const parts = data.serverContent.modelTurn.parts;
        for (const part of parts) {
          if (part.text) {
             addLog(part.text, "bot");
          }
          if (part.inlineData) {
             playAudioChunk(part.inlineData.data, part.inlineData.mimeType);
          }
        }
      } else if (data.serverContent?.turnComplete) {
         // Optionally reset playback clock if needed, or leave it
      }
    };

    ws.onclose = () => {
      addLog("WebSocket disconnected.", "system");
      setIsConnected(false);
      stopRecording();
      wsRef.current = null;
    };

    ws.onerror = (e) => {
      console.error(e);
      addLog("WebSocket error encountered.", "system");
    };
  };

  const disconnect = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    stopRecording();
    setIsConnected(false);
  };

  const startRecording = async () => {
    if (!isConnected || !wsRef.current || isRecording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: SAMPLE_RATE,
          echoCancellation: true,
          noiseSuppression: true
        } 
      });
      mediaStreamRef.current = stream;

      const actx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: SAMPLE_RATE });
      audioContextRef.current = actx;
      const source = actx.createMediaStreamSource(stream);

      // Using ScriptProcessorNode as a simple raw PCM encoder
      const scriptProcessor = actx.createScriptProcessor(4096, 1, 1);
      scriptProcessorRef.current = scriptProcessor;

      // Fixing `onaudioprocess` base64 encoding logic to prevent call stack issues
      scriptProcessor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const pcmData = new Int16Array(inputData.length);
        
        for (let i = 0; i < inputData.length; i++) {
          let s = Math.max(-1, Math.min(1, inputData[i]));
          pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        const uint8 = new Uint8Array(pcmData.buffer);
        // Safely convert Uint8Array to Base64
        const binary = Array.from(uint8).map(byte => String.fromCharCode(byte)).join('');
        const base64 = btoa(binary);

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          const msg = {
            realtimeInput: {
              mediaChunks: [{
                mimeType: `audio/pcm;rate=${SAMPLE_RATE}`,
                data: base64
              }]
            }
          };
          wsRef.current.send(JSON.stringify(msg));
        }
      };

      source.connect(scriptProcessor);
      scriptProcessor.connect(actx.destination);
      
      setIsRecording(true);
      addLog("Microphone is LIVE. Speak Japanese freely.", "system");
      
    } catch (err) {
      console.error(err);
      addLog("Failed to access microphone.", "system");
    }
  };

  const stopRecording = () => {
    if (!isRecording) return;
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(console.error);
      audioContextRef.current = null;
      nextPlayTimeRef.current = 0;
    }
    setIsRecording(false);
    addLog("Microphone muted.", "system");
  };

  const playAudioChunk = async (base64Data: string, mimeType: string) => {
     if (!audioContextRef.current) {
       audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: SAMPLE_RATE });
     }
     const actx = audioContextRef.current;
     
     const matchRate = mimeType.match(/rate=(\d+)/);
     const outRate = matchRate ? parseInt(matchRate[1]) : 24000;

     const arrayBuffer = base64ToArrayBuffer(base64Data);
     const int16Array = new Int16Array(arrayBuffer);
     
     const audioBuffer = actx.createBuffer(1, int16Array.length, outRate);
     const channelData = audioBuffer.getChannelData(0);
     for (let i = 0; i < int16Array.length; i++) {
         channelData[i] = int16Array[i] / 32768.0;
     }

     const source = actx.createBufferSource();
     source.buffer = audioBuffer;
     source.connect(actx.destination);
     
     if (nextPlayTimeRef.current < actx.currentTime) {
         nextPlayTimeRef.current = actx.currentTime;
     }
     source.start(nextPlayTimeRef.current);
     nextPlayTimeRef.current += audioBuffer.duration;
  };

  useEffect(() => {
    return () => disconnect();
  }, []);

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
        <Globe size={24} /> MONOLOGUE
      </h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
        Real-time Voice-to-Voice Multimodal Interface. Powered by {modelName}.
      </p>

      {/* Control Panel */}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '2rem', padding: '1.5rem', backgroundColor: 'rgba(0,0,0,0.3)', border: '1px dashed #005000', borderRadius: '4px' }}>
        {!isConnected ? (
          <button 
            onClick={connect} 
            style={{ ...btnStyle, color: '#00ff41', borderColor: '#00ff41' }}
          >
            <Wifi size={18} /> CONNECT
          </button>
        ) : (
          <button 
            onClick={disconnect} 
            style={{ ...btnStyle, color: '#ff4444', borderColor: '#ff4444' }}
          >
            <WifiOff size={18} /> DISCONNECT
          </button>
        )}

        <div style={{ width: '1px', backgroundColor: '#005000', margin: '0 0.5rem' }}></div>

        {isConnected && (
          <button 
            onClick={isRecording ? stopRecording : startRecording} 
            style={{ 
              ...btnStyle, 
              color: isRecording ? '#ff3333' : '#00ff41',
              borderColor: isRecording ? '#ff3333' : '#00ff41',
              backgroundColor: isRecording ? 'rgba(255,51,51,0.1)' : 'transparent'
            }}
          >
            {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
            {isRecording ? 'MUTE MIC' : 'LIVE MIC'}
          </button>
        )}
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
        <h3 style={{ fontSize: '0.9rem', color: '#005000', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <RefreshCcw size={14} /> LIVE_STREAM_LOG
        </h3>
        
        {logs.length === 0 ? (
          <div style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>&gt; Ready formatting sequence...</div>
        ) : (
          logs.map((log) => (
            <div 
              key={log.id} 
              style={{
                marginBottom: '1rem',
                color: log.type === 'bot' ? '#00ff41' : log.type === 'user' ? '#fff' : '#005000',
                borderLeft: `2px solid ${log.type === 'bot' ? '#00ff41' : log.type === 'system' ? '#005000' : '#fff'}`,
                paddingLeft: '1rem'
              }}
            >
              <div style={{ fontSize: '0.75rem', opacity: 0.7, marginBottom: '0.2rem' }}>
                [{log.type.toUpperCase()}]
              </div>
              <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{log.text}</div>
            </div>
          ))
        )}
        <div ref={logEndRef} />
      </div>
    </div>
  );
}
