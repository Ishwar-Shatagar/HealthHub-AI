
import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { IdentifiedFood, CalorieAnalysisResult } from '../types';
import { identifyFoodInImage, getNutritionalInfoAndAccuracy } from '../services/geminiService';
import { sendDailyReport } from '../services/emailService';
import { getErrorMessage } from '../utils/helpers';
import { fileToBase64 } from '../services/helpers';
import LoadingSpinner from '../components/LoadingSpinner';
import { ICONS } from '../constants';
import NearbyDoctors from '../components/NearbyDoctors';

type Step = 'upload' | 'confirm' | 'result';

const CalorieCounter: React.FC = () => {
    const { addFoodItems, navigateTo, user } = useAppContext();
    const [step, setStep] = useState<Step>('upload');
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [additionalInfo, setAdditionalInfo] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    // State for the confirmation step
    const [identifiedFoods, setIdentifiedFoods] = useState<IdentifiedFood[]>([]);

    // State for the final, editable result
    const [analysisResult, setAnalysisResult] = useState<CalorieAnalysisResult | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            setPreview(URL.createObjectURL(selectedFile));
            // Reset flow if a new file is chosen
            setStep('upload');
            setError('');
            setIdentifiedFoods([]);
            setAnalysisResult(null);
        }
    };

    const handleIdentify = async () => {
        if (!file) {
            setError('Please upload a photo of your meal.');
            return;
        }
        setIsLoading(true);
        setError('');
        try {
            const base64Image = await fileToBase64(file);
            const foods = await identifyFoodInImage(base64Image, file.type, additionalInfo);
            setIdentifiedFoods(foods.map(f => ({ ...f, id: Math.random().toString(36).substr(2, 9) })));
            setStep('confirm');
        } catch (err) {
            setError(`Failed to identify food. ${getErrorMessage(err)} Please try with a clearer photo.`);
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAnalyze = async () => {
        if (!file || identifiedFoods.length === 0) {
            setError('No food items to analyze.');
            return;
        }
        setIsLoading(true);
        setError('');
        try {
            const base64Image = await fileToBase64(file);
            const result = await getNutritionalInfoAndAccuracy(identifiedFoods, base64Image, file.type);
            setAnalysisResult(result);
            setStep('result');
        } catch (err) {
            setError(`Failed to get nutritional info. ${getErrorMessage(err)}`);
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleLogCalories = async () => {
        if (analysisResult) {
            const itemsToLog = analysisResult.foodItems.map(item => ({ name: item.name, calories: item.calories }));
            addFoodItems(itemsToLog, 'counter');

            // Auto-send email
            if (user && user.email) {
                try {
                    const today = new Date().toISOString().split('T')[0];
                    const totalCals = itemsToLog.reduce((sum, item) => sum + item.calories, 0);

                    await sendDailyReport(user.email, {
                        intake: totalCals,
                        burned: 0,
                        net: totalCals,
                        date: today,
                        foods: itemsToLog
                    });
                    console.log("Meal logged and report sent.");
                } catch (err) {
                    console.error("Failed to send auto-report:", err);
                }
            }

            navigateTo('TODAYS_GOAL');
        }
    };

    const handleStartOver = () => {
        setStep('upload');
        setFile(null);
        setPreview(null);
        setError('');
        setIdentifiedFoods([]);
        setAnalysisResult(null);
        setAdditionalInfo('');
    }

    const renderUploadStep = () => (
        <form onSubmit={(e) => { e.preventDefault(); handleIdentify(); }} className="space-y-8 animate-fade-in">
            <div className="group">
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider">Food Photo</label>
                <label
                    htmlFor="file-upload"
                    className={`relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-300 ${file ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/10' : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/30 hover:bg-gray-100 dark:hover:bg-gray-700 hover:border-orange-400'}`}
                >
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        {preview ? (
                            <img src={preview} alt="Meal preview" className="h-48 w-auto object-contain rounded-lg shadow-sm" />
                        ) : (
                            <>
                                <div className="w-16 h-16 mx-auto bg-white dark:bg-gray-800 rounded-full flex items-center justify-center shadow-sm mb-4 group-hover:scale-110 transition-transform duration-300">
                                    <svg className="w-8 h-8 text-gray-400 dark:text-gray-500 group-hover:text-orange-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                                </div>
                                <p className="mb-2 text-sm text-gray-500 dark:text-gray-400"><span className="font-semibold text-gray-900 dark:text-white group-hover:text-orange-600 dark:group-hover:text-orange-400">Tap to upload</span> meal photo</p>
                            </>
                        )}
                    </div>
                    <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleFileChange} accept="image/*" />
                </label>
            </div>

            <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Add Context (Optional)</label>
                <textarea value={additionalInfo} onChange={e => setAdditionalInfo(e.target.value)} placeholder="e.g., 3 chapatis, cooked with ghee, homemade curry" rows={3} className="block w-full px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all resize-none text-gray-900 dark:text-white"></textarea>
            </div>

            <button type="submit" disabled={!file || isLoading} className="w-full py-4 px-6 bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold text-lg rounded-2xl shadow-lg shadow-orange-500/30 hover:shadow-xl hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:transform-none transition-all duration-200">
                {isLoading ? "Analyzing Image..." : "Identify Food Items"}
            </button>
        </form>
    );

    const renderConfirmStep = () => {
        const handleFoodChange = (id: string, field: keyof IdentifiedFood, value: string | number) => {
            setIdentifiedFoods(foods => foods.map(f => f.id === id ? { ...f, [field]: value } : f));
        };
        const addFoodItem = () => {
            setIdentifiedFoods(foods => [...foods, { id: Math.random().toString(36).substr(2, 9), name: '', weight: 0, cookingMethod: 'Unknown' }]);
        };
        const removeFoodItem = (id: string) => {
            setIdentifiedFoods(foods => foods.filter(f => f.id !== id));
        };

        const cookingMethods = ['Fried', 'Grilled', 'Boiled/Steamed', 'Raw', 'Baked', 'Curry/Gravy', 'Roasted', 'Unknown'];

        return (
            <div className="space-y-6 animate-fade-in">
                <div className="flex justify-center">
                    <img src={preview!} alt="Meal" className="rounded-2xl shadow-md max-h-64 object-cover" />
                </div>

                <div className="bg-gray-50 dark:bg-gray-800 p-1 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-x-auto">
                    <div className="min-w-[500px] grid grid-cols-12 gap-2 px-4 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
                        <div className="col-span-5">Item Name</div>
                        <div className="col-span-3">Cooking Method</div>
                        <div className="col-span-3">Weight (g)</div>
                        <div className="col-span-1"></div>
                    </div>
                    <div className="space-y-1 min-w-[500px]">
                        {identifiedFoods.map((food) => (
                            <div key={food.id} className="grid grid-cols-12 gap-2 items-center bg-white dark:bg-gray-700/30 p-3 rounded-xl border border-gray-100 dark:border-gray-700">
                                <div className="col-span-5">
                                    <input
                                        type="text"
                                        value={food.name}
                                        onChange={(e) => handleFoodChange(food.id, 'name', e.target.value)}
                                        className="w-full bg-transparent font-medium text-gray-800 dark:text-white focus:outline-none border-b border-transparent focus:border-orange-400 transition-colors"
                                    />
                                </div>
                                <div className="col-span-3">
                                    <select
                                        value={food.cookingMethod}
                                        onChange={(e) => handleFoodChange(food.id, 'cookingMethod', e.target.value)}
                                        className="w-full bg-transparent text-sm text-gray-600 dark:text-gray-300 focus:outline-none cursor-pointer border-b border-transparent focus:border-orange-400"
                                    >
                                        {cookingMethods.map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                </div>
                                <div className="col-span-3">
                                    <input
                                        type="number"
                                        value={food.weight}
                                        onChange={(e) => handleFoodChange(food.id, 'weight', parseFloat(e.target.value) || 0)}
                                        className="w-full bg-transparent font-medium text-gray-800 dark:text-white focus:outline-none border-b border-transparent focus:border-orange-400 transition-colors"
                                    />
                                </div>
                                <div className="col-span-1 flex justify-end">
                                    <button onClick={() => removeFoodItem(food.id)} className="text-red-400 hover:text-red-600">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </div>
                            </div>
                        ))}
                        {identifiedFoods.length === 0 && (
                            <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-4">No items identified. Please add manually.</p>
                        )}
                    </div>
                </div>

                <button onClick={addFoodItem} className="w-full py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-gray-500 dark:text-gray-400 font-medium hover:border-orange-400 hover:text-orange-500 transition-colors">
                    + Add Another Item
                </button>

                <div className="grid grid-cols-2 gap-4">
                    <button onClick={handleStartOver} className="py-3 px-4 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                        Back
                    </button>
                    <button onClick={handleAnalyze} className="py-3 px-4 bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold rounded-xl shadow-lg shadow-orange-500/30 hover:shadow-xl hover:-translate-y-0.5 transition-all">
                        Calculate Calories
                    </button>
                </div>
            </div>
        );
    };

    const renderResultStep = () => {
        if (!analysisResult) return null;
        const totalCalories = analysisResult.foodItems.reduce((sum, item) => sum + item.calories, 0);

        return (
            <div className="space-y-6 animate-fade-in">
                <div className="text-center">
                    <div className="inline-block p-4 rounded-full bg-orange-50 dark:bg-orange-900/20 mb-2">
                        <div className="text-4xl font-black text-orange-600 dark:text-orange-400">{totalCalories.toFixed(0)}</div>
                        <div className="text-xs font-bold text-orange-400 uppercase tracking-widest">Total Calories</div>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                    {analysisResult.foodItems.map((item, index) => (
                        <div key={index} className="p-4 border-b border-gray-100 dark:border-gray-700 last:border-0">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <h4 className="font-bold text-gray-900 dark:text-white">{item.name}</h4>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${item.source === 'USDA' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'}`}>
                                        {item.source} Verified
                                    </span>
                                </div>
                                <span className="font-bold text-orange-600 dark:text-orange-400">{item.calories.toFixed(0)} kcal</span>
                            </div>
                            <div className="grid grid-cols-4 gap-2 text-center text-xs text-gray-500 dark:text-gray-400 mb-3">
                                <div>
                                    <div className="font-semibold text-gray-700 dark:text-gray-300">{item.protein.toFixed(1)}g</div>
                                    <div>Protein</div>
                                </div>
                                <div>
                                    <div className="font-semibold text-gray-700 dark:text-gray-300">{item.carbs.toFixed(1)}g</div>
                                    <div>Carbs</div>
                                </div>
                                <div>
                                    <div className="font-semibold text-gray-700 dark:text-gray-300">{item.fat.toFixed(1)}g</div>
                                    <div>Fat</div>
                                </div>
                                <div>
                                    <div className="font-semibold text-gray-700 dark:text-gray-300">{item.fiber.toFixed(1)}g</div>
                                    <div>Fiber</div>
                                </div>
                            </div>

                            {item.healthVerdict && (
                                <div className="mt-2 text-xs bg-gray-50 dark:bg-gray-700/50 p-2 rounded-lg border-l-4 border-orange-400 dark:border-orange-500 text-gray-600 dark:text-gray-300">
                                    <span className="font-bold text-orange-500 dark:text-orange-400 mr-1">Health Insight:</span>
                                    {item.healthVerdict}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Accuracy Meter */}
                <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/30 p-3 rounded-xl text-sm">
                    <span className="text-gray-500 dark:text-gray-400">AI Confidence Score</span>
                    <div className="flex items-center">
                        <div className="w-24 h-2 bg-gray-200 dark:bg-gray-600 rounded-full mr-3 overflow-hidden">
                            <div className={`h-full rounded-full ${analysisResult.accuracy > 80 ? 'bg-green-500' : analysisResult.accuracy > 50 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${analysisResult.accuracy}%` }}></div>
                        </div>
                        <span className="font-bold text-gray-700 dark:text-gray-200">{analysisResult.accuracy}%</span>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                    <button onClick={handleStartOver} className="py-3 px-4 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                        Discard
                    </button>
                    <button onClick={handleLogCalories} className="py-3 px-4 bg-green-600 text-white font-bold rounded-xl shadow-lg hover:bg-green-700 transition-colors">
                        Log to Journal
                    </button>
                </div>
            </div>
        );
    };

    if (isLoading) {
        return (
            <div className="max-w-4xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 min-h-[400px] flex items-center justify-center">
                <LoadingSpinner message="Analyzing your food..." />
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto bg-white dark:bg-gray-800 p-6 md:p-10 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 animate-fade-in-up">
            <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 mb-4">
                    {ICONS.flame}
                </div>
                <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">AI Calorie Counter</h2>
                <p className="text-gray-500 dark:text-gray-400 mt-2">Snap a photo, and let AI calculate your nutrition.</p>
            </div>

            {error && (
                <div className="mb-6 flex items-start p-4 bg-red-50 dark:bg-red-900/30 rounded-xl border border-red-100 dark:border-red-800">
                    <div className="flex-shrink-0 text-red-500 dark:text-red-400">
                        {ICONS.warning}
                    </div>
                    <div className="ml-3">
                        <p className="text-sm font-medium text-red-800 dark:text-red-200">{error}</p>
                    </div>
                </div>
            )}

            {step === 'upload' && renderUploadStep()}
            {step === 'confirm' && renderConfirmStep()}
            {step === 'result' && renderResultStep()}
            {step === 'result' && <NearbyDoctors searchType="general" title="Nearby Nutritionists & Dietitians" />}
        </div>
    );
};

export default CalorieCounter;