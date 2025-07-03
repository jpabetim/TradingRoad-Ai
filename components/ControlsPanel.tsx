
import React from 'react';
import { MovingAverageConfig } from '../types';

interface ControlsPanelProps {
  theme: 'dark' | 'light';
  movingAverages: MovingAverageConfig[];
  setMovingAverages: (mas: MovingAverageConfig[]) => void;
  onToggleAllMAs: (forceVisible?: boolean) => void;
}

const ControlsPanel: React.FC<ControlsPanelProps> = ({
  theme,
  movingAverages,
  setMovingAverages,
  onToggleAllMAs,
}) => {

  const toggleMAVisibility = (id: string) => {
    setMovingAverages(movingAverages.map(ma => 
      ma.id === id ? { ...ma, visible: !ma.visible } : ma
    ));
  };

  return (
    <div className={`p-3 sm:p-4 ${theme === 'dark' ? 'bg-slate-800' : 'bg-white'} rounded-lg shadow`}>
      <h2 className={`text-lg sm:text-xl font-semibold mb-3 sm:mb-4 ${theme === 'dark' ? 'text-sky-400' : 'text-sky-600'}`}>Indicadores</h2>

      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <h3 className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Medias Móviles</h3>
          <button
            onClick={() => onToggleAllMAs()}
            className={`text-xs px-2 py-1 rounded transition-colors ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600 text-slate-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}
          >
            {movingAverages.every(ma => ma.visible) ? 'Ocultar Todas' : 'Mostrar Todas'}
          </button>
        </div>
        
        <div className="space-y-2">
          {movingAverages.map(ma => (
            <div key={ma.id} className="flex items-center gap-2">
              <button
                onClick={() => toggleMAVisibility(ma.id)}
                className={`flex items-center gap-2 text-xs px-2 py-1 rounded transition-colors ${
                  ma.visible 
                    ? (theme === 'dark' ? 'bg-slate-700 text-slate-200' : 'bg-gray-200 text-gray-700')
                    : (theme === 'dark' ? 'bg-slate-600 text-slate-400' : 'bg-gray-300 text-gray-500')
                }`}
              >
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: ma.visible ? ma.color : '#6b7280' }}
                ></span>
                <span>{ma.type} {ma.period}</span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ControlsPanel;
