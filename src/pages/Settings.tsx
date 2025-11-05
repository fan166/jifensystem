import React from 'react';
import { Card } from 'antd';
import { PermissionSettings } from '../components/PermissionSettings';

const Settings: React.FC = () => {
  return (
    <div className="p-6">
      <Card>
        <div className="mt-4">
          <PermissionSettings />
        </div>
      </Card>
    </div>
  );
};

export default Settings;