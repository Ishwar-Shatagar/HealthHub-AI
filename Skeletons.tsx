
import React from 'react';

export const Skeleton: React.FC<{ className?: string }> = ({ className }) => (
    <div className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded ${className}`} />
);

export const DietPlanSkeleton: React.FC = () => (
    <div className="space-y-8 animate-fade-in">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-gray-100 dark:bg-gray-800/50 p-4 rounded-lg h-48 animate-pulse border border-gray-200 dark:border-gray-700">
                    <div className="h-6 w-1/3 bg-gray-300 dark:bg-gray-600 rounded mb-4"></div>
                    <div className="space-y-3">
                        <div className="flex justify-between">
                            <div className="h-4 w-1/2 bg-gray-300 dark:bg-gray-600 rounded"></div>
                            <div className="h-8 w-16 bg-gray-300 dark:bg-gray-600 rounded"></div>
                        </div>
                         <div className="flex justify-between">
                            <div className="h-4 w-1/3 bg-gray-300 dark:bg-gray-600 rounded"></div>
                            <div className="h-8 w-16 bg-gray-300 dark:bg-gray-600 rounded"></div>
                        </div>
                         <div className="flex justify-between">
                            <div className="h-4 w-2/3 bg-gray-300 dark:bg-gray-600 rounded"></div>
                            <div className="h-8 w-16 bg-gray-300 dark:bg-gray-600 rounded"></div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg animate-pulse border border-blue-100 dark:border-blue-800">
             <div className="h-6 w-48 bg-blue-200 dark:bg-blue-800 rounded mb-4"></div>
             <div className="space-y-2">
                 <div className="h-4 w-full bg-blue-200 dark:bg-blue-800/50 rounded"></div>
                 <div className="h-4 w-full bg-blue-200 dark:bg-blue-800/50 rounded"></div>
                 <div className="h-4 w-3/4 bg-blue-200 dark:bg-blue-800/50 rounded"></div>
             </div>
        </div>
         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm h-40 animate-pulse">
                    <div className="h-5 w-1/2 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
                    <div className="space-y-2">
                        <div className="h-3 w-full bg-gray-200 dark:bg-gray-700 rounded"></div>
                        <div className="h-3 w-5/6 bg-gray-200 dark:bg-gray-700 rounded"></div>
                        <div className="h-3 w-4/6 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    </div>
                </div>
            ))}
        </div>
    </div>
);

export const ReportSkeleton: React.FC = () => (
    <div className="space-y-6 animate-fade-in">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md animate-pulse border border-gray-100 dark:border-gray-700">
            <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
                 <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
                 <div className="h-4 w-28 bg-gray-200 dark:bg-gray-700 rounded"></div>
                 <div className="h-4 w-36 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </div>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 p-6 rounded-lg animate-pulse border border-green-100 dark:border-green-800">
            <div className="h-6 w-40 bg-green-200 dark:bg-green-800 rounded mb-4"></div>
             <div className="space-y-3">
                 <div className="flex items-center space-x-2">
                    <div className="h-5 w-5 rounded-full bg-green-200 dark:bg-green-800"></div>
                    <div className="h-4 w-3/4 bg-green-200 dark:bg-green-800/50 rounded"></div>
                 </div>
                 <div className="flex items-center space-x-2">
                    <div className="h-5 w-5 rounded-full bg-green-200 dark:bg-green-800"></div>
                    <div className="h-4 w-2/3 bg-green-200 dark:bg-green-800/50 rounded"></div>
                 </div>
             </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md h-48 animate-pulse border border-gray-100 dark:border-gray-700">
             <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
             <div className="space-y-2">
                 <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded"></div>
                 <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded"></div>
                 <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded"></div>
                 <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded"></div>
             </div>
        </div>
    </div>
);

export const ExerciseSkeleton: React.FC = () => (
     <div className="space-y-8 animate-fade-in">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm mb-6 animate-pulse border border-gray-100 dark:border-gray-700">
            <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
            <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded rounded-full"></div>
        </div>
        {[1, 2, 3].map((section) => (
            <div key={section}>
                 <div className="h-8 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden animate-pulse border border-gray-200 dark:border-gray-700">
                            <div className="h-48 bg-gray-300 dark:bg-gray-600"></div>
                            <div className="p-4 space-y-3">
                                <div className="h-6 w-3/4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                                <div className="h-4 w-1/2 bg-gray-200 dark:bg-gray-700 rounded"></div>
                                <div className="space-y-1 pt-2">
                                    <div className="h-3 w-full bg-gray-200 dark:bg-gray-700 rounded"></div>
                                    <div className="h-3 w-full bg-gray-200 dark:bg-gray-700 rounded"></div>
                                </div>
                            </div>
                        </div>
                    ))}
                 </div>
            </div>
        ))}
     </div>
);
