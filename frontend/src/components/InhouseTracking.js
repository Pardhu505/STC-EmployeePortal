import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Youtube, Facebook, Instagram, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { FacebookTracking } from '@/socialmedia/facebook';
import { YoutubeTracking } from '@/socialmedia/youtube';
import { InstagramTracking } from '@/socialmedia/instagram';

const InhouseTracking = () => {
  const [activePlatform, setActivePlatform] = useState('youtube');
  const navigate = useNavigate();

  const renderContent = () => {
    switch (activePlatform) {
      
      case 'facebook':
        return <FacebookTracking />;
        case 'youtube':
        return <YoutubeTracking />;
      case 'instagram':
        return <InstagramTracking />;
      default:
        return <p>Please select a platform from the sidebar.</p>;
    }
  };

  return (
    <div className="space-y-4">
        
      <Button onClick={() => navigate('/dashboard', { state: { section: 'projects' } })} variant="outline" className="mt-3 ml-4 bg-gradient-to-r from-[#225F8B] to-[#225F8B]/80 text-white">
        <ArrowLeft className="mr-2 h-4 w-4 " /> Back to Dashboard
      </Button>
     
      <div className="flex h-full min-h-[calc(100vh-250px)] bg-white/80 backdrop-blur-sm rounded-xl border-0 shadow-lg overflow-hidden">
        {/* Sidebar */}
        <div className="w-24 bg-slate-50 p-4 flex flex-col items-center space-y-6 border-r border-slate-200">
          <h3 className="font-bold text-sm text-slate-700 mt-2">Platforms</h3>
          <div className="flex flex-col space-y-4">

            <Button variant={activePlatform === 'facebook' ? 'secondary' : 'ghost'} size="icon" onClick={() => setActivePlatform('facebook')} className={`w-14 h-14 rounded-xl transition-all duration-200 ${activePlatform === 'facebook' ? 'bg-blue-100 text-blue-600' : 'text-slate-500'}`}>
              <Facebook className="w-7 h-7" />
            </Button>
           
            <Button variant={activePlatform === 'instagram' ? 'secondary' : 'ghost'} size="icon" onClick={() => setActivePlatform('instagram')} className={`w-14 h-14 rounded-xl transition-all duration-200 ${activePlatform === 'instagram' ? 'bg-pink-100 text-pink-600' : 'text-slate-500'}`}>
              <Instagram className="w-7 h-7" />
            </Button>
             <Button variant={activePlatform === 'youtube' ? 'secondary' : 'ghost'} size="icon" onClick={() => setActivePlatform('youtube')} className={`w-14 h-14 rounded-xl transition-all duration-200 ${activePlatform === 'youtube' ? 'bg-red-100 text-red-600' : 'text-slate-500'}`}>
              <Youtube className="w-7 h-7" />
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-6">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default InhouseTracking;