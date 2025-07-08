import { useState, useEffect, useCallback } from 'react';
import { ChartTemplate, TemplateManager as ITemplateManager, MovingAverageConfig, DataSource } from '../types';

const STORAGE_KEY = 'traderoad_chart_templates';
const ACTIVE_TEMPLATE_KEY = 'traderoad_active_template';

export interface TemplateConfiguration {
    movingAverages: MovingAverageConfig[];
    theme: 'dark' | 'light';
    chartPaneBackgroundColor: string;
    volumePaneHeight: number;
    wSignalColor: string;
    wSignalOpacity: number;
    showWSignals: boolean;
    showAiAnalysisDrawings: boolean;
    favoriteTimeframes: string[];
    defaultDataSource?: DataSource;
    defaultSymbol?: string;
    defaultTimeframe?: string;
}

export const useTemplateManager = () => {
    const [templateData, setTemplateData] = useState<ITemplateManager>({
        templates: [],
        activeTemplateId: null
    });

    // Cargar plantillas del localStorage al inicializar
    useEffect(() => {
        try {
            const savedTemplates = localStorage.getItem(STORAGE_KEY);
            const activeTemplateId = localStorage.getItem(ACTIVE_TEMPLATE_KEY);

            if (savedTemplates) {
                const templates: ChartTemplate[] = JSON.parse(savedTemplates);
                setTemplateData({
                    templates,
                    activeTemplateId: activeTemplateId || null
                });
            }
        } catch (error) {
            console.error('Error loading templates from localStorage:', error);
        }
    }, []);

    // Guardar plantillas en localStorage cuando cambien
    const saveToStorage = useCallback((data: ITemplateManager) => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data.templates));
            if (data.activeTemplateId) {
                localStorage.setItem(ACTIVE_TEMPLATE_KEY, data.activeTemplateId);
            } else {
                localStorage.removeItem(ACTIVE_TEMPLATE_KEY);
            }
        } catch (error) {
            console.error('Error saving templates to localStorage:', error);
        }
    }, []);

    // Generar ID único para plantillas
    const generateTemplateId = useCallback(() => {
        return `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }, []);

    // Guardar nueva plantilla
    const saveTemplate = useCallback((template: Omit<ChartTemplate, 'id' | 'createdAt' | 'lastModified'>) => {
        const now = new Date().toISOString();
        const newTemplate: ChartTemplate = {
            ...template,
            id: generateTemplateId(),
            createdAt: now,
            lastModified: now
        };

        setTemplateData(prev => {
            const newData = {
                ...prev,
                templates: [...prev.templates, newTemplate]
            };
            saveToStorage(newData);
            return newData;
        });

        return newTemplate.id;
    }, [generateTemplateId, saveToStorage]);

    // Cargar plantilla
    const loadTemplate = useCallback((templateId: string) => {
        const template = templateData.templates.find(t => t.id === templateId);
        if (!template) {
            console.error('Template not found:', templateId);
            return null;
        }

        setTemplateData(prev => {
            const newData = {
                ...prev,
                activeTemplateId: templateId
            };
            saveToStorage(newData);
            return newData;
        });

        return template.configuration;
    }, [templateData.templates, saveToStorage]);

    // Eliminar plantilla
    const deleteTemplate = useCallback((templateId: string) => {
        setTemplateData(prev => {
            const filteredTemplates = prev.templates.filter(t => t.id !== templateId);
            const newActiveId = prev.activeTemplateId === templateId ? null : prev.activeTemplateId;

            const newData = {
                templates: filteredTemplates,
                activeTemplateId: newActiveId
            };
            saveToStorage(newData);
            return newData;
        });
    }, [saveToStorage]);

    // Establecer como plantilla por defecto
    const setAsDefault = useCallback((templateId: string) => {
        setTemplateData(prev => {
            const updatedTemplates = prev.templates.map(template => ({
                ...template,
                isDefault: template.id === templateId,
                lastModified: template.id === templateId ? new Date().toISOString() : template.lastModified
            }));

            const newData = {
                ...prev,
                templates: updatedTemplates
            };
            saveToStorage(newData);
            return newData;
        });
    }, [saveToStorage]);

    // Actualizar plantilla activa (cuando el usuario modifica configuraciones)
    const updateActiveTemplate = useCallback((configuration: TemplateConfiguration) => {
        if (!templateData.activeTemplateId) return;

        setTemplateData(prev => {
            const updatedTemplates = prev.templates.map(template =>
                template.id === prev.activeTemplateId
                    ? {
                        ...template,
                        configuration,
                        lastModified: new Date().toISOString()
                    }
                    : template
            );

            const newData = {
                ...prev,
                templates: updatedTemplates
            };
            saveToStorage(newData);
            return newData;
        });
    }, [templateData.activeTemplateId, saveToStorage]);

    // Obtener plantilla por defecto
    const getDefaultTemplate = useCallback(() => {
        return templateData.templates.find(t => t.isDefault);
    }, [templateData.templates]);

    // Obtener plantilla activa
    const getActiveTemplate = useCallback(() => {
        if (!templateData.activeTemplateId) return null;
        return templateData.templates.find(t => t.id === templateData.activeTemplateId);
    }, [templateData.templates, templateData.activeTemplateId]);

    // Crear plantilla por defecto inicial si no existe ninguna
    const createDefaultTemplateIfNeeded = useCallback((initialConfig: TemplateConfiguration) => {
        if (templateData.templates.length === 0) {
            const defaultTemplateId = saveTemplate({
                name: "Configuración Básica",
                description: "Plantilla con configuración básica por defecto",
                isDefault: true,
                configuration: initialConfig
            });

            // Activar la plantilla recién creada
            setTemplateData(prev => ({
                ...prev,
                activeTemplateId: defaultTemplateId
            }));
        }
    }, [templateData.templates.length, saveTemplate]);

    return {
        templates: templateData.templates,
        activeTemplateId: templateData.activeTemplateId,
        saveTemplate,
        loadTemplate,
        deleteTemplate,
        setAsDefault,
        updateActiveTemplate,
        getDefaultTemplate,
        getActiveTemplate,
        createDefaultTemplateIfNeeded
    };
};
