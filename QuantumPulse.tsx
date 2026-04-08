import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Wifi, 
  Activity, 
  ShieldCheck, 
  AlertTriangle,
  Radio,
  Clock,
  Laptop,
  Users,
  Brain,
  Network,
  Heart,
  Wind,
  Video,
  Eye,
  Camera
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';

interface HybridData {
  heart_rate: number;
  respiratory_rate: number;
  stress_level: number;
  fatigue_level: number;
  wifi_activity: string;
  wifi_rssi: number;
  confidence: number;
  presence_detected: boolean;
  no_breathing_alert: boolean;
  tachycardia_alert: boolean;
  bradycardia_alert: boolean;
  facial_expression: string;
  pulse_wave: number[];
  resp_wave: number[];
}

const QuantumPulse: React.FC = () => {
  const [data, setData] = useState<HybridData | null>(null);
  const [error, setError] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'monitor' | 'fusion' | 'privacy'>('monitor');
  const [imgError, setImgError] = useState(false);
  const [alertHistory, setAlertHistory] = useState<{time: string, msg: string}[]>([]);
  
  const lastAlertRef = useRef<string>('');
  const imgRef = useRef<HTMLImageElement>(null);

  // Fetch JSON from the advanced Hybrid backend on port 5004
  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      if (!isMounted) return;
      try {
        const res = await fetch('http://localhost:5004/api/hybrid-data');
        if (!res.ok) throw new Error('Network response was not ok');
        const json = await res.json();
        
        if (!isMounted) return;

        // Handle Alerts & History using a ref to prevent dependency loop freezes
        if (json.no_breathing_alert || json.tachycardia_alert || json.bradycardia_alert) {
          const msg = json.no_breathing_alert ? "No Respiration" : json.tachycardia_alert ? "High Heart Rate" : "Low Heart Rate";
          const time = new Date().toLocaleTimeString();
          
          if (lastAlertRef.current !== msg) {
             lastAlertRef.current = msg;
             setAlertHistory(prev => [{time, msg}, ...prev].slice(0, 5));
             
             // Trigger node server caregiver alert
             fetch('http://localhost:5000/api/emergency-alert', {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({
                 email: 'Ganeshgouli204@gmail.com', // Demo Target
                 condition: msg,
                 heart_rate: json.heart_rate,
                 respiratory_rate: json.respiratory_rate
               })
             }).catch(e => console.error("Caregiver notification failed", e));
          }
        }

        setData(json);
        setError('');
      } catch (err) {
        if (!isMounted) return;
        console.error("Error fetching QuantumPulse Hybrid data:", err);
        setError('Ensure the Hybrid Camera+WiFi Backend (quantum_hybrid.py) is running on port 5004.');
      }
    };
    
    fetchData();
    const interval = setInterval(fetchData, 1000);
    
    return () => {
      isMounted = false;
      clearInterval(interval);
      // Stop webcam MJPEG request immediately when navigating away
      if (imgRef.current) {
        imgRef.current.src = "";
      }
      // Forcefully kill the camera feed on the backend
      fetch('http://localhost:5004/api/stop-camera', { method: 'POST' }).catch(() => {});
    };
  }, []); // Empty dependency array prevents re-rendering freezes

  // Format Recharts arrays
  const pulseChartData = data?.pulse_wave?.map((val, idx) => ({ time: idx, val })) || [];
  const respChartData = data?.resp_wave?.map((val, idx) => ({ time: idx, val })) || [];

  return (
    <div className="min-h-screen bg-[#050510] text-white p-4 md:p-8 font-sans overflow-x-hidden">
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-20">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600 rounded-full blur-[140px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-600 rounded-full blur-[140px]" />
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <motion.h1 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-cyan-500 to-emerald-500"
            >
              QuantumPulse
              <span className="text-xl ml-3 align-text-top px-3 py-1 bg-white/10 rounded-xl text-emerald-300 font-mono italic tracking-widest border border-white/20">HYBRID</span>
            </motion.h1>
            <p className="text-gray-400 mt-3 flex items-center gap-2 font-medium">
              <Camera className="w-5 h-5 text-emerald-400" />
              Sensor Fusion: Optical rPPG + WiFi Inference
            </p>
          </div>
          <div className="flex bg-[#1a1c35]/80 backdrop-blur-xl p-1 rounded-2xl border border-white/10 shadow-2xl">
            {(['monitor', 'fusion', 'privacy'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-2.5 rounded-xl transition-all duration-300 font-bold uppercase tracking-wider text-xs ${
                  activeTab === tab 
                  ? 'bg-gradient-to-r from-cyan-600 to-emerald-600 text-white shadow-lg' 
                  : 'text-gray-400 hover:text-white'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/50 flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-red-400" />
            <span className="text-red-200 font-medium">{error}</span>
          </div>
        )}

        <AnimatePresence mode="wait">
          {activeTab === 'monitor' && (
            <motion.div 
              key="monitor"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-6"
            >
              {/* Left Panel: Live Camera Feed */}
              <div className="lg:col-span-4 flex flex-col gap-6">
                <div className="backdrop-blur-2xl bg-black/40 border border-white/10 rounded-3xl p-6 relative overflow-hidden">
                  <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-white">
                    <Video className="w-5 h-5 text-emerald-400" />
                    Live Optical AI Feed
                  </h3>
                  
                  <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden border border-white/10 flex items-center justify-center">
                    {!imgError ? (
                      <img 
                        ref={imgRef}
                        src="http://localhost:5004/video_feed" 
                        alt="Live CV2 Feed"
                        className="w-full h-full object-cover"
                        onError={() => setImgError(true)}
                      />
                    ) : (
                      <div className="text-gray-500 flex flex-col items-center">
                        <Camera className="w-8 h-8 mb-2 opacity-50" />
                        <span className="text-sm">Webcam Feed Offline</span>
                      </div>
                    )}
                    
                    {/* Live Indicator */}
                    <div className="absolute top-3 right-3 flex items-center gap-2 bg-black/60 px-2 py-1 rounded border border-white/10">
                      <div className={`w-2 h-2 rounded-full ${imgError ? 'bg-red-500' : 'bg-red-500 animate-pulse'}`}></div>
                      <span className="text-[10px] text-white font-bold tracking-wider">REC</span>
                    </div>
                  </div>
                  
                  <div className="mt-6 flex justify-between items-center p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/30">
                    <div>
                      <p className="text-xs text-emerald-400 font-bold uppercase tracking-wider">Fusion Confidence</p>
                      <h4 className="text-3xl font-black text-white">{data?.confidence || 0}%</h4>
                    </div>
                    <ShieldCheck className={`w-8 h-8 ${(data?.confidence || 0) > 70 ? 'text-emerald-400' : 'text-gray-500'}`} />
                  </div>

                  {(data?.no_breathing_alert || data?.tachycardia_alert || data?.bradycardia_alert) && (
                   <motion.div 
                     initial={{ opacity: 0, scale: 0.95 }} 
                     animate={{ opacity: [0.5, 1, 0.5], scale: 1 }} 
                     transition={{ repeat: Infinity, duration: 1 }}
                     className="mt-4 p-4 bg-red-600/20 border-2 border-red-500 rounded-2xl flex items-center justify-center gap-3 shadow-[0_0_30px_rgba(239,68,68,0.4)]"
                   >
                     <AlertTriangle className="w-8 h-8 text-red-500" />
                     <span className="text-red-500 font-bold text-lg tracking-wider uppercase">
                       ALERT: {data?.no_breathing_alert ? 'APNEA DETECTED' : data?.tachycardia_alert ? 'TACHYCARDIA' : 'BRADYCARDIAD'}
                     </span>
                   </motion.div>
                  )}
                </div>

                <div className="bg-[#0d0f25]/60 backdrop-blur-2xl border border-white/10 p-6 rounded-3xl">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Brain className="w-5 h-5 text-purple-400" />
                    AI Health Correlates
                  </h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center text-sm p-3 bg-white/5 rounded-xl border border-white/5">
                      <span className="text-gray-400 font-medium">Expression Analysis</span>
                      <span className={`font-bold ${data?.facial_expression === 'Distressed/Pain' ? 'text-red-400' : 'text-emerald-400'}`}>
                        {data?.facial_expression || 'Analyzing...'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm p-3 bg-white/5 rounded-xl border border-white/5">
                      <span className="text-gray-400 font-medium">Stress Approximation</span>
                      <div className="flex items-center gap-3">
                        <div className="w-20 h-2 bg-gray-800 rounded-full overflow-hidden">
                          <div className={`h-full ${data?.stress_level && data.stress_level > 60 ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${data?.stress_level || 0}%`}}></div>
                        </div>
                        <span className="text-white font-bold font-mono w-8 text-right">{data?.stress_level || 0}%</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center text-sm p-3 bg-white/5 rounded-xl border border-white/5">
                      <span className="text-gray-400 font-medium">Fatigue (Blink EAR)</span>
                       <div className="flex items-center gap-3">
                        <div className="w-20 h-2 bg-gray-800 rounded-full overflow-hidden">
                          <div className={`h-full ${data?.fatigue_level && data.fatigue_level > 60 ? 'bg-orange-500' : 'bg-blue-500'}`} style={{ width: `${data?.fatigue_level || 0}%`}}></div>
                        </div>
                        <span className="text-white font-bold font-mono w-8 text-right">{data?.fatigue_level || 0}%</span>
                      </div>
                    </div>
                  </div>
                </div>

                {alertHistory.length > 0 && (
                   <div className="bg-[#0d0f25]/60 backdrop-blur-2xl border border-white/10 p-6 rounded-3xl">
                     <h3 className="text-sm font-bold mb-4 text-gray-500 uppercase tracking-widest">Recent Alerts</h3>
                     <div className="space-y-2">
                       {alertHistory.map((alert, i) => (
                         <div key={i} className="flex justify-between text-xs p-2 bg-red-500/5 rounded border border-red-500/10">
                           <span className="text-red-400">{alert.msg}</span>
                           <span className="text-gray-500">{alert.time}</span>
                         </div>
                       ))}
                     </div>
                   </div>
                )}
              </div>

              {/* Right Panel: Vitals & WiFi */}
              <div className="lg:col-span-8 flex flex-col gap-6">
                
                {/* Metrics Row */}
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className={`backdrop-blur-2xl border p-6 rounded-3xl transition-colors duration-500 ${data?.tachycardia_alert || data?.bradycardia_alert ? 'bg-red-900/20 border-red-500/50' : 'bg-[#0d0f25]/60 border-white/10'}`}>
                    <Heart className={`w-8 h-8 mb-4 ${data?.tachycardia_alert || data?.bradycardia_alert ? 'text-red-500 animate-pulse' : 'text-red-400'}`} />
                    <p className="text-sm text-gray-400 font-bold uppercase tracking-wider">Heart Rate</p>
                    <div className="flex items-baseline gap-2 mt-1">
                      <h3 className="text-4xl font-black text-white">{data?.heart_rate || '--'}</h3>
                      <span className="text-red-400 font-medium">BPM</span>
                    </div>
                  </div>
                  <div className="bg-[#0d0f25]/60 backdrop-blur-2xl border border-white/10 p-6 rounded-3xl">
                    <Wind className="w-8 h-8 text-cyan-400 mb-4" />
                    <p className="text-sm text-gray-400 font-bold uppercase tracking-wider">Respiratory Rate</p>
                    <div className="flex items-baseline gap-2 mt-1">
                      <h3 className="text-4xl font-black text-white">{data?.respiratory_rate || '--'}</h3>
                      <span className="text-cyan-400 font-medium">Br/Min</span>
                    </div>
                  </div>
                  <div className="bg-[#0d0f25]/60 backdrop-blur-2xl border border-white/10 p-6 rounded-3xl col-span-2 lg:col-span-1">
                    <Activity className="w-8 h-8 text-purple-400 mb-4" />
                    <p className="text-sm text-gray-400 font-bold uppercase tracking-wider">Hybrid Activity Status</p>
                    <div className="flex flex-col mt-1">
                      <h3 className={`text-xl font-bold truncate ${
                        data?.wifi_activity === 'Active Movement' ? 'text-red-400' :
                        data?.wifi_activity === 'Walking' ? 'text-yellow-400' :
                        'text-emerald-400'
                      }`}>
                        {data?.wifi_activity || 'Unknown'}
                      </h3>
                      <span className="text-purple-400 font-medium text-sm mt-1">{data?.wifi_rssi || 0}% Environmental RF</span>
                    </div>
                  </div>
                </div>

                {/* Heart Rate Graph */}
                <div className="bg-[#0d0f25]/60 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 flex-1 min-h-[220px] flex flex-col">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                      <Activity className="w-5 h-5 text-red-400" />
                      Optical Blood Volume Pulse (rPPG)
                    </h3>
                  </div>
                  <div className="flex-grow w-full relative">
                    {pulseChartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={pulseChartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff0a" vertical={false} />
                          <XAxis dataKey="time" hide />
                          <YAxis domain={['dataMin', 'dataMax']} hide />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#1a1c35', border: '1px solid #ffffff10', borderRadius: '12px' }}
                            itemStyle={{ color: '#f87171', fontWeight: 'bold' }}
                          />
                          <Line type="monotone" name="BVP" dataKey="val" stroke="#f87171" strokeWidth={3} dot={false} isAnimationActive={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-gray-500">Awaiting Face Recognition...</div>
                    )}
                  </div>
                </div>

                {/* Respiration Graph */}
                <div className="bg-[#0d0f25]/60 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 flex-1 min-h-[220px] flex flex-col">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                      <Wind className="w-5 h-5 text-cyan-400" />
                      Thoracic Expansion Trace (Pose y-axis)
                    </h3>
                  </div>
                  <div className="flex-grow w-full relative">
                    {respChartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={respChartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff0a" vertical={false} />
                          <XAxis dataKey="time" hide />
                          <YAxis domain={['dataMin', 'dataMax']} hide />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#1a1c35', border: '1px solid #ffffff10', borderRadius: '12px' }}
                            itemStyle={{ color: '#22d3ee', fontWeight: 'bold' }}
                          />
                          <Line type="monotone" name="Chest Displacement" dataKey="val" stroke="#22d3ee" strokeWidth={3} dot={false} isAnimationActive={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-gray-500">Awaiting Pose Registration...</div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'fusion' && (
            <motion.div 
              key="fusion"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-[#0d0f25]/60 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 md:p-10"
            >
              <div className="flex items-center justify-between mb-10">
                <div>
                  <h2 className="text-3xl font-bold flex items-center gap-3">
                    <Network className="w-8 h-8 text-blue-400" />
                    Sensor Fusion Methodology
                  </h2>
                  <p className="text-gray-400 mt-2 text-lg">Harmonizing optical precision with RF multi-path inference</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="p-8 bg-blue-500/10 rounded-3xl border border-blue-500/20">
                  <Camera className="w-10 h-10 text-blue-400 mb-6" />
                  <h3 className="text-2xl font-bold mb-4">Primary: Computer Vision</h3>
                  <p className="text-gray-300 leading-relaxed">
                    The OpenCV + MediaPipe pipeline is the absolute source of truth for physiological data. We analyze sub-pixel color variations on the forehead for heart rate (rPPG), micro-displacements of the shoulders for breathing, and Eye Aspect Ratios (EAR) for blinking/fatigue.
                  </p>
                  <ul className="mt-6 space-y-3">
                    <li className="flex items-center gap-3 text-sm text-gray-400"><div className="w-2 h-2 rounded-full bg-blue-500"></div> Yields HR & Respiration Vectors</li>
                    <li className="flex items-center gap-3 text-sm text-gray-400"><div className="w-2 h-2 rounded-full bg-blue-500"></div> Subject to low-light occlusion</li>
                    <li className="flex items-center gap-3 text-sm text-gray-400"><div className="w-2 h-2 rounded-full bg-blue-500"></div> Grants +70% Base Confidence</li>
                  </ul>
                </div>

                <div className="p-8 bg-purple-500/10 rounded-3xl border border-purple-500/20">
                  <Wifi className="w-10 h-10 text-purple-400 mb-6" />
                  <h3 className="text-2xl font-bold mb-4">Secondary: RF Inference</h3>
                  <p className="text-gray-300 leading-relaxed">
                    The local WiFi adapter acts as an invisible tripwire. When vision is lost (e.g. subject steps out of frame), the network's RSSI variance is scanned for disturbances. If the network fluctuates while the camera is blind, we know the environment is occupied.
                  </p>
                  <ul className="mt-6 space-y-3">
                    <li className="flex items-center gap-3 text-sm text-gray-400"><div className="w-2 h-2 rounded-full bg-purple-500"></div> Bypasses line-of-sight limits</li>
                    <li className="flex items-center gap-3 text-sm text-gray-400"><div className="w-2 h-2 rounded-full bg-purple-500"></div> Purely inferential (No vitals)</li>
                    <li className="flex items-center gap-3 text-sm text-gray-400"><div className="w-2 h-2 rounded-full bg-purple-500"></div> Grants +30% Base Confidence</li>
                  </ul>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'privacy' && (
            <motion.div 
              key="privacy"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-gradient-to-r from-emerald-900/30 to-teal-900/30 p-8 md:p-12 rounded-[40px] border border-emerald-500/20 shadow-2xl relative overflow-hidden"
            >
              <ShieldCheck className="absolute -right-10 -bottom-10 w-64 h-64 text-emerald-500/10 pointer-events-none" />
              <div className="relative z-10">
                <h2 className="text-3xl font-black text-emerald-400 flex items-center gap-3 mb-6">
                  <Eye className="w-8 h-8" />
                  Absolute Edge Processing
                </h2>
                <p className="text-gray-300 leading-relaxed text-lg max-w-3xl">
                  QuantumPulse Hybrid operates <strong>strictly locally</strong>. Video frames are consumed instantly in RAM to extract vector landmarks and color channels, and then completely discarded. 
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10">
                  <div className="bg-black/40 p-6 rounded-2xl border border-white/10">
                    <h4 className="font-bold text-white mb-2">No Cloud Transmissions</h4>
                    <p className="text-sm text-gray-400">Not a single byte of visual data leaves your device. All MediaPipe processing is executed on your local CPU.</p>
                  </div>
                  <div className="bg-black/40 p-6 rounded-2xl border border-white/10">
                    <h4 className="font-bold text-white mb-2">Volatile Memory</h4>
                    <p className="text-sm text-gray-400">The rolling window buffers dictating Heart Rate (150 frames) and Respiration (200 frames) are purged instantly upon closure.</p>
                  </div>
                  <div className="bg-black/40 p-6 rounded-2xl border border-white/10">
                    <h4 className="font-bold text-white mb-2">Non-Diagnostic</h4>
                    <p className="text-sm text-gray-400">The output metrics are estimations designed to demonstrate sensor fusion, not FDA-approved diagnostics.</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default QuantumPulse;
