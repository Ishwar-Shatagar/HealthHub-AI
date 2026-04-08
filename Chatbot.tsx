
import React, { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import { ICONS, LANGUAGES } from '../constants';
import { Page, ChatMessage, UserProfile, DailyLog, ReportAnalysis } from '../types';
import { getDashboardChatConfig, getReportChatConfig, initializeLiveChat } from '../services/geminiService';
import { getErrorMessage, decode, decodeAudioData, createBlob } from '../utils/helpers';
import { GoogleGenAI, Chat, LiveServerMessage } from '@google/genai';

interface ChatbotProps {
    isOpen: boolean;
    onClose: () => void;
    user: UserProfile;
    contextData: { dailyLog?: DailyLog, reportAnalysis?: ReportAnalysis };
    language: string;
    setLanguage: (lang: string) => void;
    mode: 'dashboard' | 'report';
    isEmbedded?: boolean;
}

const QUICK_ACTIONS = [
    "Summarize my day",
    "Show my diet plan",
    "Analyze my latest report",
    "Find nearby clinics",
    "What is my BMI?",
    "Suggest a healthy snack",
    "My daily calorie goal?",
    "Suggest a workout",
    "How to lose weight?",
    "How to gain weight?",
    "Check my report status",
    "Help me relax",
    "Start a voice chat",
    "Show exercise guide"
];

const PAGE_NAME_MAP: Record<string, string> = {
    DIET_PLANNER: 'Personalized Diet Plan',
    REPORT_ANALYZER: 'Medical Report Analyzer',
    CALORIE_COUNTER: 'AI Calorie Counter',
    EXERCISE_CORNER: 'Exercise Corner',
    TODAYS_GOAL: 'Today\'s Goal',
    LOCATION_TRACKER: 'Nearby Health Services',
};

const parseModelResponse = (text: string) => {
    const navRegex = /\[NAVIGATE_TO:(\w+)\]/;
    const match = text.match(navRegex);

    if (match && match[1]) {
        const page = match[1] as Page;
        const cleanText = text.replace(navRegex, '').trim();
        const label = `Go to ${PAGE_NAME_MAP[page] || page}`;
        return { cleanText, navigation: { page, label } };
    }

    return { cleanText: text, navigation: null };
};

// Moved outside to prevent re-renders
const SpeechButton: React.FC<{ textToSpeak: string; language: string }> = ({ textToSpeak, language }) => {
    const [isSpeaking, setIsSpeaking] = useState(false);
    const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
    const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

    useEffect(() => {
        const handleVoicesChanged = () => {
            setVoices(window.speechSynthesis.getVoices());
        };
        window.speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged);
        handleVoicesChanged();

        const u = new SpeechSynthesisUtterance();
        utteranceRef.current = u;
        u.onstart = () => setIsSpeaking(true);
        u.onend = () => setIsSpeaking(false);
        u.onerror = (e: SpeechSynthesisErrorEvent) => {
            if (e.error !== 'interrupted') {
                console.error("Speech synthesis error:", e.error);
            }
            setIsSpeaking(false);
        };

        return () => {
            window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
            window.speechSynthesis.cancel();
        };
    }, []);

    const handleToggleSpeech = () => {
        if (!utteranceRef.current) return;

        if (isSpeaking) {
            window.speechSynthesis.cancel();
        } else {
            window.speechSynthesis.cancel(); // Stop any other speech
            utteranceRef.current.text = textToSpeak;

            const langCodeMap: { [key: string]: string } = {
                'English': 'en-US', 'Hindi': 'hi-IN', 'Kannada': 'kn-IN', 'Tamil': 'ta-IN',
                'Telugu': 'te-IN', 'Bengali': 'bn-IN', 'Marathi': 'mr-IN', 'Gujarati': 'gu-IN'
            };
            const langCode = langCodeMap[language] || 'en-US';
            utteranceRef.current.lang = langCode;
            const bestVoice = voices.find(v => v.lang === langCode) || voices.find(v => v.lang.startsWith(langCode.split('-')[0]));
            utteranceRef.current.voice = bestVoice || null;

            window.speechSynthesis.speak(utteranceRef.current);
        }
    };

    return (
        <button
            onClick={handleToggleSpeech}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full text-gray-400 hover:text-green-500 focus:outline-none ml-1"
            aria-label={isSpeaking ? 'Stop reading' : 'Read aloud'}
        >
            {isSpeaking ? ICONS.speakerOff : ICONS.speaker}
        </button>
    );
};

const Chatbot: React.FC<ChatbotProps> = ({ isOpen, onClose, user, contextData, language, setLanguage, mode, isEmbedded = false }) => {
    const { navigateTo } = useAppContext();

    // Chat State
    const [chat, setChat] = useState<Chat | null>(null);
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [isChatLoading, setIsChatLoading] = useState(false);
    const [showQuickActions, setShowQuickActions] = useState(true);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const [systemInstruction, setSystemInstruction] = useState('');

    // Voice Chat State
    const [isVoiceMode, setIsVoiceMode] = useState(false);
    const [liveSession, setLiveSession] = useState<any>(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [currentInputTranscription, setCurrentInputTranscription] = useState('');
    const [currentOutputTranscription, setCurrentOutputTranscription] = useState('');

    const micStream = useRef<MediaStream | null>(null);
    const inputAudioContext = useRef<AudioContext | null>(null);
    const scriptProcessor = useRef<ScriptProcessorNode | null>(null);
    const sourceNode = useRef<MediaStreamAudioSourceNode | null>(null);
    const outputAudioContext = useRef<AudioContext | null>(null);
    const nextStartTime = useRef(0);
    const audioPlaybackSources = useRef(new Set<AudioBufferSourceNode>());
    const prevLanguageRef = useRef(language);
    const isVoiceActiveRef = useRef(false);

    useEffect(() => {
        const languageChanged = prevLanguageRef.current !== language;
        if (isVoiceMode && languageChanged) {
            stopVoiceMode();
            prevLanguageRef.current = language;
            return;
        }
        prevLanguageRef.current = language;

        if (!isOpen && !isEmbedded) {
            if (isVoiceMode) stopVoiceMode();
            return;
        }

        let config;
        if (mode === 'dashboard' && contextData.dailyLog) {
            config = getDashboardChatConfig(user, contextData.dailyLog, language);
        } else if (mode === 'report' && contextData.reportAnalysis) {
            config = getReportChatConfig(contextData.reportAnalysis, user, language);
        } else {
            return;
        }

        setSystemInstruction(config.systemInstruction);

        if (!isVoiceMode) {
            const chatSession = new GoogleGenAI({ apiKey: process.env.API_KEY }).chats.create({
                model: 'gemini-3.1-pro',
                config: {
                    systemInstruction: config.systemInstruction
                },
                history: config.initialHistory
            });
            setChat(chatSession);
            setChatHistory(config.initialHistory);
            setShowQuickActions(mode === 'dashboard');
        } else {
            setChatHistory([{ role: 'model', parts: [{ text: 'Listening...' }] }]);
        }

    }, [isOpen, user, contextData, language, mode, isVoiceMode, isEmbedded]);

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [chatHistory, currentInputTranscription, currentOutputTranscription]);


    const sendMessage = async (messageText: string) => {
        if (!messageText.trim() || !chat || isChatLoading) return;

        setShowQuickActions(false);
        const userMessage: ChatMessage = { role: 'user', parts: [{ text: messageText }] };
        setChatHistory(prev => [...prev, userMessage]);
        setIsChatLoading(true);

        try {
            const responseStream = await chat.sendMessageStream({ message: messageText });
            setIsChatLoading(false);
            setChatHistory(prev => [...prev, { role: 'model', parts: [{ text: '' }] }]);

            let accumulatedText = '';
            for await (const chunk of responseStream) {
                accumulatedText += chunk.text;
                setChatHistory(prev => {
                    const newHistory = [...prev];
                    const lastMessage = newHistory[newHistory.length - 1];
                    if (lastMessage && lastMessage.role === 'model') {
                        lastMessage.parts[0].text = accumulatedText;
                    }
                    return newHistory;
                });
            }
        } catch (err) {
            setIsChatLoading(false);
            const errorMessage: ChatMessage = {
                role: 'model',
                parts: [{ text: `Sorry, I encountered an error. ${getErrorMessage(err)}` }]
            };
            setChatHistory(prev => [...prev, errorMessage]);
        }
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        sendMessage(chatInput);
        setChatInput('');
    };

    const handleQuickActionClick = (action: string) => {
        if (action === "Start a voice chat") {
            startVoiceMode();
        } else {
            sendMessage(action);
        }
    };

    const stopVoiceMode = () => {
        isVoiceActiveRef.current = false;

        if (liveSession && typeof liveSession.close === 'function') {
            try {
                liveSession.close();
            } catch (e) {
                console.warn("Error closing session", e);
            }
        }
        setLiveSession(null);

        if (micStream.current) {
            micStream.current.getTracks().forEach(track => track.stop());
            micStream.current = null;
        }
        if (scriptProcessor.current) {
            scriptProcessor.current.disconnect();
            scriptProcessor.current = null;
        }
        if (sourceNode.current) {
            sourceNode.current.disconnect();
            sourceNode.current = null;
        }
        if (inputAudioContext.current) {
            inputAudioContext.current.close().catch(console.error);
            inputAudioContext.current = null;
        }
        if (outputAudioContext.current) {
            for (const source of audioPlaybackSources.current.values()) {
                try { source.stop(); } catch (e) { }
            }
            audioPlaybackSources.current.clear();
            outputAudioContext.current.close().catch(console.error);
            outputAudioContext.current = null;
        }

        setIsListening(false);
        setIsVoiceMode(false);
        setIsConnecting(false);
    };

    const startVoiceMode = async () => {
        if (isListening || isConnecting) return;

        setIsConnecting(true);
        setIsVoiceMode(true);
        isVoiceActiveRef.current = true;
        setCurrentInputTranscription('');
        setCurrentOutputTranscription('');

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            micStream.current = stream;

            const sessionPromise = initializeLiveChat({
                onopen: () => {
                    if (!isVoiceActiveRef.current) return;

                    setIsConnecting(false);
                    setIsListening(true);
                    inputAudioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
                    sourceNode.current = inputAudioContext.current.createMediaStreamSource(stream);
                    scriptProcessor.current = inputAudioContext.current.createScriptProcessor(4096, 1, 1);

                    scriptProcessor.current.onaudioprocess = (audioProcessingEvent) => {
                        if (!isVoiceActiveRef.current) return;

                        const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                        const pcmBlob = createBlob(inputData);
                        sessionPromise.then((session) => {
                            if (isVoiceActiveRef.current) {
                                session.sendRealtimeInput({ media: pcmBlob });
                            }
                        }).catch(() => { });
                    };

                    sourceNode.current.connect(scriptProcessor.current);
                    scriptProcessor.current.connect(inputAudioContext.current.destination);
                },
                onmessage: async (message: LiveServerMessage) => {
                    if (!isVoiceActiveRef.current) return;

                    if (message.serverContent?.outputTranscription) {
                        const text = message.serverContent.outputTranscription.text;
                        if (text) {
                            setCurrentOutputTranscription(prev => prev + text);
                        }
                    } else if (message.serverContent?.inputTranscription) {
                        const text = message.serverContent.inputTranscription.text;
                        if (text) {
                            setCurrentInputTranscription(prev => prev + text);
                        }
                    }

                    if (message.serverContent?.turnComplete) {
                        setCurrentInputTranscription('');
                        setCurrentOutputTranscription('');
                    }

                    const base64EncodedAudioString = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                    if (base64EncodedAudioString) {
                        if (!outputAudioContext.current) {
                            outputAudioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
                            nextStartTime.current = outputAudioContext.current.currentTime;
                        }

                        const outputNode = outputAudioContext.current.createGain();
                        nextStartTime.current = Math.max(nextStartTime.current, outputAudioContext.current.currentTime);

                        const audioBuffer = await decodeAudioData(
                            decode(base64EncodedAudioString),
                            outputAudioContext.current,
                            24000,
                            1
                        );

                        const source = outputAudioContext.current.createBufferSource();
                        source.buffer = audioBuffer;
                        source.connect(outputNode);
                        outputNode.connect(outputAudioContext.current.destination);

                        source.addEventListener('ended', () => {
                            audioPlaybackSources.current.delete(source);
                        });

                        source.start(nextStartTime.current);
                        nextStartTime.current += audioBuffer.duration;
                        audioPlaybackSources.current.add(source);
                    }

                    if (message.serverContent?.interrupted) {
                        for (const source of audioPlaybackSources.current.values()) {
                            source.stop();
                            audioPlaybackSources.current.delete(source);
                        }
                        nextStartTime.current = 0;
                    }
                },
                onerror: (e: ErrorEvent) => {
                    console.error("Voice Chat Error:", e);
                },
                onclose: (e: CloseEvent) => {
                    console.log("Voice Chat Closed");
                    stopVoiceMode();
                },
            }, systemInstruction);

            sessionPromise.then(session => {
                if (isVoiceActiveRef.current) {
                    setLiveSession(session);
                } else {
                    try { session.close(); } catch (e) { }
                }
            }).catch(err => {
                console.error("Voice chat connection failed:", err);
                stopVoiceMode();
                const msg = getErrorMessage(err);
                alert(`Failed to connect to voice chat: ${msg}. Please try again.`);
            });

        } catch (e) {
            console.error("Failed to start voice mode:", e);
            stopVoiceMode();
            alert("Could not access microphone. Please ensure permission is granted.");
        }
    };

    if (!isOpen && !isEmbedded) return null;

    const containerClasses = isEmbedded
        ? "w-full h-full flex flex-col bg-gray-50 dark:bg-gray-900 font-sans"
        : "bg-white dark:bg-gray-900 w-full sm:w-[360px] h-[60vh] sm:h-[550px] rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col pointer-events-auto border border-gray-200 dark:border-gray-800 overflow-hidden transform transition-transform duration-300 ease-in-out";

    const wrapperClasses = isEmbedded
        ? "w-full h-full"
        : "fixed inset-0 z-[100] flex items-end sm:items-end justify-center sm:justify-end p-0 sm:p-6 pointer-events-none font-sans";

    const content = (
        <div className={containerClasses}>

            {/* Modern Glass Header */}
            <div className={`${isEmbedded ? 'bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800' : 'bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-b border-gray-100 dark:border-gray-800'} p-4 flex justify-between items-center shrink-0 z-10`}>
                <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-green-500/20">
                        {ICONS.chatbot}
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-900 dark:text-white leading-tight">{mode === 'report' ? 'Report Assistant' : 'Health Assistant'}</h3>
                        <p className="text-xs text-green-600 dark:text-green-400 font-medium flex items-center">
                            <span className="w-2 h-2 rounded-full bg-green-500 mr-1.5 animate-pulse"></span>
                            {isVoiceMode ? "Voice Active" : "Online"}
                        </p>
                    </div>
                </div>
                <div className="flex items-center space-x-2">
                    <select
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                        className="text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg px-2 py-1.5 focus:outline-none border border-transparent hover:border-gray-200 dark:hover:border-gray-700 cursor-pointer transition-colors"
                    >
                        {LANGUAGES.map(lang => <option key={lang} value={lang}>{lang}</option>)}
                    </select>
                    {!isEmbedded && (
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full text-gray-500 dark:text-gray-400 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    )}
                </div>
            </div>

            {/* Chat Content */}
            <div className="flex-grow overflow-y-auto p-4 space-y-6 bg-gray-50 dark:bg-gray-950" ref={chatContainerRef}>
                {isVoiceMode ? (
                    <div className="flex flex-col items-center justify-center h-full space-y-8 py-12 px-6">
                        {/* Main Status Icon */}
                        <div className={`relative w-32 h-32 flex items-center justify-center`}>
                            {isListening && (
                                <>
                                    <div className="absolute inset-0 rounded-full bg-green-500 opacity-20 animate-ping"></div>
                                    <div className="absolute inset-4 rounded-full bg-green-500 opacity-20 animate-ping" style={{ animationDuration: '1.5s' }}></div>
                                </>
                            )}
                            <div className={`relative w-24 h-24 rounded-full flex items-center justify-center shadow-2xl transition-colors duration-500 ${isListening ? 'bg-gradient-to-br from-green-500 to-teal-500 text-white' : 'bg-gray-200 dark:bg-gray-800 text-gray-500'}`}>
                                {isConnecting ? (
                                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-white border-t-transparent"></div>
                                ) : (
                                    React.cloneElement(ICONS.mic as React.ReactElement<any>, { className: "w-10 h-10" })
                                )}
                            </div>
                        </div>

                        {/* Transcription Display Area */}
                        <div className="w-full max-w-md min-h-[120px] flex flex-col items-center justify-center text-center space-y-4">

                            {/* Connection State */}
                            {isConnecting && (
                                <p className="text-gray-500 dark:text-gray-400 font-medium animate-pulse">Connecting to Health Assistant...</p>
                            )}

                            {/* Listen Only Mode: Transcriptions Hidden for Natural Flow */}


                            {/* Idle / Listening State */}
                            {!currentInputTranscription && !currentOutputTranscription && !isConnecting && (
                                <p className="text-gray-400 dark:text-gray-500 text-sm font-medium">
                                    Listening...
                                </p>
                            )}
                        </div>
                    </div>
                ) : (
                    <>
                        {chatHistory.map((msg, idx) => {
                            const { cleanText, navigation } = parseModelResponse(msg.parts[0].text);
                            const isUser = msg.role === 'user';
                            const isLastMessage = idx === chatHistory.length - 1;
                            const isChatLoadingForModel = isChatLoading && msg.role === 'model';
                            const isStreaming = isLastMessage && isChatLoadingForModel;

                            return (
                                <div key={idx} className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in-up`}>
                                    <div className={`group relative max-w-[85%] p-4 rounded-2xl text-sm shadow-sm ${isUser
                                        ? 'bg-gradient-to-br from-green-600 to-teal-600 text-white rounded-tr-none'
                                        : 'bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 rounded-tl-none border border-gray-100 dark:border-gray-800'
                                        }`}>

                                        {/* Message Content with Custom Markdown Parsing */}
                                        <div className="leading-relaxed space-y-2">
                                            {cleanText.split('\n').map((line, i) => {
                                                // Table Row Detection (Simple)
                                                if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
                                                    const cells = line.split('|').filter(c => c).map(c => c.trim());
                                                    const isHeader = i > 0 && cleanText.split('\n')[i + 1]?.includes('---');
                                                    if (cleanText.split('\n')[i - 1]?.includes('---')) return null; // Skip separator lines

                                                    return (
                                                        <div key={i} className="overflow-x-auto my-2">
                                                            <table className="min-w-full text-xs border-collapse">
                                                                <tbody>
                                                                    <tr className={`${isHeader ? 'bg-green-50 dark:bg-green-900/20 font-bold' : 'border-b border-gray-100 dark:border-gray-800'}`}>
                                                                        {cells.map((cell, cIdx) => (
                                                                            <td key={cIdx} className="p-2 border border-gray-200 dark:border-gray-700">{cell}</td>
                                                                        ))}
                                                                    </tr>
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    );
                                                }

                                                // List Item Detection
                                                if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
                                                    return (
                                                        <div key={i} className="flex items-start space-x-2 ml-1">
                                                            <span className="text-green-500 mt-1.5">•</span>
                                                            <span dangerouslySetInnerHTML={{
                                                                __html: line.replace(/^[-*]\s+/, '').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                                            }} />
                                                        </div>
                                                    );
                                                }

                                                // Standard Text with Bold Support
                                                if (line.trim() === '') return <br key={i} />;

                                                return (
                                                    <p key={i} dangerouslySetInnerHTML={{
                                                        __html: line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                                    }} />
                                                );
                                            })}

                                            {/* Typing Cursor Animation */}
                                            {isStreaming && (
                                                <span className="inline-block w-1.5 h-4 bg-green-500 ml-1 animate-pulse align-middle"></span>
                                            )}
                                        </div>

                                        {navigation && (
                                            <button
                                                onClick={() => {
                                                    navigateTo(navigation.page);
                                                    onClose();
                                                }}
                                                className="mt-4 w-full flex items-center justify-between text-xs font-bold bg-white/20 hover:bg-white/30 px-4 py-2.5 rounded-xl transition-all border border-white/10 hover:border-white/30"
                                                style={{ color: isUser ? 'white' : 'inherit' }}
                                            >
                                                <span>{navigation.label}</span>
                                                {ICONS.arrowRight}
                                            </button>
                                        )}
                                        {msg.role === 'model' && cleanText && !isStreaming && (
                                            <div className="absolute -right-8 top-1/2 transform -translate-y-1/2">
                                                <SpeechButton textToSpeak={cleanText} language={language} />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                        {isChatLoading && (
                            <div className="flex justify-start">
                                <div className="bg-white dark:bg-gray-900 px-4 py-3 rounded-2xl rounded-tl-none border border-gray-100 dark:border-gray-800 shadow-sm">
                                    <div className="flex space-x-1.5">
                                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                                    </div>
                                </div>
                            </div>
                        )}
                        {showQuickActions && mode === 'dashboard' && !isChatLoading && (
                            <div className="mt-6">
                                <p className="text-xs text-gray-400 dark:text-gray-500 font-semibold uppercase tracking-wider mb-3 ml-1">Suggested Actions</p>
                                <div className="flex flex-wrap gap-2">
                                    {QUICK_ACTIONS.map((action, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => handleQuickActionClick(action)}
                                            className="text-xs font-medium bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-green-500 dark:hover:border-green-500 hover:text-green-600 dark:hover:text-green-400 text-gray-600 dark:text-gray-300 py-2 px-3 rounded-lg transition-all duration-200"
                                        >
                                            {action}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 shrink-0">
                {isVoiceMode ? (
                    <button
                        onClick={stopVoiceMode}
                        className="w-full py-3.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl shadow-lg shadow-red-500/20 flex items-center justify-center space-x-2 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                    >
                        {ICONS.stop}
                        <span>End Voice Session</span>
                    </button>
                ) : (
                    <form onSubmit={handleSendMessage} className="flex items-center space-x-3">
                        <button
                            type="button"
                            onClick={startVoiceMode}
                            className="p-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-green-100 dark:hover:bg-green-900/30 hover:text-green-600 dark:hover:text-green-400 transition-all duration-200"
                            aria-label="Start Voice Chat"
                        >
                            {ICONS.mic}
                        </button>
                        <div className="flex-grow relative">
                            <input
                                type="text"
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                placeholder={isChatLoading ? "Reasoning..." : "Type a message..."}
                                disabled={isChatLoading}
                                className="w-full p-3.5 pr-12 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 transition-all text-gray-900 dark:text-white placeholder-gray-400"
                            />
                            <button
                                type="submit"
                                disabled={!chatInput.trim() || isChatLoading}
                                className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors shadow-md"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );

    if (isEmbedded) {
        return content;
    }

    return (
        <div className={wrapperClasses}>
            {content}
        </div>
    );
};

export default Chatbot;
