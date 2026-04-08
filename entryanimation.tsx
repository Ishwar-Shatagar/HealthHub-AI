import React, { useEffect, useState } from "react";
import doctorImg from "../assets/doctor.png";
import "./entryanimation.css";

const EntryAnimation: React.FC = () => {
    const [openDoor, setOpenDoor] = useState(false);
    const [showRobot, setShowRobot] = useState(false);
    const [showDoctor, setShowDoctor] = useState(false);

    useEffect(() => {
        const doorTimer = setTimeout(() => setOpenDoor(true), 800);
        const robotTimer = setTimeout(() => setShowRobot(true), 1500);
        const doctorTimer = setTimeout(() => setShowDoctor(true), 2800);

        return () => {
            clearTimeout(doorTimer);
            clearTimeout(robotTimer);
            clearTimeout(doctorTimer);
        };
    }, []);

    return (
        <div className="flex items-center justify-center h-screen bg-gradient-to-br from-blue-100 to-blue-300">

            <div className="relative w-72 h-[420px] perspective">

                {/* DOOR FRAME */}
                <div className="relative w-full h-full rounded-3xl bg-gradient-to-b from-blue-200 to-blue-400 shadow-2xl overflow-hidden">

                    {/* DOOR PANEL */}
                    <div
                        className={`absolute inset-0 bg-white rounded-3xl shadow-xl door ${openDoor ? "door-open" : ""
                            }`}
                    />

                    {/* ROBOT */}
                    {showRobot && !showDoctor && (
                        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 transition-all duration-700 animate-fade-in">
                            <div className="relative w-24 h-24 bg-gradient-to-br from-purple-600 to-pink-500 rounded-2xl shadow-lg flex items-center justify-center">
                                <div className="absolute top-6 w-12 h-12 bg-purple-300 rounded-xl flex justify-around items-center">
                                    <div className="w-3 h-3 bg-white rounded-full" />
                                    <div className="w-3 h-3 bg-white rounded-full" />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* DOCTOR IMAGE */}
                    {showDoctor && (
                        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 animate-doctor-rise">
                            <img
                                src={doctorImg}
                                alt="Doctor"
                                className="w-56 drop-shadow-2xl"
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default EntryAnimation;