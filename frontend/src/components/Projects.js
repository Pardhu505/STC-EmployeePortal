import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ArrowRight, Map } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const PROJECTS_DATA = [
  {
    id: 'ap-mapping',
    title: 'Andhra Pradesh Urban / Rural Administrative Mapping',
    description: 'Explore and filter administrative mapping data for Andhra Pradesh, separated by RLB and ULB.',
    icon: <Map className="w-8 h-8 text-white" />,
    gradient: 'from-blue-500 to-blue-700',
    category: 'Data Visualization',
    url: '/ap-mapping',
  },
  {
    id: 'campaign-dashboard',
    title: 'Campaign Dashboard',
    description: 'A dashboard for monitoring and analyzing campaign performance metrics.',
    icon: <Map className="w-8 h-8 text-white" />,
    gradient: 'from-green-500 to-green-700',
    category: 'Analytics',
    url: '#', // Not yet implemented
  },
  {
    id: 'ap-zone-booth-mapping',
    title: 'Andhra Pradesh Zone to Booth Mapping',
    description: 'Upload and view zone-to-booth mapping data for Andhra Pradesh.',
    icon: <Map className="w-8 h-8 text-white" />,
    gradient: 'from-purple-500 to-purple-700',
    category: 'Data Management',
    url: '/excel-data',
  },
];

const Projects = () => {
  const navigate = useNavigate();

  const handleProjectClick = (url) => {
    if (url && url !== '#') {
      navigate(url);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Projects</h2>
        <Badge variant="outline" className="bg-[#225F8B]/10 text-[#225F8B] border-[#225F8B]/20">
          {PROJECTS_DATA.length} Available
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {PROJECTS_DATA.map((project) => (
          <Card
            key={project.id}
            className="group hover:shadow-xl transition-all duration-300 cursor-pointer border-0 bg-white/80 backdrop-blur-sm hover:scale-105"
            onClick={() => handleProjectClick(project.url)}
          >
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${project.gradient} flex items-center justify-center text-2xl shadow-lg`}>
                  {project.icon}
                </div>
                <Badge variant="secondary" className="text-xs">
                  {project.category}
                </Badge>
              </div>
              <CardTitle className="text-xl font-bold text-gray-900 group-hover:text-[#225F8B] transition-colors">
                {project.title}
              </CardTitle>
            </CardHeader>

            <CardContent className="pt-0">
              <p className="text-gray-600 mb-6 text-sm leading-relaxed">
                {project.description}
              </p>

              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  className="group-hover:bg-[#225F8B]/10 group-hover:border-[#225F8B]/50 group-hover:text-[#225F8B] transition-all duration-200"
                >
                  Open Project
                </Button>

                <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-[#225F8B] group-hover:translate-x-1 transition-all duration-200" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Projects;
