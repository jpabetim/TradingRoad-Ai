import React, { useState } from 'react';
import { ChartTemplate, MovingAverageConfig } from '../types';

interface TemplateManagerProps {
    templates: ChartTemplate[];
    activeTemplateId: string | null;
    onSaveTemplate: (template: Omit<ChartTemplate, 'id' | 'createdAt' | 'lastModified'>) => void;
    onLoadTemplate: (templateId: string) => void;
    onDeleteTemplate: (templateId: string) => void;
    onSetAsDefault: (templateId: string) => void;
    isOpen: boolean;
    onClose: () => void;
    theme: 'dark' | 'light';
    // Current configuration to save
    currentConfig: {
        movingAverages: MovingAverageConfig[];
        theme: 'dark' | 'light';
        chartPaneBackgroundColor: string;
        volumePaneHeight: number;
        wSignalColor: string;
        wSignalOpacity: number;
        showWSignals: boolean;
        showAiAnalysisDrawings: boolean;
        favoriteTimeframes: string[];
        defaultDataSource?: string;
        defaultSymbol?: string;
        defaultTimeframe?: string;
    };
}

const TemplateManager: React.FC<TemplateManagerProps> = ({
    templates,
    activeTemplateId,
    onSaveTemplate,
    onLoadTemplate,
    onDeleteTemplate,
    onSetAsDefault,
    isOpen,
    onClose,
    theme,
    currentConfig
}) => {
    const [showSaveDialog, setShowSaveDialog] = useState(false);
    const [templateName, setTemplateName] = useState('');
    const [templateDescription, setTemplateDescription] = useState('');

    if (!isOpen) return null;

    const handleSaveTemplate = () => {
        if (!templateName.trim()) return;

        onSaveTemplate({
            name: templateName.trim(),
            description: templateDescription.trim() || undefined,
            isDefault: false,
            configuration: currentConfig
        });

        setTemplateName('');
        setTemplateDescription('');
        setShowSaveDialog(false);
    };

    const handleCancelSave = () => {
        setTemplateName('');
        setTemplateDescription('');
        setShowSaveDialog(false);
    };

    const activeTemplate = templates.find(t => t.id === activeTemplateId);
    const defaultTemplate = templates.find(t => t.isDefault);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className={`max-w-2xl w-full mx-4 rounded-lg shadow-lg ${theme === 'dark' ? 'bg-slate-800 text-white' : 'bg-white text-gray-900'
                }`}>
                {/* Header */}
                <div className={`px-6 py-4 border-b ${theme === 'dark' ? 'border-slate-700' : 'border-gray-200'
                    }`}>
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold">Gestión de Plantillas</h2>
                        <button
                            onClick={onClose}
                            className={`p-2 rounded hover:bg-opacity-10 hover:bg-gray-500 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                                }`}
                        >
                            ✕
                        </button>
                    </div>
                    <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                        Guarda y gestiona tus configuraciones de gráfico favoritas
                    </p>
                </div>

                {/* Content */}
                <div className="px-6 py-4 max-h-96 overflow-y-auto">
                    {/* Save New Template Section */}
                    <div className={`mb-6 p-4 rounded-lg ${theme === 'dark' ? 'bg-slate-700' : 'bg-gray-50'
                        }`}>
                        <h3 className="font-medium mb-3">Guardar Configuración Actual</h3>
                        {!showSaveDialog ? (
                            <button
                                onClick={() => setShowSaveDialog(true)}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                            >
                                💾 Guardar Nueva Plantilla
                            </button>
                        ) : (
                            <div className="space-y-3">
                                <input
                                    type="text"
                                    placeholder="Nombre de la plantilla..."
                                    value={templateName}
                                    onChange={(e) => setTemplateName(e.target.value)}
                                    className={`w-full px-3 py-2 border rounded-lg ${theme === 'dark'
                                            ? 'bg-slate-600 border-slate-500 text-white placeholder-gray-400'
                                            : 'bg-white border-gray-300 text-gray-900'
                                        }`}
                                    autoFocus
                                />
                                <textarea
                                    placeholder="Descripción (opcional)..."
                                    value={templateDescription}
                                    onChange={(e) => setTemplateDescription(e.target.value)}
                                    rows={2}
                                    className={`w-full px-3 py-2 border rounded-lg resize-none ${theme === 'dark'
                                            ? 'bg-slate-600 border-slate-500 text-white placeholder-gray-400'
                                            : 'bg-white border-gray-300 text-gray-900'
                                        }`}
                                />
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleSaveTemplate}
                                        disabled={!templateName.trim()}
                                        className="bg-green-600 hover:bg-green-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors"
                                    >
                                        Guardar
                                    </button>
                                    <button
                                        onClick={handleCancelSave}
                                        className={`px-4 py-2 rounded-lg transition-colors ${theme === 'dark'
                                                ? 'bg-slate-600 hover:bg-slate-500 text-gray-300'
                                                : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                                            }`}
                                    >
                                        Cancelar
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Current Template Info */}
                    {activeTemplate && (
                        <div className={`mb-6 p-4 rounded-lg border-l-4 border-blue-500 ${theme === 'dark' ? 'bg-blue-900 bg-opacity-20' : 'bg-blue-50'
                            }`}>
                            <h4 className="font-medium text-blue-600 dark:text-blue-400">
                                🎯 Plantilla Activa: {activeTemplate.name}
                            </h4>
                            {activeTemplate.description && (
                                <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                                    }`}>
                                    {activeTemplate.description}
                                </p>
                            )}
                        </div>
                    )}

                    {/* Saved Templates List */}
                    <div>
                        <h3 className="font-medium mb-3">Plantillas Guardadas ({templates.length})</h3>
                        {templates.length === 0 ? (
                            <p className={`text-center py-8 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                                }`}>
                                No hay plantillas guardadas. ¡Crea tu primera plantilla!
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {templates.map((template) => (
                                    <div
                                        key={template.id}
                                        className={`p-4 rounded-lg border transition-colors ${activeTemplateId === template.id
                                                ? theme === 'dark'
                                                    ? 'border-blue-500 bg-blue-900 bg-opacity-20'
                                                    : 'border-blue-500 bg-blue-50'
                                                : theme === 'dark'
                                                    ? 'border-slate-600 bg-slate-700 hover:bg-slate-650'
                                                    : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <h4 className="font-medium">
                                                        {template.name}
                                                        {template.isDefault && (
                                                            <span className="ml-2 text-xs bg-green-600 text-white px-2 py-1 rounded">
                                                                Por Defecto
                                                            </span>
                                                        )}
                                                    </h4>
                                                </div>
                                                {template.description && (
                                                    <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                                                        }`}>
                                                        {template.description}
                                                    </p>
                                                )}
                                                <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                                                    }`}>
                                                    Creado: {new Date(template.createdAt).toLocaleDateString()}
                                                    {template.lastModified !== template.createdAt && (
                                                        <span> • Modificado: {new Date(template.lastModified).toLocaleDateString()}</span>
                                                    )}
                                                </p>
                                            </div>

                                            <div className="flex items-center gap-2 ml-4">
                                                <button
                                                    onClick={() => onLoadTemplate(template.id)}
                                                    className={`px-3 py-1 text-xs rounded transition-colors ${activeTemplateId === template.id
                                                            ? 'bg-gray-500 text-gray-300 cursor-not-allowed'
                                                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                                                        }`}
                                                    disabled={activeTemplateId === template.id}
                                                >
                                                    {activeTemplateId === template.id ? 'Activa' : 'Cargar'}
                                                </button>

                                                {!template.isDefault && (
                                                    <button
                                                        onClick={() => onSetAsDefault(template.id)}
                                                        className="px-3 py-1 text-xs rounded bg-green-600 hover:bg-green-700 text-white transition-colors"
                                                        title="Establecer como plantilla por defecto"
                                                    >
                                                        ⭐
                                                    </button>
                                                )}

                                                <button
                                                    onClick={() => onDeleteTemplate(template.id)}
                                                    className="px-3 py-1 text-xs rounded bg-red-600 hover:bg-red-700 text-white transition-colors"
                                                    title="Eliminar plantilla"
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className={`px-6 py-4 border-t ${theme === 'dark' ? 'border-slate-700' : 'border-gray-200'
                    }`}>
                    <div className="flex justify-end">
                        <button
                            onClick={onClose}
                            className={`px-4 py-2 rounded-lg transition-colors ${theme === 'dark'
                                    ? 'bg-slate-600 hover:bg-slate-500 text-gray-300'
                                    : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                                }`}
                        >
                            Cerrar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TemplateManager;
