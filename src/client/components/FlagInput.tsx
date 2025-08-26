import React, { useState, useEffect } from 'react';

interface FlagInputProps {
  selectedFlag: string;
  onFlagChange: (flag: string) => void;
  className?: string;
}

const FlagInput: React.FC<FlagInputProps> = ({
  selectedFlag,
  onFlagChange,
  className = '',
}) => {
  const [flagOptions] = useState([
    'us', 'gb', 'ca', 'au', 'de', 'fr', 'es', 'it', 'jp', 'cn',
    'br', 'in', 'ru', 'mx', 'nl', 'se', 'no', 'dk', 'fi', 'xx'
  ]);

  useEffect(() => {
    // Load stored flag on mount
    const storedFlag = localStorage.getItem('selectedFlag') ?? 'xx';
    if (!selectedFlag || selectedFlag === 'xx') {
      onFlagChange(storedFlag);
    }
  }, []);

  useEffect(() => {
    // Store flag whenever it changes
    localStorage.setItem('selectedFlag', selectedFlag);
  }, [selectedFlag]);

  const handleFlagClick = () => {
    // For now, just cycle through some common flags
    const currentIndex = flagOptions.indexOf(selectedFlag);
    const nextIndex = (currentIndex + 1) % flagOptions.length;
    onFlagChange(flagOptions[nextIndex]);
  };

  return (
    <div className={className}>
      <button
        id="flag-input_"
        onClick={handleFlagClick}
        className={`w-full border p-[4px] rounded-lg flex cursor-pointer border-black/30 
          dark:border-gray-300/60 bg-white/70 dark:bg-[rgba(55,65,81,0.7)] justify-center`}
        title="Select flag"
      >
        {selectedFlag !== 'xx' ? (
          <img
            src={`/flags/${selectedFlag}.svg`}
            alt={selectedFlag}
            className="w-8 h-6 object-cover rounded"
          />
        ) : (
          <div className="w-8 h-6 bg-gray-300 rounded flex items-center justify-center text-xs">
            ?
          </div>
        )}
      </button>
    </div>
  );
};

export default FlagInput;