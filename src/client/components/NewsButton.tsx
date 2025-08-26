import React, { useState } from 'react';
import Button from './Button';

interface NewsButtonProps {
  className?: string;
  hidden?: boolean;
}

const NewsButton: React.FC<NewsButtonProps> = ({ 
  className = '', 
  hidden = false 
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleClick = () => {
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  if (hidden) {
    return null;
  }

  return (
    <>
      <div className={className}>
        <Button
          title="News"
          onClick={handleClick}
          secondary
          block
        />
      </div>
      
      {/* News Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 w-96 max-w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Game News</h2>
              <button
                onClick={closeModal}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4">
              <div className="border-b pb-4 dark:border-gray-600">
                <h3 className="font-semibold mb-2">Latest Update</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Welcome to the React version of OpenFront! This is a converted 
                  version of the game interface using React components.
                </p>
                <p className="text-xs text-gray-500 mt-2">2 days ago</p>
              </div>
              <div className="border-b pb-4 dark:border-gray-600">
                <h3 className="font-semibold mb-2">New Features</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  • Improved user interface with React components<br/>
                  • Better performance and maintainability<br/>
                  • Enhanced mobile support
                </p>
                <p className="text-xs text-gray-500 mt-2">1 week ago</p>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <Button
                title="Close"
                onClick={closeModal}
                secondary
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default NewsButton;