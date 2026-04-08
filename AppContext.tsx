
import React, { createContext, useState, useContext, ReactNode, useCallback, useEffect } from 'react';
import { UserProfile, Page, DailyLog, DietPlan, ReportAnalysis, LoggedFood } from '../types';
import { registerUser, logUserActivity } from '../services/userService';

interface HealthTipData {
    text: string;
    language: string;
}

interface AppContextType {
    user: UserProfile | null;
    currentPage: Page;
    dailyLog: DailyLog;
    logHistory: DailyLog[];
    dietPlan: DietPlan | null;
    reportAnalysis: ReportAnalysis | null;
    isDarkMode: boolean;
    healthTipData: HealthTipData | null;
    language: string;
    login: (profile: Omit<UserProfile, 'bmi'>) => void;
    logout: () => void;
    navigateTo: (page: Page) => void;
    addFoodItems: (items: Omit<LoggedFood, 'source'>[], source: LoggedFood['source']) => void;
    removeFoodItem: (itemToRemove: LoggedFood) => void;
    addCaloriesOut: (amount: number) => void;
    setDietPlan: (plan: DietPlan) => void;
    setReportAnalysis: (analysis: ReportAnalysis) => void;
    toggleDarkMode: () => void;
    setHealthTipData: (data: HealthTipData) => void;
    setLanguage: (lang: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const getTodayString = () => new Date().toISOString().split('T')[0];

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<UserProfile | null>(null);
    const [currentPage, setCurrentPage] = useState<Page>('DASHBOARD');
    const [logHistory, setLogHistory] = useState<DailyLog[]>([]);
    const [dietPlan, setDietPlan] = useState<DietPlan | null>(null);
    const [reportAnalysis, setReportAnalysis] = useState<ReportAnalysis | null>(null);
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [healthTipData, setHealthTipData] = useState<HealthTipData | null>(null);
    const [language, setLanguage] = useState('English');

    useEffect(() => {
        const root = window.document.documentElement;
        if (isDarkMode) {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
    }, [isDarkMode]);

    const todayLog = logHistory.find(log => log.date === getTodayString()) || { date: getTodayString(), caloriesIn: 0, caloriesOut: 0, loggedFoods: [] };



    const login = (profile: Omit<UserProfile, 'bmi'>) => {
        const heightInMeters = profile.height / 100;
        const bmi = parseFloat((profile.weight / (heightInMeters * heightInMeters)).toFixed(1));
        const newUser = { ...profile, bmi };
        setUser(newUser);
        setCurrentPage('DASHBOARD');

        if (newUser.email) {
            registerUser(newUser.email);
        }
    };

    const logout = () => {
        setUser(null);
        setCurrentPage('DASHBOARD'); // Will be redirected to Login by App component
        setHealthTipData(null); // Clear cache on logout
    };

    const navigateTo = (page: Page) => {
        setCurrentPage(page);
    };

    const updateLogHistory = (updatedLog: DailyLog) => {
        setLogHistory(prev => {
            const existingIndex = prev.findIndex(log => log.date === updatedLog.date);
            let newHistory = [...prev];
            if (existingIndex > -1) {
                newHistory[existingIndex] = updatedLog;
            } else {
                newHistory.push(updatedLog);
            }
            // Keep only last 7 days
            return newHistory.slice(-7);
        });
    };

    const addFoodItems = useCallback((items: Omit<LoggedFood, 'source'>[], source: LoggedFood['source']) => {
        const itemsWithSource: LoggedFood[] = items.map(item => ({ ...item, source }));
        const totalCalories = items.reduce((sum, item) => sum + item.calories, 0);

        const updatedLog = {
            ...todayLog,
            // Only add to graphable calories if source is from the counter
            caloriesIn: todayLog.caloriesIn + (source === 'counter' ? totalCalories : 0),
            loggedFoods: [...todayLog.loggedFoods, ...itemsWithSource],
        };
        updateLogHistory(updatedLog);

        if (user?.email) {
            logUserActivity(user.email, 'food', { items: itemsWithSource, totalCalories });
        }
    }, [todayLog, user]);

    const removeFoodItem = useCallback((itemToRemove: LoggedFood) => {
        const indexToRemove = todayLog.loggedFoods.findIndex(
            item => item.name === itemToRemove.name && item.calories === itemToRemove.calories && item.source === itemToRemove.source
        );

        if (indexToRemove > -1) {
            const newLoggedFoods = [...todayLog.loggedFoods];
            newLoggedFoods.splice(indexToRemove, 1);

            const updatedLog = {
                ...todayLog,
                // Only subtract from graphable calories if source was from the counter
                caloriesIn: todayLog.caloriesIn - (itemToRemove.source === 'counter' ? itemToRemove.calories : 0),
                loggedFoods: newLoggedFoods,
            };
            updateLogHistory(updatedLog);
        }
    }, [todayLog]);

    const addCaloriesOut = useCallback((amount: number) => {
        const updatedLog = { ...todayLog, caloriesOut: todayLog.caloriesOut + amount };
        updateLogHistory(updatedLog);
    }, [todayLog]);

    const toggleDarkMode = useCallback(() => {
        setIsDarkMode(prev => !prev);
    }, []);

    return (
        <AppContext.Provider value={{
            user,
            currentPage,
            dailyLog: todayLog,
            logHistory,
            dietPlan,
            reportAnalysis,
            isDarkMode,
            healthTipData,
            language,
            login,
            logout,
            navigateTo,
            addFoodItems,
            removeFoodItem,
            addCaloriesOut,
            setDietPlan,
            setReportAnalysis,
            toggleDarkMode,
            setHealthTipData,
            setLanguage
        }}>
            {children}
        </AppContext.Provider>
    );
};

export const useAppContext = () => {
    const context = useContext(AppContext);
    if (context === undefined) {
        throw new Error('useAppContext must be used within an AppProvider');
    }
    return context;
};
