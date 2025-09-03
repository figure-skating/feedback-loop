import { ReactNode } from 'react';

interface AppContainerProps {
  children: ReactNode;
}

export default function AppContainer({ children }: AppContainerProps) {
  return (
    <div className="max-w-iphone ipad:max-w-ipad desktop:max-w-none desktop:w-full mx-auto h-iphone ipad:h-ipad desktop:h-full bg-black text-white overflow-hidden relative desktop:mx-0">
      {/* Responsive frame: visible on mobile/tablet, invisible on desktop */}
      <div className="absolute inset-0 border border-gray-800 rounded-[2.5rem] ipad:rounded-[1.5rem] desktop:border-none desktop:rounded-none shadow-2xl desktop:shadow-none">
        {children}
      </div>
    </div>
  );
}