import React from 'react';

/**
 * Loading Spinner Component
 * Provides consistent loading indicators across the application
 */

const LoadingSpinner = ({
  size = 'md',
  color = 'blue',
  overlay = false,
  message = 'Cargando...',
  className = '',
  centered = false
}) => {
  // Size variants
  const sizeClasses = {
    xs: 'w-4 h-4',
    sm: 'w-6 h-6', 
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16'
  };

  // Color variants
  const colorClasses = {
    blue: 'text-blue-600',
    gray: 'text-gray-600',
    white: 'text-white',
    green: 'text-green-600',
    red: 'text-red-600',
    indigo: 'text-indigo-600'
  };

  // Spinner SVG
  const SpinnerIcon = ({ className: spinnerClassName }) => (
    <svg
      className={`animate-spin ${spinnerClassName}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );

  // Basic spinner (just the icon)
  const BasicSpinner = () => (
    <SpinnerIcon 
      className={`
        ${sizeClasses[size]} 
        ${colorClasses[color]} 
        ${className}
      `} 
    />
  );

  // Spinner with message
  const SpinnerWithMessage = () => (
    <div className={`flex flex-col items-center space-y-3 ${className}`}>
      <SpinnerIcon 
        className={`${sizeClasses[size]} ${colorClasses[color]}`}
      />
      {message && (
        <p className={`text-sm ${colorClasses[color]} animate-pulse`}>
          {message}
        </p>
      )}
    </div>
  );

  // Centered spinner
  const CenteredSpinner = ({ children }) => (
    <div className="flex items-center justify-center min-h-[200px]">
      {children}
    </div>
  );

  // Overlay spinner (covers the entire screen or container)
  const OverlaySpinner = ({ children }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 shadow-xl">
        {children}
      </div>
    </div>
  );

  // Determine what to render
  let spinnerContent = message ? <SpinnerWithMessage /> : <BasicSpinner />;

  // Apply centering if requested
  if (centered && !overlay) {
    spinnerContent = <CenteredSpinner>{spinnerContent}</CenteredSpinner>;
  }

  // Apply overlay if requested
  if (overlay) {
    spinnerContent = <OverlaySpinner>{spinnerContent}</OverlaySpinner>;
  }

  return spinnerContent;
};

// Specialized spinner variants
export const ButtonSpinner = ({ size = 'sm', color = 'white', className = '' }) => (
  <LoadingSpinner 
    size={size} 
    color={color} 
    className={`mr-2 ${className}`}
  />
);

export const PageSpinner = ({ message = 'Cargando página...' }) => (
  <LoadingSpinner
    size="lg"
    color="blue"
    message={message}
    centered
    className="py-12"
  />
);

export const OverlaySpinner = ({ message = 'Procesando...' }) => (
  <LoadingSpinner
    size="lg"
    color="blue"
    message={message}
    overlay
  />
);

export const InlineSpinner = ({ size = 'sm', color = 'blue', className = '' }) => (
  <LoadingSpinner 
    size={size}
    color={color}
    className={`inline-block ${className}`}
  />
);

// Hook for managing loading states
export const useLoading = (initialState = false) => {
  const [isLoading, setIsLoading] = React.useState(initialState);
  const [loadingMessage, setLoadingMessage] = React.useState('');

  const startLoading = React.useCallback((message = '') => {
    setLoadingMessage(message);
    setIsLoading(true);
  }, []);

  const stopLoading = React.useCallback(() => {
    setIsLoading(false);
    setLoadingMessage('');
  }, []);

  const toggleLoading = React.useCallback((message = '') => {
    if (isLoading) {
      stopLoading();
    } else {
      startLoading(message);
    }
  }, [isLoading, startLoading, stopLoading]);

  return {
    isLoading,
    loadingMessage,
    startLoading,
    stopLoading,
    toggleLoading
  };
};

// Higher-order component to add loading state
export const withLoading = (Component, LoadingComponent = PageSpinner) => {
  return function WrappedComponent({ isLoading, ...props }) {
    if (isLoading) {
      return <LoadingComponent />;
    }
    return <Component {...props} />;
  };
};

export default LoadingSpinner;