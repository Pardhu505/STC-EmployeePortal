import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ExternalLink, ArrowRight, ArrowLeft } from 'lucide-react';
import { PORTAL_DATA } from '../data/mock';
import { useAuth } from '../contexts/AuthContext';

const PortalCards = ({ onViewerChange }) => {
  const { user } = useAuth();
  const hasElevatedAccess =
    user?.designation === 'Reporting manager' ||
    user?.department === 'HR' ||
    user?.designation === 'System Admin';

  // The portal currently open inside the in-app viewer (null = show the grid)
  const [activePortal, setActivePortal] = useState(null);

  const notify = (open) => { if (onViewerChange) onViewerChange(open); };
  const openInApp = (portal) => { setActivePortal(portal); notify(true); };
  const closeViewer = () => { setActivePortal(null); notify(false); };
  const openInNewTab = (url) => window.open(url, '_blank', 'noopener,noreferrer');

  // If this component unmounts (user switches tab) while a portal is open,
  // make sure the parent restores the welcome banner.
  useEffect(() => {
    return () => { if (onViewerChange) onViewerChange(false); };
  }, [onViewerChange]);

  const visiblePortals = PORTAL_DATA.filter(portal => {
    if (portal.managerOnly) {
      return hasElevatedAccess;
    }
    return true;
  });

  // ---- In-app viewer (iframe) ----
  if (activePortal) {
    return (
      <div className="flex flex-col" style={{ height: 'calc(100vh - 96px)' }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={closeViewer}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Portals
            </Button>
            <h2 className="text-xl font-bold text-gray-900">{activePortal.title}</h2>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => openInNewTab(activePortal.url)}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Open in new tab
          </Button>
        </div>

        <div className="flex-1 rounded-xl overflow-hidden border border-gray-200 bg-white shadow-sm relative">
          <iframe
            src={activePortal.url}
            title={activePortal.title}
            className="w-full h-full"
            style={{ border: 'none' }}
            allow="clipboard-read; clipboard-write; fullscreen"
          />
        </div>

        <p className="text-xs text-gray-500 mt-2">
          If the portal doesn't load here (some sites block embedding), use
          "Open in new tab" above.
        </p>
      </div>
    );
  }

  // ---- Portal grid ----
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Portal Access</h2>
        <Badge variant="outline" className="bg-[#225F8B]/10 text-[#225F8B] border-[#225F8B]/20">
          {visiblePortals.length} Available
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {visiblePortals.map((portal) => (
          <Card
            key={portal.id}
            className="group hover:shadow-xl transition-all duration-300 cursor-pointer border-0 bg-white/80 backdrop-blur-sm hover:scale-105"
            onClick={() => openInApp(portal)}
          >
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${portal.gradient} flex items-center justify-center text-2xl shadow-lg`}>
                  {portal.icon}
                </div>
                <Badge variant="secondary" className="text-xs">
                  {portal.category}
                </Badge>
              </div>
              <CardTitle className="text-xl font-bold text-gray-900 group-hover:text-[#225F8B] transition-colors">
                {portal.title}
              </CardTitle>
            </CardHeader>

            <CardContent className="pt-0">
              <p className="text-gray-600 mb-6 text-sm leading-relaxed">
                {portal.description}
              </p>

              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  className="group-hover:bg-[#225F8B]/10 group-hover:border-[#225F8B]/50 group-hover:text-[#225F8B] transition-all duration-200"
                  onClick={(e) => {
                    e.stopPropagation();
                    openInApp(portal);
                  }}
                >
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Open Portal
                </Button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openInNewTab(portal.url);
                  }}
                  title="Open in new tab"
                  className="text-gray-400 hover:text-[#225F8B] transition-all duration-200"
                >
                  <ExternalLink className="h-4 w-4" />
                </button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Access Info */}
      <Card className="bg-gradient-to-r from-[#225F8B]/5 to-[#225F8B]/10 border-[#225F8B]/20">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Quick Access Tips
              </h3>
              <p className="text-gray-600 text-sm">
                Click any portal to open it right here inside the Employee Portal.
                Use the small icon (or "Open in new tab") if you'd rather open it separately.
              </p>
            </div>
            <div className="hidden md:block">
              <div className="w-16 h-16 bg-white/50 rounded-full flex items-center justify-center">
                <ExternalLink className="h-8 w-8 text-[#225F8B]" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PortalCards;
