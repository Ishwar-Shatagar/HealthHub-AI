import { GoogleGenAI, Type } from '@google/genai';
import { DrugAnalysisResult, DrugOrganEffect } from '../types';

// Mock Gemini Service for demonstration purposes

// ================= EXISTING =================

export const analyzeSkinCondition = async (image: string): Promise<any> => {
    console.log("Mock: Analyzing skin condition...");
    await new Promise(res => setTimeout(res, 2000));
    return {
        condition: "Healthy Skin (Eczema not detected)",
        confidence: 95,
        recommendation: "Maintain moisturizing routine. Consult a dermatologist if redness persists."
    };
};

export const analyzeMedicalImage = async (image: string, type: string): Promise<any> => {
    console.log(`Mock: Analyzing ${type} image...`);
    await new Promise(res => setTimeout(res, 3000));
    return {
        findings: "No significant abnormalities detected.",
        confidence: 98,
        nextSteps: "No urgent actions required."
    };
};

export const generateHealthReport = async (data: any): Promise<string> => {
    return "This is a mock health report based on the provided data. Please consult a doctor for official medical advice.";
};


// ================= MISSING FUNCTIONS (ADDED FIX) =================

// Dashboard Chat
export const getDashboardChatConfig = (user: any, dailyLog: any, language: any) => {
    const consumedCalories = dailyLog?.loggedFoods?.filter((f: any) => f.source === 'counter').reduce((sum: number, food: any) => sum + food.calories, 0) || 0;
    const systemInstruction = `You are an AI Health Assistant integrated into a comprehensive health & wellness application. 
Your primary role is to assist the user (${user?.name || 'the user'}) with their health, fitness, diet plan, and medical questions.
HOWEVER, you are also a highly capable general-purpose AI and you MUST eagerly answer ANY question the user asks you, regardless of whether it relates to health or not (e.g., coding, history, science, general advice, etc.).
Always be friendly, helpful, concise, and format your output clearly.
The user's preferred language is ${language}. You MUST respond in ${language}.
User Context:
- Age: ${user?.age || 'N/A'}, Weight: ${user?.weight ? user.weight + 'kg' : 'N/A'}, BMI: ${user?.bmi || 'N/A'}
- Today's Calories Consumed: ${consumedCalories} kcal
- Calories Burned: ${dailyLog?.caloriesOut || 0} kcal`;

    return { systemInstruction, initialHistory: [] };
};

// Report Chat
export const getReportChatConfig = (reportAnalysis: any, user: any, language: any) => {
    const systemInstruction = `You are an AI Medical Report Assistant.
Your primary role is to help ${user?.name || 'the user'} understand their medical reports and tests.
HOWEVER, you are also a highly capable general intelligence and you MUST answer ANY question the user asks, whether it is related to the medical report or virtually any other topic (e.g., programming, cooking, trivia, etc.).
The user is speaking in ${language}. You MUST respond in ${language}.
Report Context:
${reportAnalysis?.reportSummary || 'No report summary provided.'}`;

    return { systemInstruction, initialHistory: [] };
};

// Live Chat Initialization
export const initializeLiveChat = async (callbacks: any, systemInstruction: any) => {
    console.log("Mock: Live chat initialized");
    if (callbacks.onopen) callbacks.onopen();
    return {
        sendRealtimeInput: (data: any) => { },
        close: () => { }
    };
};

// Food Recognition
export const identifyFoodInImage = async (image: string, fileType: string, additionalInfo: string) => {
    return [{ name: "Apple", weight: 150, cookingMethod: "Raw" }];
};

// Nutrition Info
export const getNutritionalInfoAndAccuracy = async (identifiedFoods: any[], image: string, fileType: string) => {
    return {
        foodItems: [{
            name: identifiedFoods[0]?.name || "Apple",
            calories: 95,
            protein: 0.5,
            carbs: 25,
            fat: 0.3,
            fiber: 4,
            source: 'AI' as const
        }],
        accuracy: 90
    };
};

// Daily Health Tip
export const generateHealthTip = async () => {
    return "Drink at least 8 glasses of water daily.";
};

// Diet Plan
export const generateDietPlan = async (goal: string) => {
    return `Mock diet plan generated for goal: ${goal}`;
};

// Drug Impact Analysis
export const analyzeDrugImpact = async (
    drug: string,
    dosage?: string,
    age?: number | string,
    route?: string,
    weight?: number | string,
    genomicProfile?: string
): Promise<DrugAnalysisResult> => {
    // 1. Try Live Gemini API with Key Pooling
    const apiKeys = [
        import.meta.env.VITE_GEMINI_KEY_1,
        import.meta.env.VITE_GEMINI_KEY_2,
        import.meta.env.VITE_GEMINI_KEY_3,
        import.meta.env.VITE_GEMINI_KEY_4,
        import.meta.env.VITE_GEMINI_KEY_5,
        import.meta.env.VITE_GEMINI_KEY_6,
        import.meta.env.VITE_GEMINI_KEY_7,
        import.meta.env.VITE_GEMINI_KEY_8,
        import.meta.env.VITE_GEMINI_KEY_9,
        import.meta.env.VITE_GEMINI_API_KEY // Legacy fallback
    ].filter(key => key && key.trim() !== '');

    if (apiKeys.length > 0) {
        // Randomly select a key to load-balance
        const apiKey = apiKeys[Math.floor(Math.random() * apiKeys.length)];

        try {
            console.log(`Analyzing ${drug} with live Gemini API (Using 1 of ${apiKeys.length} available keys)...`);
            const ai = new GoogleGenAI({ apiKey });
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: `You are an advanced pharmacology simulation engine generating drug impact visualization data for a 3D human model.

The 3D model supports two layers:
1) ORGAN_VIEW @[public/Human.obj]
2) SKELETON_VIEW @[skeleton.obj]

Return structured JSON that maps drug effects to:
- Organs (for organ view)
- Bones (for skeleton view if musculoskeletal or calcium/metabolic effects exist)

Use ONLY these standardized names:

Organs:
Brain, Heart, Liver, Kidneys, Lungs, Stomach, Intestines, Pancreas, Blood Vessels, Muscles, Skin

Bones:
Skull, Spine, Ribs, Pelvis, Femur, Humerus

----------------------------------------
REQUIRED OUTPUT STRUCTURE:
----------------------------------------

Include:

1) pharmacokinetics
   - onset_minutes
   - peak_minutes
   - duration_hours
   - bioavailability_estimate (0–1)

2) pharmacodynamics
   - primary_mechanism
   - receptor_targets (if applicable)
   - enzyme_inhibition_percent (0–100)

3) heatmap_effects (array)
   Each entry must include:
   - layer: "ORGAN_VIEW" or "SKELETON_VIEW"
   - structure_name
   - effect_type
   - mechanism
   - intensity (0.0–1.0)
   - risk_level (low/moderate/high/severe)
   - confidence_score (0.0–1.0)
   - toxic_threshold (true/false)
   - accumulation_factor (0.0–1.0)
   - dose_dependency_factor (0.0–1.0)

4) time_based_intensity (for animation)
   Provide intensity timeline:
   - 0 min
   - onset
   - peak
   - mid duration
   - end duration

5) system_wide_risk_score (0.0–1.0)

6) interaction_risk_flag (true/false)

7) genomic_warnings (array of strings) - ONLY if the genomic profile causes toxicity or altered metabolism.

----------------------------------------
ADVANCED LOGIC RULES:
----------------------------------------

- If drug affects calcium metabolism → include Spine, Pelvis, Femur.
- If QT prolongation risk → increase Heart intensity.
- If hepatotoxic pattern detected → increase Liver accumulation_factor.
- If lipophilic compound → increase Brain and Liver accumulation.
- If renal clearance drug → increase Kidneys intensity.
- If inflammation reduction → include Muscles or Blood Vessels.

----------------------------------------
HEATMAP RULE:
----------------------------------------

Intensity scale:
0.0–0.3 → Low (Cool Color)
0.3–0.6 → Moderate (Warm Yellow/Orange)
0.6–1.0 → High/Severe (Red)

----------------------------------------
Patient Context (Apply to your analysis if provided):
- Drug Name: \${drug}
- Dosage: \${dosage || 'Standard'}
- Route of Administration: \${route || 'Oral'}
- Age: \${age || 'Adult'}
- Weight: \${weight ? weight + ' kg' : 'Standard'}

Return valid JSON only.
No explanations.
No extra text.`,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            drug_name: { type: Type.STRING },
                            category: { type: Type.STRING },
                            pharmacokinetics: {
                                type: Type.OBJECT,
                                properties: {
                                    onset_minutes: { type: Type.NUMBER },
                                    peak_minutes: { type: Type.NUMBER },
                                    duration_hours: { type: Type.NUMBER },
                                    bioavailability_estimate: { type: Type.NUMBER }
                                }
                            },
                            pharmacodynamics: {
                                type: Type.OBJECT,
                                properties: {
                                    primary_mechanism: { type: Type.STRING },
                                    receptor_targets: { type: Type.ARRAY, items: { type: Type.STRING } },
                                    enzyme_inhibition_percent: { type: Type.NUMBER }
                                }
                            },
                            heatmap_effects: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        layer: { type: Type.STRING, enum: ["ORGAN_VIEW", "SKELETON_VIEW"] },
                                        structure_name: { type: Type.STRING },
                                        effect_type: { type: Type.STRING },
                                        mechanism: { type: Type.STRING },
                                        intensity: { type: Type.NUMBER },
                                        risk_level: { type: Type.STRING, enum: ["low", "moderate", "high", "severe"] },
                                        confidence_score: { type: Type.NUMBER },
                                        toxic_threshold: { type: Type.BOOLEAN },
                                        accumulation_factor: { type: Type.NUMBER },
                                        dose_dependency_factor: { type: Type.NUMBER }
                                    },
                                    required: ["layer", "structure_name", "effect_type", "mechanism", "intensity", "risk_level", "confidence_score", "toxic_threshold", "accumulation_factor", "dose_dependency_factor"]
                                }
                            },
                            time_based_intensity: {
                                type: Type.OBJECT,
                                properties: {
                                    "0 min": { type: Type.NUMBER },
                                    "onset": { type: Type.NUMBER },
                                    "peak": { type: Type.NUMBER },
                                    "mid duration": { type: Type.NUMBER },
                                    "end duration": { type: Type.NUMBER }
                                }
                            },
                            system_wide_risk_score: { type: Type.NUMBER },
                            interaction_risk_flag: { type: Type.BOOLEAN },
                            genomic_warnings: { type: Type.ARRAY, items: { type: Type.STRING } }
                        },
                        required: ["heatmap_effects", "pharmacokinetics", "pharmacodynamics", "time_based_intensity", "system_wide_risk_score", "interaction_risk_flag"]
                    }
                }
            });

            if (response.text) {
                const parsed = JSON.parse(response.text) as DrugAnalysisResult;
                return parsed;
            }
        } catch (err) {
            console.error("Gemini API call failed, falling back to mock data.", err);
        }
    }

    // 2. Fallback to rich mock data if no API key or API fails
    console.log(`Mock: Generating rich offline data for ${drug}...`);
    await new Promise(res => setTimeout(res, 2500)); // Simulate network latency

    return {
        drug_name: drug.charAt(0).toUpperCase() + drug.slice(1),
        category: "Simulated Substance",
        risk_level: "moderate",
        dose_dependency_factor: 0.6,
        mechanism: `Demonstration of ${drug} mechanism. Acts on central nervous system and metabolic pathways.`,
        short_term_effects: ["Increased alertness", "Elevated heart rate"],
        long_term_effects: ["Tolerance build-up", "Sleep disruption"],
        side_effects: ["Jitters", "Dehydration", "Mild headaches"],
        contraindications: ["Severe anxiety", "Cardiac arrhythmias"],
        detailed_explanation: "This is a rich mock response because no Gemini API key was provided.",
        effects: [
            { organ: 'Brain', system: 'Central Nervous System', predicted_effect: 'CNS Stimulation', mechanism_hypothesis: 'Adenosine receptor antagonism', intensity: 0.85, type: 'stimulation', onset: 30, duration: 4, confidence_score: 0.95 },
            { organ: 'Heart', system: 'Cardiovascular System', predicted_effect: 'Tachycardia', mechanism_hypothesis: 'Increased sympathetic tone via CNS activation', intensity: 0.60, type: 'side-effect', onset: 30, confidence_score: 0.80 },
            { organ: 'Kidney', system: 'Renal System', predicted_effect: 'Diuretic effect', mechanism_hypothesis: 'Adenosine receptor inhibition in renal vasculature', intensity: 0.40, type: 'side-effect', confidence_score: 0.70 },
            { organ: 'Stomach', system: 'Gastrointestinal System', predicted_effect: 'Increased acid production', mechanism_hypothesis: 'Stimulation of gastric parietal cells', intensity: 0.35, type: 'toxicity', confidence_score: 0.65 }
        ],
        time_based_intensity: {
            "0 min": 0,
            "onset": 0.4,
            "peak": 1.0,
            "mid duration": 0.6,
            "end duration": 0.1
        },
        genomic_warnings: genomicProfile && genomicProfile !== 'None' ? [`Patient has ${genomicProfile} profile which alters clearance rate.`] : []
    } as any;
};

// Chemical Structure / Image Analysis
export const analyzeDrugSynthesis = async (
    fileBase64: string,
    dosage?: string,
    age?: number | string,
    route?: string,
    weight?: number | string
): Promise<DrugAnalysisResult> => {
    const apiKeys = [
        import.meta.env.VITE_GEMINI_KEY_1,
        import.meta.env.VITE_GEMINI_KEY_2,
        import.meta.env.VITE_GEMINI_KEY_3,
        import.meta.env.VITE_GEMINI_KEY_4,
        import.meta.env.VITE_GEMINI_KEY_5,
        import.meta.env.VITE_GEMINI_KEY_6,
        import.meta.env.VITE_GEMINI_KEY_7,
        import.meta.env.VITE_GEMINI_KEY_8,
        import.meta.env.VITE_GEMINI_KEY_9,
        import.meta.env.VITE_GEMINI_API_KEY
    ].filter(key => key && key.trim() !== '');

    if (apiKeys.length > 0) {
        const apiKey = apiKeys[Math.floor(Math.random() * apiKeys.length)];

        try {
            console.log(`Analyzing drug synthesis image with live Gemini API...`);
            const ai = new GoogleGenAI({ apiKey });

            // Extract the base64 data and mime type from the data URL
            const matches = fileBase64.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
            if (!matches || matches.length !== 3) {
                throw new Error("Invalid base64 image string");
            }
            const mimeType = matches[1];
            const data = matches[2];

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [
                    {
                        role: 'user',
                        parts: [
                            {
                                text: `You are an advanced pharmacology and cheminformatics AI engine.
Your task is to analyze the provided chemical synthesis diagram or molecular structure image, and output a structured JSON describing its biological impact:
1. Infer the likely pharmacological class and identity if possible.
2. Target organs/body systems affected
3. Type of effect (therapeutic, stimulation, suppression, toxicity, side-effect)
4. Mechanism of action
5. Intensity score (0.0-1.0)
6. Risk level (low, moderate, high, severe)
7. Onset time (minutes)
8. Duration (hours)
9. Dose dependency factor (0.0-1.0 scaling sensitivity)

The "effects" array should contain objects mapping to these exact organ meshes: Brain, Heart, Liver, Kidney, Lungs, Stomach, Nervous System, Muscles, Skin, Intestines.
For each organ, provide:
- "organ": The exact mesh name from the list above.
- "system": The body system (e.g. "Cardiovascular", "Nervous").
- "predicted_effect": A short label describing what happens (e.g. "Increased heart rate").
- "mechanism_hypothesis": The suspected mechanism of action on this organ.
- "intensity": A float from 0.0 to 1.0 (where 1.0 is severe/maximum impact).
- "type": Strictly one of: "therapeutic", "stimulation", "suppression", "toxicity", "side-effect", "relief".
- "risk_level": Strictly "low", "moderate", "high", or "severe".
- "confidence_score": Float 0.0-1.0 estimating confidence.
- "onset": Onset time in numeric minutes (e.g., 30)
- "duration": Duration in numeric hours (e.g., 4)

Output MUST be valid JSON.
Do not include explanations outside JSON.
Intensity must reflect clinical relevance and pharmacological impact.
If organ not significantly affected, do not include it.
Be medically realistic and evidence-based. If uncertainty is high, lower confidence_score accordingly. Do not fabricate known drug identity unless highly certain.

Patient Context (Apply to your analysis if provided):
- Dosage: ${dosage || 'Standard'}
- Route of Administration: ${route || 'Oral'}
- Age: ${age || 'Adult'}
- Weight: ${weight ? weight + ' kg' : 'Standard'}
`
                            },
                            {
                                inlineData: {
                                    mimeType,
                                    data
                                }
                            }
                        ]
                    }
                ],
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            drug_name: { type: Type.STRING },
                            category: { type: Type.STRING },
                            mechanism: { type: Type.STRING },
                            risk_level: { type: Type.STRING, enum: ["low", "moderate", "high", "severe"] },
                            dose_dependency_factor: { type: Type.NUMBER },
                            short_term_effects: { type: Type.ARRAY, items: { type: Type.STRING } },
                            long_term_effects: { type: Type.ARRAY, items: { type: Type.STRING } },
                            side_effects: { type: Type.ARRAY, items: { type: Type.STRING } },
                            contraindications: { type: Type.ARRAY, items: { type: Type.STRING } },
                            detailed_explanation: { type: Type.STRING },
                            effects: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        organ: { type: Type.STRING },
                                        system: { type: Type.STRING },
                                        predicted_effect: { type: Type.STRING },
                                        mechanism_hypothesis: { type: Type.STRING },
                                        intensity: { type: Type.NUMBER },
                                        type: { type: Type.STRING },
                                        onset: { type: Type.NUMBER },
                                        duration: { type: Type.NUMBER },
                                        confidence_score: { type: Type.NUMBER }
                                    },
                                    required: ["organ", "system", "predicted_effect", "mechanism_hypothesis", "intensity", "type", "confidence_score"]
                                }
                            }
                        },
                        required: ["drug_name", "category", "risk_level", "effects", "side_effects", "contraindications", "mechanism"]
                    }
                }
            });

            if (response.text) {
                const parsed = JSON.parse(response.text) as DrugAnalysisResult;
                return parsed;
            }
        } catch (err) {
            console.error("Gemini Vision API call failed, falling back to mock image data.", err);
        }
    }

    // Mock Fallback
    console.log(`Mock: Generating offline mock data for synthetic image upload...`);
    await new Promise(res => setTimeout(res, 3500));

    return {
        drug_name: "Unknown Synthetic Benzodiazepine",
        category: "Sedative/Hypnotic (Inferred)",
        risk_level: "high",
        dose_dependency_factor: 0.85,
        mechanism: "Inferred from structure: Positive allosteric modulator of GABA-A receptors.",
        short_term_effects: ["Profound sedation", "Muscle relaxation", "Anterograde amnesia"],
        long_term_effects: ["Physical dependence", "Cognitive impairment"],
        side_effects: ["Drowsiness", "Ataxia", "Respiratory depression (at high doses)"],
        contraindications: ["Concurrent opioid use", "Myasthenia gravis", "Sleep apnea"],
        detailed_explanation: "This analysis was generated via offline fallback because the Gemini API key was missing or failed.",
        effects: [
            { organ: 'Brain', system: 'Central Nervous System', predicted_effect: 'Global Suppression', mechanism_hypothesis: 'Enhanced GABAergic inhibitory neurotransmission', intensity: 0.9, type: 'suppression', onset: 15, duration: 8, confidence_score: 0.8 },
            { organ: 'Muscles', system: 'Musculoskeletal System', predicted_effect: 'Hypotonia', mechanism_hypothesis: 'Spinal cord polysynaptic reflex inhibition', intensity: 0.7, type: 'relief', onset: 20, confidence_score: 0.85 },
            { organ: 'Lungs', system: 'Respiratory System', predicted_effect: 'Mild Respiratory Depression', mechanism_hypothesis: 'Decreased medullary respiratory center sensitivity', intensity: 0.4, type: 'side-effect', confidence_score: 0.6 }
        ]
    } as any;
};

// Exercise Routine
export const generateExerciseRoutine = async (goal: string) => {
    return `Mock exercise routine for ${goal}`;
};

// Single Exercise Info
export const generateSingleExerciseInfo = async (exercise: string) => {
    return {
        name: exercise,
        steps: "Perform slowly with correct posture.",
        benefits: "Improves strength and endurance."
    };
};

// Nearby Health Services
export const findNearbyHealthServices = async (location: string) => {
    return [
        { name: "City Hospital", distance: "2 km" },
        { name: "Care Clinic", distance: "3.5 km" }
    ];
};

// Analyze Medical Report
export const analyzeMedicalReport = async (user: any, dietaryPreference: any, base64Data: any, fileType: any, selectedLanguage: any): Promise<any> => {
    return {
        reportSummary: "Report appears within normal range.",
        patientInfo: {
            name: user?.name || "Patient",
            age: user?.age || 30,
            gender: user?.gender || "Other",
            reportDate: new Date().toLocaleDateString()
        },
        actionPlan: ["Maintain regular checkups"],
        treatmentRecommendations: ["None prescribed"],
        problemExplanation: "No significant anomalies.",
        keyRecommendations: ["Stay hydrated"],
        mealPlan: { breakfast: [], lunch: [], snacks: [], dinner: [] },
        reasoning: "Based on normal values.",
        healthRecommendations: ["Keep up the good work"],
        foodsToInclude: ["Fresh fruits", "Vegetables"],
        foodsToAvoid: ["Processed foods"],
        precautions: ["None"],
        exerciseRoutine: [],
        lifestyleModifications: ["Maintain active lifestyle"]
    };
};

// Analyze ECG/Heart Report
export const analyzeECGReport = async (filesBase64: string[]): Promise<any> => {
    const apiKeys = [
        import.meta.env.VITE_GEMINI_KEY_1,
        import.meta.env.VITE_GEMINI_KEY_2,
        import.meta.env.VITE_GEMINI_KEY_3,
        import.meta.env.VITE_GEMINI_KEY_4,
        import.meta.env.VITE_GEMINI_KEY_5,
        import.meta.env.VITE_GEMINI_KEY_6,
        import.meta.env.VITE_GEMINI_KEY_7,
        import.meta.env.VITE_GEMINI_KEY_8,
        import.meta.env.VITE_GEMINI_KEY_9,
        import.meta.env.VITE_GEMINI_API_KEY
    ].filter(key => key && key.trim() !== '');

    if (apiKeys.length > 0 && filesBase64.length > 0) {
        const apiKey = apiKeys[Math.floor(Math.random() * apiKeys.length)];

        try {
            console.log(`Analyzing ECG with live Gemini API...`);
            const ai = new GoogleGenAI({ apiKey });

            // Just analyze the first file for simplicity in this integration
            const fileBase64 = filesBase64[0];
            const matches = fileBase64.match(/^data:(image\/[a-zA-Z+]+|application\/pdf);base64,(.+)$/);

            if (matches && matches.length === 3) {
                const mimeType = matches[1];
                const data = matches[2];

                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: [
                        {
                            role: 'user',
                            parts: [
                                {
                                    text: `You are an expert cardiologist AI. Analyze this ECG/Heart report image or document.
Output MUST be valid JSON matching this structure exactly:
{
    "summary": "String detailing the overall findings",
    "abnormalities": [{"condition": "Name of issue", "severity": "low|moderate|high"}],
    "heart_score": Number (0-100, 100 being perfect health),
    "causes": {
        "lifestyle": ["Array of strings"],
        "medical": ["Array of strings"],
        "genetic": ["Array of strings"]
    },
    "recommendations": {
        "diet": ["Array of strings"],
        "exercise": ["Array of strings"],
        "lifestyle": ["Array of strings"],
        "consult": "String advising when to see a doctor"
    }
}
If no abnormalities, return an empty array for abnormalities. Output ONLY JSON, with no markdown formatting or extra text.`
                                },
                                {
                                    inlineData: { mimeType, data }
                                }
                            ]
                        }
                    ],
                    config: {
                        responseMimeType: "application/json",
                    }
                });

                if (response.text) {
                    return JSON.parse(response.text);
                }
            }
        } catch (err) {
            console.error("Gemini Vision API failed for ECG, falling back to mock", err);
        }
    }

    // Mock Fallback Data
    console.log("Mock: Generating offline mock data for ECG upload...");
    await new Promise(res => setTimeout(res, 2500));

    return {
        summary: "Sinus rhythm with mild ST-segment depression. This pattern may indicate early signs of myocardial ischemia, particularly if correlated with clinical symptoms like chest pain or shortness of breath. No acute arrhythmias detected.",
        abnormalities: [
            { condition: "Mild ST-Segment Depression", severity: "moderate" },
            { condition: "Premature Ventricular Contractions (Occasional)", severity: "low" }
        ],
        heart_score: 72,
        causes: {
            lifestyle: ["High stress levels", "Inadequate sleep", "Sedentary routine"],
            medical: ["Possible early ischemia", "Mild hypertension"],
            genetic: ["Family history of CAD (if applicable)"]
        },
        recommendations: {
            diet: ["Adopt a Mediterranean diet", "Reduce sodium intake", "Minimize trans fats"],
            exercise: ["Start with light aerobic walking", "Avoid heavy lifting until cleared by a doctor"],
            lifestyle: ["Practice stress management (Yoga/Meditation)", "Ensure 7-8 hours of sleep"],
            consult: "Schedule a follow-up with a cardiologist within the next 2 weeks for a stress test or further evaluation."
        }
    };
};