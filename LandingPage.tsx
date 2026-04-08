import React, { useEffect, useState, useRef } from 'react';

interface LandingPageProps {
    onExplore: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onExplore }) => {
    // Sphere position state (smoothly interpolated)
    const [spherePos, setSpherePos] = useState({ x: 0, y: 0 });
    const targetPos = useRef({ x: 0, y: 0 });
    const requestRef = useRef<number | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const [isExiting, setIsExiting] = useState(false);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!containerRef.current) return;

            const rect = containerRef.current.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;

            // Calculate mouse position relative to container center
            let moveX = (e.clientX - centerX) * 0.8; // 0.8 factor for parallax feel
            let moveY = (e.clientY - centerY) * 0.8;

            // Constrain movement within glass boundary (approx +/- 250px given 600px container and sphere size)
            const maxOffset = 180;
            moveX = Math.max(-maxOffset, Math.min(maxOffset, moveX));
            moveY = Math.max(-maxOffset, Math.min(maxOffset, moveY));

            targetPos.current = { x: moveX, y: moveY };
        };

        const animate = () => {
            setSpherePos(prev => {
                // Smooth easing (lerp)
                const dx = targetPos.current.x - prev.x;
                const dy = targetPos.current.y - prev.y;
                return {
                    x: prev.x + dx * 0.1,
                    y: prev.y + dy * 0.1
                };
            });
            requestRef.current = requestAnimationFrame(animate);
        };

        window.addEventListener('mousemove', handleMouseMove);
        requestRef.current = requestAnimationFrame(animate);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, []);

    const handleExploreClick = () => {
        setIsExiting(true);
        setTimeout(onExplore, 800);
    };

    return (
        <div className={`fixed inset-0 z-50 flex flex-col md:flex-row bg-[#020617] text-white overflow-hidden transition-opacity duration-1000 ${isExiting ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>

            {/* Background Gradient */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-teal-900/20 via-[#020617] to-black"></div>

            {/* Content Container */}
            <div className="relative z-20 w-full md:w-1/2 flex flex-col justify-center px-8 md:px-20 h-full">
                <div className={`transition-all duration-1000 delay-300 ${isExiting ? 'translate-y-10 opacity-0' : 'translate-y-0 opacity-100'}`}>
                    <h1 className="text-5xl md:text-7xl font-bold tracking-tighter mb-6 bg-clip-text text-transparent bg-gradient-to-r from-teal-200 to-white leading-tight">
                        The Future <br /> of Healthcare.
                    </h1>
                    <p className="text-lg md:text-xl text-blue-200/60 max-w-md font-light mb-10 leading-relaxed">
                        Precision AI diagnostics, personalized wellness, and seamless patient care. Experience the next generation of medical technology.
                    </p>

                    <button
                        onClick={handleExploreClick}
                        className="group relative px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full overflow-hidden transition-all duration-300 hover:scale-105 hover:border-teal-400/30 active:scale-95"
                    >
                        <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-teal-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                        <span className="relative z-10 flex items-center gap-3 font-medium tracking-wide">
                            Explore Technology
                            <svg className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                        </span>
                    </button>
                </div>

                {/* Scroll Indicator */}
                <div className="absolute bottom-10 left-1/2 md:left-20 transform -translate-x-1/2 md:translate-x-0 animate-bounce opacity-30">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path></svg>
                </div>
            </div>

            {/* 3D Visual Container (Right Side) */}
            <div className="absolute inset-0 md:relative w-full md:w-1/2 h-full flex items-center justify-center perspective-1000 pointer-events-none md:pointer-events-auto">
                <div
                    ref={containerRef}
                    className="relative w-[300px] h-[300px] md:w-[600px] md:h-[600px] flex items-center justify-center rounded-full overflow-hidden"
                >
                    {/* The Glowing Sphere - INCREASED SIZE & DEPTH */}
                    <div
                        className={`absolute rounded-full transition-opacity duration-1000 ${isExiting ? 'scale-150 opacity-0' : 'scale-100 opacity-100'}`}
                        style={{
                            width: '400px', // Increased size (approx 30-40% larger than before)
                            height: '400px',
                            background: 'radial-gradient(circle at 30% 30%, #2dd4bf, #059669)', // Teal to Emerald
                            transform: `translate(${spherePos.x}px, ${spherePos.y}px)`,
                            boxShadow: '0 0 120px rgba(45, 212, 191, 0.6), inset 0 0 60px rgba(0,0,0,0.5)', // Stronger glow + inner depth
                            zIndex: 0
                        }}
                    >
                        {/* Internal Light Reflection/Highlight */}
                        <div className="absolute top-10 left-10 w-20 h-20 bg-white opacity-40 blur-xl rounded-full"></div>
                        <div className="absolute bottom-10 right-10 w-32 h-32 bg-emerald-900 opacity-50 blur-2xl rounded-full mix-blend-multiply"></div>
                    </div>

                    {/* Glass Slices Layer - VERTICAL & CIRCULAR SILHOUETTE */}
                    <div className="absolute inset-0 w-full h-full flex flex-row justify-center items-center z-20 gap-2 pointer-events-none p-0">
                        {Array.from({ length: 23 }).map((_, i) => {
                            const distance = Math.abs(i - 11);
                            const widthFactor = Math.sqrt(12 * 12 - distance * distance);

                            return (
                                <div
                                    key={i}
                                    className={`relative transition-transform duration-1000 ${isExiting ? 'scale-y-0' : 'scale-y-100'}`}
                                    style={{
                                        height: '100%',
                                        flex: widthFactor,
                                        backdropFilter: 'blur(20px) saturate(180%)',
                                        background: 'linear-gradient(90deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))',
                                        borderLeft: '1px solid rgba(255,255,255,0.2)', // Subtle edge highlight
                                        borderRight: '1px solid rgba(255,255,255,0.05)',
                                        boxShadow: 'inset 0 0 12px rgba(0, 0, 0, 0.1)' // Minimal depth, no rotateY
                                    }}
                                >
                                    {/* Frosted Noise Texture */}
                                    <div className="absolute inset-0 opacity-[0.05] bg-[url('https://grainy-gradients.vercel.app/noise.svg')] mix-blend-overlay"></div>

                                    {/* Vertical Reflection Highlight */}
                                    <div className="absolute inset-y-0 left-0 w-[1px] bg-gradient-to-b from-transparent via-white/50 to-transparent opacity-60"></div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LandingPage;


