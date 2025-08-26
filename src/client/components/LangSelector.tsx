import React, { useState, useEffect } from 'react';
import Button from './Button';

interface Language {
  code: string;
  name: string;
  nativeName: string;
}

interface LangSelectorProps {
  className?: string;
}

const LangSelector: React.FC<LangSelectorProps> = ({ className = '' }) => {
  const [currentLanguage, setCurrentLanguage] = useState('en');
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const languages: Language[] = [
    { code: 'en', name: 'English', nativeName: 'English' },
    { code: 'es', name: 'Spanish', nativeName: 'Español' },
    { code: 'fr', name: 'French', nativeName: 'Français' },
    { code: 'de', name: 'German', nativeName: 'Deutsch' },
    { code: 'it', name: 'Italian', nativeName: 'Italiano' },
    { code: 'pt-BR', name: 'Portuguese (Brazil)', nativeName: 'Português (Brasil)' },
    { code: 'ru', name: 'Russian', nativeName: 'Русский' },
    { code: 'zh-CN', name: 'Chinese (Simplified)', nativeName: '简体中文' },
    { code: 'ja', name: 'Japanese', nativeName: '日本語' },
    { code: 'ko', name: 'Korean', nativeName: '한국어' },
  ];

  useEffect(() => {
    // Load stored language on mount
    const storedLang = localStorage.getItem('selectedLanguage') ?? 'en';
    setCurrentLanguage(storedLang);
  }, []);

  const handleLanguageSelect = (langCode: string) => {
    setCurrentLanguage(langCode);
    localStorage.setItem('selectedLanguage', langCode);
    
    // Dispatch language change event
    const event = new CustomEvent('language-changed', {
      detail: { language: langCode },
    });
    document.dispatchEvent(event);
    
    setIsModalOpen(false);
  };

  const getCurrentLanguageName = () => {
    const lang = languages.find(l => l.code === currentLanguage);
    return lang ? lang.nativeName : 'English';
  };

  return (
    <>
      <div className={className}>
        <Button
          title={`Language: ${getCurrentLanguageName()}`}
          onClick={() => setIsModalOpen(true)}
          block
          secondary
        />
      </div>

      {/* Language Modal */}
      {isModalOpen && (
        <div 
          id="language-modal"
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center"
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 w-96 max-w-full">
            <h2 className="text-xl font-semibold mb-4">Select Language</h2>
            <div 
              id="language-list"
              className="space-y-2 max-h-80 overflow-y-auto"
            >
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => handleLanguageSelect(lang.code)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    currentLanguage === lang.code
                      ? 'bg-blue-100 dark:bg-blue-900/50 border border-blue-500'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700 border border-transparent'
                  }`}
                >
                  <div className="font-medium">{lang.nativeName}</div>
                  {lang.name !== lang.nativeName && (
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {lang.name}
                    </div>
                  )}
                </button>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <Button
                title="Close"
                onClick={() => setIsModalOpen(false)}
                secondary
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default LangSelector;