import React, { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import { Gender } from '../types';
import StoryScene from '../components/StoryScene';
import LandingPage from '../components/LandingPage';
import { SplineScene } from '../components/ui/splite';

const Login: React.FC = () => {
    const { login, user, currentPage } = useAppContext();
    const isEditMode = currentPage === 'EDIT_PROFILE' && user;

    const [showLanding, setShowLanding] = useState(true); // Default to showing landing page

    const [name, setName] = useState(isEditMode ? user.name : '');
    const [email, setEmail] = useState(isEditMode ? user.email || '' : '');
    const [age, setAge] = useState(isEditMode && user.age ? user.age.toString() : '');
    const [gender, setGender] = useState<Gender>(isEditMode ? user.gender : 'male');
    const [height, setHeight] = useState(isEditMode ? user.height.toString() : '');
    const [weight, setWeight] = useState(isEditMode ? user.weight.toString() : '');
    const [error, setError] = useState('');

    useEffect(() => {
        if (isEditMode) {
            setName(user.name);
            setEmail(user.email || '');
            setAge(user.age.toString());
            setGender(user.gender);
            setHeight(user.height.toString());
            setWeight(user.weight.toString());
        }
    }, [user, isEditMode]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !email || !age || !height || !weight) {
            setError('Please fill in all fields.');
            return;
        }
        if (!/\S+@\S+\.\S+/.test(email)) {
            setError('Please enter a valid email address.');
            return;
        }
        setError('');
        login({
            name,
            email,
            age: parseInt(age, 10),
            gender,
            height: parseFloat(height),
            weight: parseFloat(weight),
        });
    };

    // Mouse Parallax State
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

    useEffect(() => {
        // Function to handle mouse movement for parallax effect
        const handleMouseMove = (e: MouseEvent) => {
            const { clientX, clientY } = e;
            const x = (clientX / window.innerWidth - 0.5) * 30; // Move range: -15px to 15px
            const y = (clientY / window.innerHeight - 0.5) * 30;
            setMousePos({ x, y });
        };

        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    const [storyState, setStoryState] = useState<'idle' | 'entering' | 'transforming' | 'exiting'>('idle');
    const [isProcessing, setIsProcessing] = useState(false);
    const [authState, setAuthState] = useState<'idle' | 'scanning' | 'verifying' | 'success'>('idle');
    const [authMessage, setAuthMessage] = useState('');
    const handleContinue = (e: React.FormEvent) => {
        e.preventDefault();

        if (!name || !email) {
            setError('Please provide at least your Name and Email to continue.');
            return;
        }

        setError('');
        setIsProcessing(true);

        login({
            name,
            email,
            age: age ? parseInt(age, 10) : 0,
            gender,
            height: height ? parseFloat(height) : 0,
            weight: weight ? parseFloat(weight) : 0,
        });

        setIsProcessing(false);
    };

    return (
        <>
            {showLanding && <LandingPage onExplore={() => setShowLanding(false)} />}



            {/* ======= FULL-SCREEN AUTH OVERLAY ======= */}
            {authState !== 'idle' && (
                <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#020617]/95 backdrop-blur-xl text-white overflow-hidden">

                    {/* Ambient Glow */}
                    <div className={`absolute w-[600px] h-[600px] rounded-full blur-[120px] transition-colors duration-700 ${authState === 'success' ? 'bg-emerald-500/20' : 'bg-teal-500/15'}`}></div>

                    {/* Rotating outer reticle */}
                    <div className="relative w-64 h-64 flex items-center justify-center">
                        <svg className="absolute inset-0 w-full h-full animate-spin" style={{ animationDuration: '4s' }} viewBox="0 0 200 200" fill="none" stroke="rgba(45,212,191,0.4)" strokeWidth="1">
                            <circle cx="100" cy="100" r="95" strokeDasharray="30 20" />
                        </svg>
                        <svg className="absolute inset-0 w-full h-full animate-spin" style={{ animationDuration: '2.5s', animationDirection: 'reverse' }} viewBox="0 0 200 200" fill="none" stroke="rgba(99,102,241,0.3)" strokeWidth="0.8">
                            <circle cx="100" cy="100" r="80" strokeDasharray="15 40" />
                        </svg>

                        {/* Corner brackets */}
                        {[['top-0 left-0', '0,0 0,24 0,0 24,0'], ['top-0 right-0', '40,0 16,0 16,0 16,24'], ['bottom-0 left-0', '0,40 0,16 0,16 24,16'], ['bottom-0 right-0', '40,40 16,40 16,40 16,16']].map(([pos, pts], i) => (
                            <svg key={i} className={`absolute w-10 h-10 ${pos}`} viewBox="0 0 40 40" fill="none" stroke="#2dd4bf" strokeWidth="2" strokeLinecap="round">
                                <polyline points={pts as string} />
                            </svg>
                        ))}

                        {/* Icon center */}
                        <div className={`relative z-10 w-28 h-28 rounded-full flex items-center justify-center border-2 transition-all duration-700 ${authState === 'success'
                            ? 'border-emerald-400 bg-emerald-500/10 shadow-[0_0_60px_rgba(16,185,129,0.5)]'
                            : 'border-teal-500/60 bg-teal-900/10 shadow-[0_0_40px_rgba(45,212,191,0.3)]'
                            }`}>
                            {authState === 'success' ? (
                                <svg className="w-14 h-14 text-emerald-400 animate-[scale-in_0.4s_ease-out]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            ) : (
                                <svg className="w-14 h-14 text-teal-400 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
                                </svg>
                            )}
                        </div>

                        {/* Scanning line */}
                        {authState !== 'success' && (
                            <div className="absolute inset-0 overflow-hidden rounded-full pointer-events-none">
                                <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-teal-400 to-transparent opacity-80"
                                    style={{ animation: 'scan 2s linear infinite', top: '0%' }} />
                            </div>
                        )}
                    </div>

                    {/* Status text */}
                    <div className="mt-10 text-center">
                        <p className={`text-lg font-semibold tracking-widest uppercase transition-colors duration-500 ${authState === 'success' ? 'text-emerald-400' : 'text-teal-300'
                            }`}>
                            {authMessage}
                        </p>

                        {/* Progress dots */}
                        {authState !== 'success' && (
                            <div className="flex gap-2 justify-center mt-4">
                                <div className="w-2 h-2 rounded-full bg-teal-400 animate-[bounce_1s_infinite_-0.3s]"></div>
                                <div className="w-2 h-2 rounded-full bg-teal-400 animate-[bounce_1s_infinite_-0.15s]"></div>
                                <div className="w-2 h-2 rounded-full bg-teal-400 animate-[bounce_1s_infinite]"></div>
                            </div>
                        )}

                        {/* Progress bar */}
                        <div className="mt-6 w-64 h-0.5 bg-white/10 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-[3000ms] ease-linear ${authState === 'success' ? 'w-full bg-emerald-400' :
                                authState === 'verifying' ? 'w-3/4 bg-teal-400' : 'w-1/2 bg-teal-500'
                                }`}></div>
                        </div>

                        {/* System ID readout */}
                        <p className="mt-4 text-[10px] text-teal-800 font-mono tracking-widest animate-pulse">
                            SYS::HEALTH_PORTAL_AUTH /// ID:{name.toUpperCase().replace(' ', '_') || 'UNKNOWN'} /// {new Date().toISOString()}
                        </p>
                    </div>
                </div>
            )}

            <div className={`min-h-screen relative flex items-center justify-center md:justify-end md:pr-[10%] overflow-hidden font-sans selection:bg-[#8EF9A0]/30 selection:text-white transition-opacity duration-1000 ${showLanding ? 'opacity-0' : 'opacity-100'}`}>

                <style>{`
                    @keyframes blob {
                        0% { transform: translate(0px, 0px) scale(1); }
                        33% { transform: translate(30px, -50px) scale(1.1); }
                        66% { transform: translate(-20px, 20px) scale(0.9); }
                        100% { transform: translate(0px, 0px) scale(1); }
                    }
                    @keyframes pulse-soft {
                        0%, 100% { box-shadow: 0 0 15px rgba(100,255,218,0.3); }
                        50% { box-shadow: 0 0 25px rgba(100,255,218,0.5); }
                    }
                    @keyframes gradient-shift {
                        0% { background-position: 0% 50%; }
                        50% { background-position: 100% 50%; }
                        100% { background-position: 0% 50%; }
                    }
                `}</style>

                {/* Premium Abstract Background */}
                <div
                    className="absolute inset-0 z-0 bg-cover bg-center overflow-hidden"
                    style={{
                        backgroundImage: `url('/bg-login.jpeg')`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        backgroundColor: '#0a0a16',
                        transform: `scale(1.05) translate(${mousePos.x * 0.4}px, ${mousePos.y * 0.4}px)`,
                        transition: 'transform 0.2s cubic-bezier(0.25, 1, 0.5, 1)'
                    }}
                >
                    <div className="absolute inset-0 bg-black/55 backdrop-blur-[8px]"></div>
                    {/* Soft animated gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-[#00C853]/5 via-transparent to-[#64FFDA]/5 animate-[gradient-shift_12s_ease_infinite] mix-blend-overlay" style={{ backgroundSize: '200% 200%' }}></div>
                    {/* Slow moving light blobs */}
                    <div className="absolute top-[10%] left-[20%] w-[500px] h-[500px] bg-[#8EF9A0]/10 rounded-full blur-[120px] animate-[blob_10s_infinite_alternate] mix-blend-screen pointer-events-none"></div>
                    <div className="absolute bottom-[10%] right-[10%] w-[600px] h-[600px] bg-[#00C853]/10 rounded-full blur-[120px] animate-[blob_12s_infinite_alternate-reverse] mix-blend-screen pointer-events-none"></div>
                </div>

                {/* 3D Character/Image Layer */}
                <div className={`absolute left-0 md:left-[2%] lg:left-[5%] top-0 bottom-0 w-[55%] hidden md:flex items-center justify-center pointer-events-auto transition-all duration-[1500ms] ease-out ${(storyState !== 'idle' || isProcessing) ? 'opacity-0 -translate-x-12 scale-95' : 'opacity-100 translate-x-0 scale-100'}`}>
                    <div
                        className="w-full h-[600px] xl:h-[700px] drop-shadow-[0_20px_40px_rgba(11,31,59,0.3)] transition-transform duration-300 ease-out"
                        style={{
                            /* Subtle cursor tracking */
                            transform: `perspective(1000px) rotateY(${Math.max(Math.min(mousePos.x * 0.2, 5), -5)}deg) rotateX(${Math.max(Math.min(mousePos.y * -0.15, 4), -4)}deg)`,
                            transition: 'transform 0.3s cubic-bezier(0.25, 1, 0.5, 1)'
                        }}
                    >
                        <SplineScene
                            scene="https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode"
                            className="w-full h-full rounded-2xl overflow-hidden"
                        />
                    </div>
                </div>

                {/* Main Centered Login Box */}
                <div className={`relative z-10 w-full max-w-[420px] px-6 transition-all duration-[1200ms] ease-out ${(storyState !== 'idle' || isProcessing) ? 'opacity-0 pointer-events-none translate-y-4 scale-95' : 'opacity-100 translate-y-0 scale-100'}`}>
                    <div className="bg-[#0f0f14a6] backdrop-blur-[25px] border border-white/10 rounded-[20px] shadow-[0_20px_60px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.05),0_0_20px_rgba(142,249,160,0.05)] p-10 transition-all duration-500 hover:shadow-[0_25px_70px_rgba(0,0,0,0.7),inset_0_1px_1px_rgba(255,255,255,0.05),0_0_30px_rgba(142,249,160,0.08)] group/card">

                        <div className="text-center mb-8">
                            <h2 className="text-[28px] font-bold text-[#8EF9A0] mb-2 tracking-tight">
                                {isEditMode ? "Update Profile" : "Health Portal"}
                            </h2>
                            <p className="text-white/70 text-[15px] font-medium leading-snug px-2">
                                Enter your details to begin your transformation.
                            </p>
                        </div>

                        <form onSubmit={handleContinue} className="space-y-4 relative z-10">
                            {error && (
                                <div className="bg-red-500/10 border border-red-500/30 text-red-200 px-4 py-3 rounded-xl text-sm flex items-center gap-2 animate-[shake_0.4s_ease-in-out]">
                                    <span className="text-base">⚠️</span> {error}
                                </div>
                            )}

                            <div className="space-y-3.5">
                                <div className="group">
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-white/50 focus:bg-white/10 focus:border-[#8EF9A0] focus:shadow-[0_0_15px_rgba(142,249,160,0.15)] focus:ring-[3px] focus:ring-[#8EF9A0]/20 transition-all duration-300 outline-none"
                                        placeholder="Full Name"
                                    />
                                </div>

                                <div className="group">
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-white/50 focus:bg-white/10 focus:border-[#8EF9A0] focus:shadow-[0_0_15px_rgba(142,249,160,0.15)] focus:ring-[3px] focus:ring-[#8EF9A0]/20 transition-all duration-300 outline-none"
                                        placeholder="Email Address"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3.5">
                                    <input
                                        type="number"
                                        value={age}
                                        onChange={(e) => setAge(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-white/50 focus:bg-white/10 focus:border-[#8EF9A0] focus:shadow-[0_0_15px_rgba(142,249,160,0.15)] focus:ring-[3px] focus:ring-[#8EF9A0]/20 transition-all duration-300 outline-none"
                                        placeholder="Age"
                                    />
                                    <div className="relative">
                                        <select
                                            value={gender}
                                            onChange={(e) => setGender(e.target.value as Gender)}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white focus:bg-white/10 focus:border-[#8EF9A0] focus:shadow-[0_0_15px_rgba(142,249,160,0.15)] focus:ring-[3px] focus:ring-[#8EF9A0]/20 transition-all duration-300 outline-none appearance-none cursor-pointer"
                                        >
                                            <option value="male" className="bg-[#1a1a24] text-white">Male</option>
                                            <option value="female" className="bg-[#1a1a24] text-white">Female</option>
                                            <option value="other" className="bg-[#1a1a24] text-white">Other</option>
                                        </select>
                                        <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-white/50">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3.5">
                                    <input
                                        type="number"
                                        value={height}
                                        onChange={(e) => setHeight(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-white/50 focus:bg-white/10 focus:border-[#8EF9A0] focus:shadow-[0_0_15px_rgba(142,249,160,0.15)] focus:ring-[3px] focus:ring-[#8EF9A0]/20 transition-all duration-300 outline-none"
                                        placeholder="Height (cm)"
                                    />
                                    <input
                                        type="number"
                                        value={weight}
                                        onChange={(e) => setWeight(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-white/50 focus:bg-white/10 focus:border-[#8EF9A0] focus:shadow-[0_0_15px_rgba(142,249,160,0.15)] focus:ring-[3px] focus:ring-[#8EF9A0]/20 transition-all duration-300 outline-none"
                                        placeholder="Weight (kg)"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isProcessing}
                                className={`w-full h-[50px] mt-6 font-semibold rounded-[14px] transition-all duration-300 flex items-center justify-center gap-2 group/btn relative overflow-hidden ${isProcessing
                                    ? 'bg-white/10 text-[#5eead4] border border-[#5eead4]/30 cursor-wait'
                                    : 'bg-gradient-to-tr from-[#0B1F3B] to-[#1A365D] text-white hover:scale-[1.02] shadow-[0_0_15px_rgba(11,31,59,0.4)] hover:shadow-[0_0_25px_rgba(26,54,93,0.6)] hover:brightness-110 active:scale-95'
                                    }`}
                            >
                                {isProcessing ? (
                                    <span className="flex items-center gap-2">
                                        <svg className="animate-spin h-5 w-5 text-white/70" viewBox="0 0 24 24" fill="none">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                                        </svg>
                                        <span className="tracking-wide text-white/90">Authenticating...</span>
                                    </span>
                                ) : (
                                    <>
                                        <span>Begin Journey</span>
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transition-transform group-hover/btn:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                        </svg>
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </>
    );
};

export default Login;
