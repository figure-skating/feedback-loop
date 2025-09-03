export default function StatusBar() {
  return (
    <div className="h-14 bg-gradient-to-b from-gray-800 to-gray-900 flex items-center justify-center border-b border-gray-700">
      <div className="flex items-center gap-3">
        <img
          src={`${import.meta.env.BASE_URL}Logo1.png`}
          alt="Feedback Loop Logo"
          className="h-10 w-10 object-contain rounded-full"
        />
        <div className="flex items-baseline gap-1">
          <span className="text-ice-blue-600 font-bold text-base tracking-wide">
            FEEDBACK
          </span>
          <span className="text-ice-blue-200 font-bold text-base tracking-wide">
            LOOP
          </span>
        </div>
      </div>
    </div>
  );
}
