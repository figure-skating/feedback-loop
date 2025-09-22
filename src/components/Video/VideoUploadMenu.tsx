interface VideoUploadMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSample: () => void;
  onSelectFile: () => void;
  onRecord?: () => void;
}

export default function VideoUploadMenu({ 
  isOpen, 
  onClose, 
  onSelectSample, 
  onSelectFile,
  onRecord 
}: VideoUploadMenuProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center z-50 p-4">
      <div className="relative w-full max-w-sm">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute -top-12 right-0 w-8 h-8 bg-white bg-opacity-10 rounded-full flex items-center justify-center text-white hover:bg-opacity-20 transition-colors"
        >
          ✕
        </button>

        {/* Content */}
        <div className="bg-gray-900 rounded-2xl p-6">
          <h2 className="text-white text-lg font-semibold mb-5 text-center">
            Select Video Source
          </h2>

          <div className="space-y-3">
            {/* Sample Video Option */}
            <button
              onClick={() => {
                onSelectSample();
                onClose();
              }}
              className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-ice-blue-500 rounded-xl p-4 text-left transition-all group"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-white font-medium group-hover:text-ice-blue-400 transition-colors">
                      Try Sample Video
                    </h3>
                    <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded-full">
                      RECOMMENDED
                    </span>
                  </div>
                  <p className="text-gray-400 text-sm mt-1">
                    Pre-analyzed jump with markers set
                  </p>
                </div>
                <span className="text-2xl">🎬</span>
              </div>
            </button>

            {/* Choose from Library */}
            <button
              onClick={() => {
                onSelectFile();
                onClose();
              }}
              className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-ice-blue-500 rounded-xl p-4 text-left transition-all group"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-white font-medium group-hover:text-ice-blue-400 transition-colors">
                    Choose from Library
                  </h3>
                  <p className="text-gray-400 text-sm mt-1">
                    Select from your device
                  </p>
                </div>
                <span className="text-2xl">📁</span>
              </div>
            </button>

            {/* Record New Video (optional) */}
            {onRecord && (
              <button
                onClick={() => {
                  onRecord();
                  onClose();
                }}
                className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-ice-blue-500 rounded-xl p-4 text-left transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-white font-medium group-hover:text-ice-blue-400 transition-colors">
                      Record New Video
                    </h3>
                    <p className="text-gray-400 text-sm mt-1">
                      Capture a jump now
                    </p>
                  </div>
                  <span className="text-2xl">📹</span>
                </div>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}