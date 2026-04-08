import React, { useEffect, useState } from "react";

const EntryAnimation: React.FC = () => {
  const [openDoor, setOpenDoor] = useState(false);
  const [showRobot, setShowRobot] = useState(false);
  const [showDoctor, setShowDoctor] = useState(false);

  useEffect(() => {
    setTimeout(() => setOpenDoor(true), 800);
    setTimeout(() => setShowRobot(true), 1500);
    setTimeout(() => setShowDoctor(true), 2800);
  }, []);

  return (
    <div className="relative w-80 h-96 flex items-center justify-center">

      {/* DOOR FRAME */}
      <div className="relative w-60 h-80 rounded-3xl bg-gradient-to-b from-blue-200 to-blue-300 shadow-2xl overflow-hidden">

        {/* DOOR PANEL */}
        <div
          className={`absolute inset-0 bg-white rounded-3xl shadow-xl transition-transform duration-1000 origin-left ${
            openDoor ? "-translate-x-full rotate-y-[-70deg]" : ""
          }`}
          style={{
            transformStyle: "preserve-3d"
          }}
        />

        {/* ROBOT */}
        {showRobot && (
          <div
            className={`absolute bottom-10 left-1/2 -translate-x-1/2 transition-all duration-700 ${
              showDoctor ? "opacity-0 translate-y-4" : "opacity-100"
            }`}
          >
            <div className="relative w-24 h-24 bg-gradient-to-br from-purple-600 to-pink-500 rounded-2xl shadow-lg flex items-center justify-center">
              <div className="absolute top-6 w-12 h-12 bg-purple-300 rounded-xl flex justify-around items-center">
                <div className="w-3 h-3 bg-white rounded-full" />
                <div className="w-3 h-3 bg-white rounded-full" />
              </div>
            </div>
          </div>
        )}

        {/* DOCTOR */}
        {showDoctor && (
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 animate-slide-up">
            <div className="w-32 h-48 bg-white rounded-2xl shadow-lg flex flex-col items-center pt-6">
              <div className="w-16 h-16 bg-orange-200 rounded-full mb-2" />
              <div className="w-20 h-6 bg-blue-600 rounded mb-2" />
              <div className="w-24 h-20 bg-gray-100 rounded-lg" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EntryAnimation;