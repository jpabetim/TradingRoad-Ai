import React from 'react';

interface TemplateIndicatorProps {
    activeTemplateId: string | null;
    activeTemplateName?: string;
    totalTemplates: number;
    theme: 'dark' | 'light';
}

const TemplateIndicator: React.FC<TemplateIndicatorProps> = ({
    activeTemplateId,
    activeTemplateName,
    totalTemplates,
    theme
}) => {
    if (!activeTemplateId) {
        return (
            <div className={`absolute -bottom-1 -right-1 px-1 py-0.5 text-xs rounded ${theme === 'dark' ? 'bg-slate-700 text-gray-300' : 'bg-gray-200 text-gray-600'
                }`}>
                {totalTemplates}
            </div>
        );
    }

    return (
        <div className="absolute -bottom-1 -right-1 flex items-center">
            <div className={`px-1 py-0.5 text-xs rounded-l ${theme === 'dark' ? 'bg-yellow-600 text-white' : 'bg-yellow-500 text-white'
                }`}>
                ✓
            </div>
            <div
                className={`px-1 py-0.5 text-xs rounded-r ${theme === 'dark' ? 'bg-slate-700 text-gray-300' : 'bg-gray-200 text-gray-600'
                    }`}
                title={activeTemplateName ? `Plantilla activa: ${activeTemplateName}` : 'Plantilla activa'}
            >
                {totalTemplates}
            </div>
        </div>
    );
};

export default TemplateIndicator;
