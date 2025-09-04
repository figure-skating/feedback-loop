import React, { useEffect, useState } from "react";

const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showMessage, setShowMessage] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowMessage(true);
      setTimeout(() => setShowMessage(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowMessage(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (!showMessage) return null;

  return (
    <div
      className={`fixed top-20 left-1/2 transform -translate-x-1/2 z-50 px-4 py-2 rounded-lg shadow-lg transition-all duration-300 ${
        isOnline
          ? "bg-green-500 text-white"
          : "bg-yellow-500 text-white"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">
          {isOnline ? "✅ Back online" : "⚠️ Working offline"}
        </span>
      </div>
    </div>
  );
};

export default OfflineIndicator;