import React, { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import { ICONS, LANGUAGES } from '../constants';
import { TRANSLATIONS } from '../constants/translations';
import Chatbot from './Chatbot';
import SOSButton from './SOSButton';

const ThemeToggleButton: React.FC = () => {
    const { isDarkMode, toggleDarkMode, language } = useAppContext();
    const t = TRANSLATIONS[language] || TRANSLATIONS['English'];

    return (
        <button
            onClick={toggleDarkMode}
            className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 dark:focus:ring-offset-gray-900"
            aria-label={t.layout.toggle_dark_mode}
        >
            {isDarkMode ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
            ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
            )}
        </button>
    );
};

const ProfileMenu: React.FC = () => {
    const { user, navigateTo, logout, language } = useAppContext();
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const t = TRANSLATIONS[language] || TRANSLATIONS['English'];

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center space-x-2 md:space-x-3 cursor-pointer p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-colors duration-200 border border-transparent hover:border-gray-200 dark:hover:border-gray-700"
            >
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-green-400 to-green-600 flex items-center justify-center text-white font-bold shadow-sm">
                    {user?.name.charAt(0).toUpperCase()}
                </div>
                <div className="hidden md:block text-right">
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 leading-none">{user?.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">BMI: {user?.bmi}</p>
                </div>
                <svg className={`w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 py-2 z-50 transform origin-top-right transition-all">
                    <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-800 md:hidden">
                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{user?.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">BMI: {user?.bmi}</p>
                    </div>
                    <button
                        onClick={() => { navigateTo('EDIT_PROFILE'); setIsOpen(false); }}
                        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-green-50 dark:hover:bg-green-900/20 hover:text-green-600 dark:hover:text-green-400 flex items-center space-x-3 transition-colors"
                    >
                        {ICONS.edit}
                        <span>{t.layout.edit_profile}</span>
                    </button>
                    <button
                        onClick={() => { logout(); setIsOpen(false); }}
                        className="w-full text-left px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center space-x-3 transition-colors"
                    >
                        {ICONS.logout}
                        <span>{t.layout.sign_out}</span>
                    </button>
                </div>
            )}
        </div>
    );
};

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, currentPage, navigateTo, dailyLog, language, setLanguage } = useAppContext();
    const [isChatOpen, setIsChatOpen] = useState(false);
    const t = TRANSLATIONS[language] || TRANSLATIONS['English'];

    // Close chatbot and stop audio when navigating to a different page
    useEffect(() => {
        setIsChatOpen(false);
        window.speechSynthesis.cancel();
    }, [currentPage]);

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-800 dark:text-gray-200 font-sans transition-colors duration-300">
            {/* Background decoration */}
            <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
                <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-green-200/20 dark:bg-green-900/10 blur-3xl"></div>
                <div className="absolute top-1/3 -left-24 w-72 h-72 rounded-full bg-blue-200/20 dark:bg-blue-900/10 blur-3xl"></div>
            </div>

            <header className="fixed top-0 left-0 right-0 z-40 transition-all duration-300">
                <div className="absolute inset-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200/50 dark:border-gray-800/50 shadow-sm"></div>
                <div className="container mx-auto px-4 py-3 relative flex justify-between items-center">
                    <div className="flex items-center space-x-3 cursor-pointer" onClick={() => navigateTo('DASHBOARD')}>
                        <div className="bg-gradient-to-br from-green-500 to-teal-600 text-white p-2 rounded-xl shadow-lg shadow-green-500/20">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <h1 className="text-lg md:text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 tracking-tight truncate">{t.layout.app_title}</h1>
                    </div>

                    <div className="flex items-center space-x-2 md:space-x-4">
                        {currentPage !== 'DASHBOARD' && currentPage !== 'EDIT_PROFILE' && (
                            <button
                                onClick={() => navigateTo('DASHBOARD')}
                                className="hidden md:flex items-center space-x-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-400 transition-colors px-2 py-2 md:px-3 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5"
                            >
                                {ICONS.arrowLeft}
                                <span>{t.layout.dashboard}</span>
                            </button>
                        )}
                        <div className="h-6 w-px bg-gray-200 dark:bg-gray-700 hidden md:block"></div>
                        <ThemeToggleButton />
                        <ProfileMenu />
                    </div>
                </div>
            </header>

            <main className="relative container mx-auto p-4 pt-20 md:p-6 md:pt-28 z-10 max-w-7xl">
                {currentPage !== 'DASHBOARD' && currentPage !== 'EDIT_PROFILE' && (
                    <button
                        onClick={() => navigateTo('DASHBOARD')}
                        className="md:hidden mb-4 flex items-center space-x-2 text-sm font-medium text-gray-500 hover:text-green-600 dark:text-gray-400 dark:hover:text-green-400 transition-colors"
                    >
                        <div className="p-1 bg-white dark:bg-gray-800 rounded-full shadow-sm border border-gray-200 dark:border-gray-700">
                            {ICONS.arrowLeft}
                        </div>
                        <span>{t.layout.back_to_dashboard}</span>
                    </button>
                )}

                {children}
            </main>

            <SOSButton />

            {/* Global Chatbot - Available on all authenticated pages except Login */}
            {user && currentPage !== 'EDIT_PROFILE' && (
                <>
                    <button
                        onClick={() => setIsChatOpen(prev => !prev)}
                        className="fixed bottom-6 right-4 md:bottom-8 md:right-8 group z-[100]"
                        aria-label={t.layout.toggle_ai_assistant}
                    >
                        <div className="absolute inset-0 bg-green-400 rounded-full blur opacity-40 group-hover:opacity-70 animate-pulse"></div>
                        <div className="relative bg-gradient-to-tr from-green-600 to-teal-600 text-white p-3 md:p-4 rounded-full shadow-2xl hover:shadow-green-500/50 transform hover:scale-110 transition-all duration-300">
                            {ICONS.chatbot}
                        </div>
                    </button>

                    <Chatbot
                        isOpen={isChatOpen}
                        onClose={() => setIsChatOpen(false)}
                        user={user}
                        contextData={{ dailyLog }}
                        language={language}
                        setLanguage={setLanguage}
                        mode="dashboard"
                    />
                </>
            )}
        </div>
    );
};

export default Layout;
