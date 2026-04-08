// src/utils/helpers.ts

// ===============================
// ERROR HANDLING
// ===============================

export const getErrorMessage = (error: any): string => {
    if (error instanceof Error) return error.message;
    return String(error);
};

// ===============================
// FILE TO BASE64
// ===============================

export const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
};

// ===============================
// CALCULATE MAINTENANCE CALORIES
// ===============================

export const calculateMaintenanceCalories = (
    user: any
): number => {
    const { weight, height, age, gender } = user;
    let bmr;

    if (gender === "male") {
        bmr = 10 * weight + 6.25 * height - 5 * age + 5;
    } else {
        bmr = 10 * weight + 6.25 * height - 5 * age - 161;
    }

    // sedentary activity multiplier
    return Math.round(bmr * 1.2);
};

// ===============================
// AUDIO HELPERS (Mock)
// ===============================

export const decode = (audioBuffer: string | ArrayBuffer): ArrayBuffer => {
    return new ArrayBuffer(0);
};

export const decodeAudioData = async (
    audioBuffer: ArrayBuffer,
    audioContext?: any,
    sampleRate?: any,
    channels?: any
): Promise<any> => {
    return {
        duration: 0,
        length: 0,
        numberOfChannels: channels || 1,
        sampleRate: sampleRate || 24000,
        getChannelData: () => new Float32Array(0)
    };
};

export const createBlob = (data: BlobPart, type = "audio/wav"): Blob => {
    return new Blob([data], { type });
};