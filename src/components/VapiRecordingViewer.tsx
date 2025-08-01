import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { 
  X, 
  Play, 
  Pause, 
  Download, 
  Clock, 
  User, 
  Phone,
  FileText,
  Volume2,
  VolumeX,
  RotateCcw,
  ExternalLink,
  XCircle
} from 'lucide-react';

interface VapiRecordingViewerProps {
  callId: string;
  recordingUrl: string;
  leadName: string;
  timestamp: string;
  onClose: () => void;
}

interface VapiCallData {
  id: string;
  status: string;
  duration: number;
  transcript?: string;
  summary?: string;
  recording_url?: string;
  created_at: string;
  ended_at?: string;
}

export function VapiRecordingViewer({ 
  callId, 
  recordingUrl, 
  leadName, 
  timestamp, 
  onClose 
}: VapiRecordingViewerProps) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [callData, setCallData] = useState<VapiCallData | null>(null);
  const [transcript, setTranscript] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioRef, setAudioRef] = useState<HTMLAudioElement | null>(null);
  const [liveStream, setLiveStream] = useState({ isLive: false });
  const [recordingCapture, setRecordingCapture] = useState({
    isRecording: false,
    audioChunks: [] as Blob[],
    capturedAudioUrl: null as string | null,
    websocket: null as WebSocket | null,
    connectionStatus: 'disconnected' as 'connecting' | 'connected' | 'disconnected' | 'error',
    audioDataReceived: 0,
    chunkCount: 0
  });

  useEffect(() => {
    // Check if this is a live stream (WebSocket URL)
    if (recordingUrl?.startsWith('wss://')) {
      setLiveStream({ isLive: true });
      setLoading(false);
      return;
    }
    
    // Only fetch data for completed calls with valid call ID
    if (callId && callId.trim() !== '') {
      fetchVapiData();
    } else {
      setLoading(false);
      setError('No call ID available for this recording');
    }
  }, [callId, recordingUrl]);

  const fetchVapiData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Call our edge function to fetch Vapi data
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vapi-call-data`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          call_id: callId,
          user_id: user?.id
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch call data: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      setCallData(data.call);
      setTranscript(data.transcript || 'Transcript not available');
      
    } catch (error) {
      console.error('Error fetching Vapi data:', error);
      setError(error instanceof Error ? error.message : 'Failed to load call data');
    } finally {
      setLoading(false);
    }
  };

  const handlePlayPause = () => {
    if (!audioRef) return;
    
    if (isPlaying) {
      audioRef.pause();
    } else {
      audioRef.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleMuteToggle = () => {
    if (!audioRef) return;
    audioRef.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef) return;
    const time = parseFloat(e.target.value);
    audioRef.currentTime = time;
    setCurrentTime(time);
  };

  const handleRestart = () => {
    if (!audioRef) return;
    audioRef.currentTime = 0;
    setCurrentTime(0);
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleDownloadRecording = () => {
    if (recordingUrl) {
      const link = document.createElement('a');
      link.href = recordingUrl;
      link.download = `call-recording-${leadName}-${new Date(timestamp).toISOString().split('T')[0]}.mp3`;
      link.click();
    }
  };

  const saveCapturedRecording = () => {
    // Implementation for saving captured recording
  };

  return (
    <div className={`fixed inset-0 z-50 overflow-y-auto ${
      theme === 'gold' ? 'bg-black/75' : 'bg-gray-900/50'
    }`}>
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className={`w-full max-w-4xl rounded-xl shadow-2xl ${
          theme === 'gold' ? 'black-card gold-border' : 'bg-white border border-gray-200'
        }`}>
          {/* Header */}
          <div className={`p-6 border-b ${
            theme === 'gold' ? 'border-yellow-400/20' : 'border-gray-200'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  theme === 'gold' ? 'gold-gradient' : 'bg-blue-100'
                }`}>
                  <Phone className={`h-6 w-6 ${
                    theme === 'gold' ? 'text-black' : 'text-blue-600'
                  }`} />
                </div>
                <div>
                  <h2 className={`text-xl font-bold ${
                    theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                  }`}>
                    Call Recording
                  </h2>
                  <p className={`text-sm ${
                    theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    {leadName} • {new Date(timestamp).toLocaleDateString()} {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className={`p-2 rounded-lg transition-colors ${
                  theme === 'gold'
                    ? 'text-gray-400 hover:bg-gray-800'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <div className={`animate-spin rounded-full h-8 w-8 border-2 border-transparent mx-auto mb-4 ${
                    theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
                  } ${theme === 'gold' ? 'border-t-yellow-400' : 'border-t-blue-600'}`}></div>
                  <p className={`text-sm ${
                    theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    Loading call data and transcription...
                  </p>
                </div>
              </div>
            ) : error ? (
              <div className={`text-center py-12 ${
                theme === 'gold' ? 'text-red-400' : 'text-red-600'
              }`}>
                <XCircle className="h-12 w-12 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Failed to Load Call Data</h3>
                <p className="text-sm mb-4">{error}</p>
                <button
                  onClick={fetchVapiData}
                  className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    theme === 'gold'
                      ? 'gold-gradient text-black hover-gold'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Retry
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Audio Player */}
                {recordingUrl && (
                  <div className={`p-6 rounded-lg border ${
                    theme === 'gold'
                      ? 'border-yellow-400/20 bg-black/20'
                      : 'border-gray-200 bg-gray-50'
                  }`}>
                    <div className="flex items-center space-x-3 mb-4">
                      <Volume2 className={`h-5 w-5 ${
                        theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
                      }`} />
                      <h3 className={`text-lg font-semibold ${
                        theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                      }`}>
                        Audio Recording
                      </h3>
                    </div>

                    {/* Audio Element */}
                    <audio
                      ref={setAudioRef}
                      src={recordingUrl}
                      onLoadedMetadata={(e) => {
                        const audio = e.target as HTMLAudioElement;
                        setDuration(audio.duration);
                      }}
                      onTimeUpdate={(e) => {
                        const audio = e.target as HTMLAudioElement;
                        setCurrentTime(audio.currentTime);
                      }}
                      onEnded={() => setIsPlaying(false)}
                      className="hidden"
                    />

                    {/* Custom Controls */}
                    <div className="space-y-4">
                      {/* Progress Bar */}
                      <div className="space-y-2">
                        <input
                          type="range"
                          min="0"
                          max={duration || 0}
                          value={currentTime}
                          onChange={handleSeek}
                          className={`w-full h-2 rounded-lg appearance-none cursor-pointer ${
                            theme === 'gold'
                              ? 'bg-gray-700 slider-thumb-gold'
                              : 'bg-gray-200 slider-thumb-blue'
                          }`}
                        />
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>{formatTime(currentTime)}</span>
                          <span>{formatTime(duration)}</span>
                        </div>
                      </div>

                      {/* Control Buttons */}
                      <div className="flex items-center justify-center space-x-4">
                        <button
                          onClick={handleRestart}
                          className={`p-2 rounded-lg transition-colors ${
                            theme === 'gold'
                              ? 'text-gray-400 hover:bg-gray-800'
                              : 'text-gray-600 hover:bg-gray-100'
                          }`}
                          title="Restart"
                        >
                          <RotateCcw className="h-5 w-5" />
                        </button>

                        <button
                          onClick={handlePlayPause}
                          className={`p-3 rounded-full transition-colors ${
                            theme === 'gold'
                              ? 'gold-gradient text-black hover-gold'
                              : 'bg-blue-600 text-white hover:bg-blue-700'
                          }`}
                          title={isPlaying ? 'Pause' : 'Play'}
                        >
                          {isPlaying ? (
                            <Pause className="h-6 w-6" />
                          ) : (
                            <Play className="h-6 w-6" />
                          )}
                        </button>

                        <button
                          onClick={handleMuteToggle}
                          className={`p-2 rounded-lg transition-colors ${
                            theme === 'gold'
                              ? 'text-gray-400 hover:bg-gray-800'
                              : 'text-gray-600 hover:bg-gray-100'
                          }`}
                          title={isMuted ? 'Unmute' : 'Mute'}
                        >
                          {isMuted ? (
                            <VolumeX className="h-5 w-5" />
                          ) : (
                            <Volume2 className="h-5 w-5" />
                          )}
                        </button>

                        <button
                          onClick={handleDownloadRecording}
                          className={`p-2 rounded-lg transition-colors ${
                            theme === 'gold'
                              ? 'text-gray-400 hover:bg-gray-800'
                              : 'text-gray-600 hover:bg-gray-100'
                          }`}
                          title="Download Recording"
                        >
                          <Download className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Call Details */}
                {callData && (
                  <div className={`p-6 rounded-lg border ${
                    theme === 'gold'
                      ? 'border-yellow-400/20 bg-black/20'
                      : 'border-gray-200 bg-gray-50'
                  }`}>
                    <div className="flex items-center space-x-3 mb-4">
                      <Clock className={`h-5 w-5 ${
                        theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
                      }`} />
                      <h3 className={`text-lg font-semibold ${
                        theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                      }`}>
                        Call Details
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <div className={`text-sm font-medium ${
                          theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                          Status
                        </div>
                        <div className={`text-lg ${
                          theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
                        }`}>
                          {callData.status?.charAt(0).toUpperCase() + callData.status?.slice(1)}
                        </div>
                      </div>

                      <div>
                        <div className={`text-sm font-medium ${
                          theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                          Duration
                        </div>
                        <div className={`text-lg ${
                          theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
                        }`}>
                          {formatTime(callData.duration || 0)}
                        </div>
                      </div>

                      <div>
                        <div className={`text-sm font-medium ${
                          theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                          Call ID
                        </div>
                        <div className={`text-sm font-mono ${
                          theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          {callData.id}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Transcript */}
                <div className={`p-6 rounded-lg border ${
                  theme === 'gold'
                    ? 'border-yellow-400/20 bg-black/20'
                    : 'border-gray-200 bg-gray-50'
                }`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <FileText className={`h-5 w-5 ${
                        theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
                      }`} />
                      <h3 className={`text-lg font-semibold ${
                        theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                      }`}>
                        Conversation Transcript
                      </h3>
                    </div>
                    
                    {transcript && transcript !== 'Transcript not available' && (
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(transcript);
                        }}
                        className={`text-xs px-3 py-1 rounded-lg transition-colors ${
                          theme === 'gold'
                            ? 'border border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10'
                            : 'border border-gray-300 text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        Copy Transcript
                      </button>
                    )}
                  </div>

                  <div className={`max-h-64 overflow-y-auto p-4 rounded-lg ${
                    theme === 'gold' ? 'bg-black/30' : 'bg-white'
                  }`}>
                    {transcript ? (
                      <div className={`text-sm whitespace-pre-wrap ${
                        theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        {transcript}
                      </div>
                    ) : (
                      <div className={`text-center py-8 ${
                        theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
                      }`}>
                        <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>Transcript not available</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Call Summary */}
                {callData?.summary && (
                  <div className={`p-6 rounded-lg border ${
                    theme === 'gold'
                      ? 'border-yellow-400/20 bg-black/20'
                      : 'border-gray-200 bg-gray-50'
                  }`}>
                    <div className="flex items-center space-x-3 mb-4">
                      <User className={`h-5 w-5 ${
                        theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
                      }`} />
                      <h3 className={`text-lg font-semibold ${
                        theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                      }`}>
                        Call Summary
                      </h3>
                    </div>
                    <p className={`text-sm ${
                      theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      {callData.summary}
                    </p>
                  </div>
                )}

                {/* External Link to Vapi Dashboard */}
                {callId && (
                  <div className="flex justify-center">
                    <a
                      href={`https://dashboard.vapi.ai/call/${callId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`inline-flex items-center px-4 py-2 text-sm rounded-lg border transition-colors ${
                        theme === 'gold'
                          ? 'border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10'
                          : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      View in Vapi Dashboard
                    </a>
                    <button
                      onClick={saveCapturedRecording}
                      className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ml-2 ${
                        theme === 'gold'
                          ? 'border border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10'
                          : 'border border-gray-300 text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Save to Database
                    </button>
                  </div>
                )}
                
                {/* Live Stream Info */}
                {liveStream.isLive && (
                  <div className={`p-4 rounded-lg ${
                    theme === 'gold'
                      ? 'bg-blue-500/10 border border-blue-500/20'
                      : 'bg-blue-50 border border-blue-200'
                  }`}>
                    <h5 className={`text-sm font-medium mb-2 ${
                      theme === 'gold' ? 'text-blue-400' : 'text-blue-700'
                    }`}>
                      💡 Live Stream Information
                    </h5>
                    <ul className={`text-sm space-y-1 ${
                      theme === 'gold' ? 'text-blue-300' : 'text-blue-600'
                    }`}>
                      <li>• This is a live call stream - audio data is received in real-time</li>
                      <li>• Transcript updates automatically as the conversation progresses</li>
                      <li>• Audio chunks are captured but not yet converted to playable format</li>
                      <li>• For completed calls, use the Vapi API to get the final recording URL</li>
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}