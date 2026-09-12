import React from 'react';
import { AnalyticsWorkspace } from './AnalyticsWorkspace';

interface SmartAnalyticsViewProps {
  onShowNotification?: (msg: string, title?: string) => void;
}

/** Sole Analytics entry — Dashboard → Top Navbar → Analytics */
export const SmartAnalyticsView: React.FC<SmartAnalyticsViewProps> = ({ onShowNotification }) => {
  return <AnalyticsWorkspace onShowNotification={onShowNotification} />;
};

export default SmartAnalyticsView;
