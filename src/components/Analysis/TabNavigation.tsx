interface TabNavigationProps {
  activeTab: 'overview' | 'details';
  onTabChange: (tab: 'overview' | 'details') => void;
  visible: boolean;
}

export default function TabNavigation({ activeTab, onTabChange, visible }: TabNavigationProps) {
  if (!visible) return null;

  return (
    <div className="flex gap-2 px-4 pb-3">
      <button
        onClick={() => onTabChange('overview')}
        className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all duration-200 ${
          activeTab === 'overview'
            ? 'bg-gradient-to-br from-blue-700 to-blue-900 text-white border border-transparent'
            : 'bg-white bg-opacity-5 text-gray-400 border border-white border-opacity-10 hover:bg-opacity-10'
        }`}
      >
        Overview
      </button>
      <button
        onClick={() => onTabChange('details')}
        className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all duration-200 ${
          activeTab === 'details'
            ? 'bg-gradient-to-br from-blue-700 to-blue-900 text-white border border-transparent'
            : 'bg-white bg-opacity-5 text-gray-400 border border-white border-opacity-10 hover:bg-opacity-10'
        }`}
      >
        Details
      </button>
    </div>
  );
}