
import React from 'react';

const LoadingSpinner: React.FC<{ message?: string; fullScreen?: boolean }> = ({ message = "Loading...", fullScreen = false }) => {
    const content = (
        <div className="flex flex-col items-center justify-center p-8 text-center z-50">
            {/* Modern Spinner Container */}
            <div className="relative w-24 h-24 mb-8">
                {/* Outer pulsing glow */}
                <div className="absolute inset-0 bg-green-500/20 rounded-full animate-ping"></div>
                
                {/* Outer static ring */}
                <div className="absolute inset-0 border-4 border-gray-100 dark:border-gray-800 rounded-full"></div>

                {/* Spinning gradient ring */}
                <div className="absolute inset-0 rounded-full border-4 border-t-green-500 border-r-teal-400 border-b-green-600 border-l-transparent animate-spin shadow-lg shadow-green-500/20"></div>
                
                {/* Center Logo/Icon */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-12 h-12 bg-white dark:bg-gray-800 rounded-full shadow-inner flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600 dark:text-green-400 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                    </div>
                </div>
            </div>

            {/* Typography */}
            <div className="space-y-2">
                <h3 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 tracking-tight">
                    {message}
                </h3>
                <div className="flex items-center justify-center space-x-1 text-sm font-medium text-green-600 dark:text-green-400">
                    <span>AI Processing</span>
                    <span className="flex space-x-1 ml-1">
                        <span className="w-1 h-1 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></span>
                        <span className="w-1 h-1 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></span>
                        <span className="w-1 h-1 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></span>
                    </span>
                </div>
            </div>
        </div>
    );

    if (fullScreen) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/90 dark:bg-gray-950/95 backdrop-blur-md transition-opacity duration-300">
                {content}
            </div>
        );
    }

    return <div className="w-full flex justify-center py-12">{content}</div>;
};

export default LoadingSpinner;
