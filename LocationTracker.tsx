import React, { useState, useEffect, useMemo, useRef } from 'react';
import { findNearbyHealthServices } from '../services/geminiService';
import { NearbyHealthServices, HealthServiceLocation } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import { getErrorMessage } from '../utils/helpers';
import { ICONS } from '../constants';

type Status = 'idle' | 'locating' | 'fetching' | 'success' | 'error';
type Category = 'All' | 'Hospitals' | 'Clinics' | 'Medical Stores';

const LocationCard: React.FC<{ service: HealthServiceLocation; categoryIcon: React.ReactNode; distance?: number }> = ({ service, categoryIcon, distance }) => {
    return (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col h-full border border-gray-100 dark:border-gray-700 group">
            <div className="flex justify-between items-start mb-2">
                <div className="flex items-start space-x-3">
                    <div className="p-2 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg shrink-0 group-hover:bg-green-100 dark:group-hover:bg-green-900/50 transition-colors">
                        {categoryIcon}
                    </div>
                    <div>
                        <h4 className="font-semibold text-gray-800 dark:text-gray-200 leading-tight">{service.name}</h4>
                    </div>
                </div>
                {/* Visual Star Rating */}
                {service.rating && service.rating > 0 && (
                    <div className="flex flex-col items-end">
                        <div className="flex items-center space-x-1 text-xs font-bold text-yellow-700 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30 px-2 py-1 rounded-full flex-shrink-0">
                            <span>{service.rating.toFixed(1)}</span>
                            <svg className="w-3 h-3 text-yellow-500 fill-current" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"></path></svg>
                        </div>
                        <div className="flex mt-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <svg
                                    key={star}
                                    className={`w-2 h-2 ${star <= Math.round(service.rating || 0) ? 'text-yellow-400 fill-current' : 'text-gray-300 dark:text-gray-600'}`}
                                    viewBox="0 0 24 24"
                                >
                                    <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"></path>
                                </svg>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 flex-grow pl-[3.25rem] leading-snug">{service.address}</p>

            <div className="mt-4 flex items-center justify-end space-x-2 pl-[3.25rem]">
                <button
                    onClick={() => {
                        const text = `${service.name}\n${service.address}`;
                        navigator.clipboard.writeText(text);
                        alert('Address copied to clipboard!');
                    }}
                    className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    title="Copy Address"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path></svg>
                </button>
                <a
                    href={service.mapsUri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-grow text-center py-2 px-4 bg-gray-50 dark:bg-gray-700 hover:bg-green-50 dark:hover:bg-green-900/20 text-sm font-medium text-gray-700 dark:text-gray-200 hover:text-green-600 dark:hover:text-green-400 rounded-lg transition-colors flex items-center justify-center border border-gray-200 dark:border-gray-600"
                >
                    <span>Get Directions</span>
                    <svg className="w-4 h-4 ml-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3"></path></svg>
                </a>
            </div>
        </div>
    );
};

// Haversine formula to calculate distance in km
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return d;
};

const deg2rad = (deg: number) => {
    return deg * (Math.PI / 180);
};

const LocationTracker: React.FC = () => {
    const [status, setStatus] = useState<Status>('idle');
    const [error, setError] = useState<string | null>(null);
    const [services, setServices] = useState<NearbyHealthServices | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState<Category>('All');
    const [useManualSearch, setUseManualSearch] = useState(false);
    const [userLocation, setUserLocation] = useState<{ lat: number, lng: number, accuracy?: number } | null>(null);

    // Filters
    const [maxDistance, setMaxDistance] = useState<number>(20);
    const [minRating, setMinRating] = useState<number>(0);

    const isMounted = useRef(true);
    const isFetching = useRef(false);

    useEffect(() => {
        isMounted.current = true;
        return () => { isMounted.current = false; };
    }, []);

    // AUTO-FETCH REMOVED: We now wait for user interaction

    const fetchLocationGPS = async () => {
        if (isFetching.current) return;
        isFetching.current = true;

        if (isMounted.current) {
            setStatus('locating');
            setError(null);
            setServices(null);
        }

        if (!navigator.geolocation) {
            if (isMounted.current) {
                setError("Geolocation is not supported by your browser. Please try manual search.");
                setStatus('error');
                isFetching.current = false;
            }
            return;
        }

        const getPosition = (options: PositionOptions): Promise<GeolocationPosition> => {
            return new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, options);
            });
        };

        try {
            // Attempt 1: High Accuracy (Timeout 10s)
            let position: GeolocationPosition;
            try {
                position = await getPosition({ enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
            } catch (e) {
                console.warn("High accuracy GPS failed, retrying with low accuracy...", e);
                // Attempt 2: Low Accuracy (Timeout 20s) - Better for indoors/laptops
                position = await getPosition({ enableHighAccuracy: false, timeout: 20000, maximumAge: 0 });
            }

            if (!isMounted.current) return;

            const { latitude, longitude, accuracy } = position.coords;
            setUserLocation({ lat: latitude, lng: longitude, accuracy });

            setStatus('fetching');

            const result = await findNearbyHealthServices({ lat: latitude, lng: longitude });

            if (isMounted.current) {
                setServices(result);
                setStatus('success');
            }

        } catch (geoError: any) {
            if (!isMounted.current) return;

            let errorMessage = "An unknown error occurred while getting your location.";
            if (geoError.code === geoError.PERMISSION_DENIED) {
                errorMessage = "Location access denied. Please click the lock icon in your address bar to allow location access, then try again.";
            } else if (geoError.code === geoError.POSITION_UNAVAILABLE) {
                errorMessage = "Location unavailable. Please use manual search.";
            } else if (geoError.code === geoError.TIMEOUT) {
                errorMessage = "Location request timed out. Please try again or use manual search.";
            }

            setError(errorMessage);
            setStatus('error');
        } finally {
            isFetching.current = false;
        }
    };

    const handleManualSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;

        setStatus('fetching');
        setError(null);
        setServices(null);
        setUseManualSearch(true);

        // Check if input matches "lat, lng" pattern
        const coordMatch = searchQuery.match(/^(-?\d+(\.\d+)?),\s*(-?\d+(\.\d+)?)$/);

        try {
            let result;
            if (coordMatch) {
                const lat = parseFloat(coordMatch[1]);
                const lng = parseFloat(coordMatch[3]);
                setUserLocation({ lat, lng, accuracy: 0 }); // Manual coords are "perfectly" accurate to what was typed
                result = await findNearbyHealthServices({ lat, lng });
            } else {
                setUserLocation(null); // Clear specific coords if searching by city name
                result = await findNearbyHealthServices(searchQuery);
            }
            setServices(result);
            setStatus('success');
        } catch (err) {
            setError(`Failed to find services for "${searchQuery}". ${getErrorMessage(err)}`);
            setStatus('error');
        }
    };

    const categories: Category[] = ['All', 'Hospitals', 'Clinics', 'Medical Stores'];

    const processedServices = useMemo(() => {
        if (!services) return { hospitals: [], clinics: [], medicalStores: [] };

        const hasLocationReference = userLocation && (userLocation.lat !== 0 || userLocation.lng !== 0);

        const processList = (list: HealthServiceLocation[]) => {
            let processed = list.map(item => {
                // Calculate distance only if we have a user location
                const dist = hasLocationReference
                    ? calculateDistance(userLocation!.lat, userLocation!.lng, item.latitude, item.longitude)
                    : undefined;
                return {
                    ...item,
                    distance: dist
                };
            });

            // Apply distance filters ONLY if we have a reference point
            if (hasLocationReference) {
                processed = processed.filter(item => (item.distance as number) <= maxDistance);
                processed.sort((a, b) => (a.distance as number) - (b.distance as number));
            }

            // Apply rating filter
            if (minRating > 0) {
                processed = processed.filter(item => (item.rating || 0) >= minRating);
            }

            return processed;
        };

        return {
            hospitals: processList(services.hospitals),
            clinics: processList(services.clinics),
            medicalStores: processList(services.medicalStores)
        };
    }, [services, userLocation, maxDistance, minRating]);

    const renderContent = () => {
        if (status === 'idle') {
            return (
                <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 text-center animate-fade-in shadow-sm">
                    <div className="w-20 h-20 bg-green-50 dark:bg-green-900/30 rounded-full flex items-center justify-center text-green-600 dark:text-green-400 mb-6 shadow-inner">
                        <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">Find Health Services Near You</h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-md mx-auto">
                        Locate hospitals, clinics, and pharmacies in your area instantly.
                    </p>
                    <button
                        onClick={fetchLocationGPS}
                        className="px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-lg font-bold rounded-2xl hover:shadow-lg hover:scale-105 transition-all duration-300 flex items-center"
                    >
                        <svg className="w-6 h-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                        Use My Current Location
                    </button>
                    <p className="text-xs text-gray-400 mt-4">
                        Or search manually by city name above
                    </p>
                </div>
            );
        }

        if (status === 'locating') return <LoadingSpinner message="Acquiring precise GPS location..." />;
        if (status === 'fetching') return <LoadingSpinner message={`Scanning for health services ${useManualSearch ? 'in designated area' : 'nearby'}...`} />;

        if (status === 'error') {
            return (
                <div className="flex flex-col items-center justify-center p-8 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 text-center animate-fade-in">
                    <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center text-red-500 mb-4">
                        {ICONS.warning}
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Location Error</h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md">{error}</p>
                    <div className="flex space-x-4">
                        <button
                            onClick={() => { isFetching.current = false; fetchLocationGPS(); }}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-md"
                        >
                            Retry GPS
                        </button>
                        <button
                            onClick={() => setUseManualSearch(true)}
                            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        >
                            Search Manually
                        </button>
                    </div>
                </div>
            );
        }

        if (status === 'success' && services) {
            const showHospitals = activeCategory === 'All' || activeCategory === 'Hospitals';
            const showClinics = activeCategory === 'All' || activeCategory === 'Clinics';
            const showStores = activeCategory === 'All' || activeCategory === 'Medical Stores';

            const hospitals = processedServices.hospitals;
            const clinics = processedServices.clinics;
            const stores = processedServices.medicalStores;

            const hasResults = (showHospitals && hospitals.length) || (showClinics && clinics.length) || (showStores && stores.length);

            if (!hasResults) {
                return (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400 animate-fade-in">
                        <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-full mb-4">
                            <svg className="w-8 h-8 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                        <p>No matches found.</p>
                        <p className="text-xs mt-1">Try adjusting your filters or expanding your search.</p>
                        <button onClick={() => { setMaxDistance(20); setMinRating(0); }} className="mt-4 text-green-600 font-medium hover:underline text-sm">Reset Filters</button>
                    </div>
                );
            }

            return (
                <div className="space-y-8 animate-fade-in">
                    {/* Active Category Header */}
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            {userLocation ? (
                                <>Showing results within <strong>{maxDistance}km</strong> {minRating > 0 ? 'rated 4.0+' : ''}.</>
                            ) : (
                                <>Showing top results for your search area.</>
                            )}
                        </p>
                    </div>

                    {showHospitals && hospitals.length > 0 && (
                        <div>
                            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center">
                                <span className="bg-red-100 text-red-600 p-1.5 rounded-lg mr-2 shadow-sm">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m8-2a2 2 0 100-4 2 2 0 000 4zm-8-4a2 2 0 100-4 2 2 0 000 4zm-2-4a2 2 0 100-4 2 2 0 000 4zm16-4a2 2 0 100-4 2 2 0 000 4zm-8-4a2 2 0 100-4 2 2 0 000 4zm-2-4a2 2 0 100-4 2 2 0 000 4z" /></svg>
                                </span>
                                Hospitals
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                {hospitals.map((service, index) => (
                                    <LocationCard
                                        key={index}
                                        service={service}
                                        distance={service.distance}
                                        categoryIcon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m8-2a2 2 0 100-4 2 2 0 000 4zm-8-4a2 2 0 100-4 2 2 0 000 4zm-2-4a2 2 0 100-4 2 2 0 000 4zm16-4a2 2 0 100-4 2 2 0 000 4zm-8-4a2 2 0 100-4 2 2 0 000 4zm-2-4a2 2 0 100-4 2 2 0 000 4z" /></svg>}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {showClinics && clinics.length > 0 && (
                        <div>
                            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center">
                                <span className="bg-blue-100 text-blue-600 p-1.5 rounded-lg mr-2 shadow-sm">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m8-2a2 2 0 100-4 2 2 0 000 4z" /></svg>
                                </span>
                                Clinics
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                {clinics.map((service, index) => (
                                    <LocationCard
                                        key={index}
                                        service={service}
                                        distance={service.distance}
                                        categoryIcon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {showStores && stores.length > 0 && (
                        <div>
                            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center">
                                <span className="bg-green-100 text-green-600 p-1.5 rounded-lg mr-2 shadow-sm">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                                </span>
                                Medical Stores
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                {stores.map((service, index) => (
                                    <LocationCard
                                        key={index}
                                        service={service}
                                        distance={service.distance}
                                        categoryIcon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            );
        }

        return null;
    };

    return (
        <div className="max-w-6xl mx-auto px-2 sm:px-0 animate-fade-in-up">
            <div className="mb-8 text-center md:text-left">
                <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">Nearby Health Services</h2>
                <p className="text-gray-500 dark:text-gray-400 mt-2">Find the closest hospitals, clinics, and pharmacies.</p>
            </div>

            {/* Location Status Banner */}
            {userLocation && (
                <div className={`mb-6 p-3 rounded-xl border flex items-center justify-between text-sm ${userLocation.accuracy && userLocation.accuracy > 1000 ? 'bg-yellow-50 border-yellow-200 text-yellow-800' : 'bg-green-50 border-green-200 text-green-800'} dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300`}>
                    <div className="flex items-center space-x-2">
                        <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                        <div>
                            <span className="font-semibold">Current Location:</span> {userLocation.lat.toFixed(6)}, {userLocation.lng.toFixed(6)}
                            {userLocation.accuracy && userLocation.accuracy > 0 && (
                                <span className="ml-2 text-xs opacity-75">(Accuracy: ±{userLocation.accuracy.toFixed(0)}m)</span>
                            )}
                            {userLocation.accuracy && userLocation.accuracy > 1000 && (
                                <p className="text-xs text-yellow-600 mt-1 font-semibold">Low accuracy detected. Try manual search or coordinates if results are incorrect.</p>
                            )}
                        </div>
                    </div>
                    <a
                        href={`https://www.google.com/maps/search/?api=1&query=${userLocation.lat},${userLocation.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green-600 dark:text-green-400 underline hover:text-green-700 ml-4 shrink-0"
                    >
                        Verify on Map
                    </a>
                </div>
            )}

            {/* Search and Filters */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 mb-8">
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">

                    {/* Search Form */}
                    <form onSubmit={handleManualSearch} className="w-full md:w-1/2 relative">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Enter 'Lat, Lng' OR city name..."
                            className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/50 transition-all text-gray-900 dark:text-white"
                        />
                        <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                        </div>
                        {useManualSearch && (
                            <button
                                type="button"
                                onClick={() => { setSearchQuery(''); setUseManualSearch(false); }}
                                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-green-600 font-semibold hover:underline bg-white dark:bg-gray-800 px-2 py-1 rounded shadow-sm"
                            >
                                Use GPS
                            </button>
                        )}
                    </form>

                    {/* Filter Controls */}
                    <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                        <select
                            value={maxDistance}
                            onChange={(e) => setMaxDistance(Number(e.target.value))}
                            disabled={!userLocation} // Disable if no user location (text search)
                            className={`px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500 cursor-pointer ${!userLocation ? 'opacity-50 cursor-not-allowed' : ''}`}
                            title={!userLocation ? "Distance filtering disabled for text searches" : "Filter by distance"}
                        >
                            <option value="1">Within 1 km</option>
                            <option value="2">Within 2 km</option>
                            <option value="5">Within 5 km</option>
                            <option value="10">Within 10 km</option>
                            <option value="20">Within 20 km</option>
                        </select>

                        <button
                            onClick={() => setMinRating(prev => prev === 0 ? 4 : 0)}
                            className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${minRating > 0 ? 'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-700 text-yellow-700 dark:text-yellow-400' : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300'}`}
                        >
                            <svg className={`w-4 h-4 mr-1 ${minRating > 0 ? 'fill-current' : 'text-gray-400'}`} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={minRating > 0 ? 0 : 2}>
                                <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"></path>
                            </svg>
                            4.0+ Stars
                        </button>
                    </div>
                </div>

                {/* Category Tabs */}
                <div className="flex space-x-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-xl w-full overflow-x-auto mt-4">
                    {categories.map((cat) => (
                        <button
                            key={cat}
                            onClick={() => setActiveCategory(cat)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex-grow md:flex-grow-0 ${activeCategory === cat
                                ? 'bg-white dark:bg-gray-600 text-green-600 dark:text-green-400 shadow-sm'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                                }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            {renderContent()}
        </div>
    );
};

export default LocationTracker;
