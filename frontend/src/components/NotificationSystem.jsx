import React, { useEffect } from 'react';
import { useGame } from '../contexts/GameContext';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const NotificationSystem = () => {
  const { notifications } = useGame();

  const getIcon = (type) => {
    switch (type) {
      case 'success': return <CheckCircle className="notification-icon" />;
      case 'error': return <XCircle className="notification-icon" />;
      case 'warning': return <AlertTriangle className="notification-icon" />;
      case 'info': return <Info className="notification-icon" />;
      default: return <Info className="notification-icon" />;
    }
  };

  const handleClose = (notificationId) => {
    // Add removing class for animation
    const element = document.getElementById(`notification-${notificationId}`);
    if (element) {
      element.classList.add('removing');
      setTimeout(() => {
        // This will be handled by the context's auto-removal
      }, 300);
    }
  };

  return (
    <div className="notification-container">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          id={`notification-${notification.id}`}
          className={`notification ${notification.type || 'info'}`}
        >
          <div className="notification-header">
            <div className="flex items-center">
              {getIcon(notification.type)}
              <span className="notification-title">{notification.title}</span>
            </div>
            <button
              onClick={() => handleClose(notification.id)}
              className="notification-close"
              aria-label="Close notification"
            >
              <X size={16} />
            </button>
          </div>
          {notification.message && (
            <div className="notification-message">
              {notification.message}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default NotificationSystem;