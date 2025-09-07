import React from 'react';
import UserProfile from '../components/UserProfile';

const Profile = () => {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Mi Perfil</h1>
        <p className="text-gray-600 mt-2">
          Gestiona tu información personal y configuraciones de cuenta.
        </p>
      </div>
      
      <UserProfile />
    </div>
  );
};

export default Profile;