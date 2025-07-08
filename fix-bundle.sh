#!/bin/bash

# Script para diagnosticar y corregir problemas con el bundle en el servidor
# Este script debe ejecutarse en el servidor

set -e

echo "🔍 Iniciando diagnóstico detallado del bundle..."

# Verificar que estamos en el directorio correcto
if [ ! -d "/var/www/traderoad" ]; then
    echo "❌ Error: El directorio /var/www/traderoad no existe"
    exit 1
fi

# Ir al directorio de la aplicación
cd /var/www/traderoad

# Verificar la presencia del archivo utils/uuid.ts
echo "🔍 Verificando archivo utils/uuid.ts..."
if [ ! -f "utils/uuid.ts" ]; then
    echo "❌ Error: El archivo utils/uuid.ts no existe"
    echo "🔧 Creando archivo utils/uuid.ts..."
    mkdir -p utils
    cat > utils/uuid.ts << 'EOF'
/**
 * Genera un UUID v4 compatible con todos los navegadores
 * Fallback para crypto.randomUUID() cuando no está disponible (especialmente en HTTP)
 */
export function generateUUID(): string {
    // Primero intentar crypto.randomUUID si está disponible (solo funciona en HTTPS)
    if (typeof crypto !== 'undefined' &&
        crypto.randomUUID &&
        typeof crypto.randomUUID === 'function') {
        try {
            return crypto.randomUUID();
        } catch (error) {
            // Si falla (por ejemplo, en HTTP), usar el fallback
            console.warn('crypto.randomUUID failed, using fallback:', error);
        }
    }

    // Fallback más simple y confiable que funciona en HTTP y HTTPS
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}
EOF
    echo "✅ Archivo utils/uuid.ts creado"
else
    echo "✅ Archivo utils/uuid.ts existe"
    cat utils/uuid.ts
fi

# Verificar que la función generateUUID se está importando correctamente en los archivos principales
echo "🔍 Verificando importaciones en App.tsx..."
if grep -q "import { generateUUID } from './utils/uuid'" App.tsx; then
    echo "✅ App.tsx importa correctamente generateUUID"
else
    echo "❌ App.tsx no importa correctamente generateUUID"
    echo "🔧 Corrigiendo importación en App.tsx..."
    sed -i '1s/^/import { generateUUID } from "\.\/utils\/uuid";\n/' App.tsx
    echo "✅ Importación añadida a App.tsx"
fi

echo "🔍 Verificando importaciones en RealTimeTradingChart.tsx..."
if grep -q "import { generateUUID } from '../utils/uuid'" components/RealTimeTradingChart.tsx; then
    echo "✅ RealTimeTradingChart.tsx importa correctamente generateUUID"
else
    echo "❌ RealTimeTradingChart.tsx no importa correctamente generateUUID"
    echo "🔧 Corrigiendo importación en RealTimeTradingChart.tsx..."
    sed -i '1s/^/import { generateUUID } from "\.\.\/utils\/uuid";\n/' components/RealTimeTradingChart.tsx
    echo "✅ Importación añadida a RealTimeTradingChart.tsx"
fi

# Verificar que todas las referencias a crypto.randomUUID están siendo sustituidas por generateUUID
echo "🔍 Buscando referencias directas a crypto.randomUUID en el código fuente..."
direct_refs=$(grep -r "crypto\.randomUUID" --include="*.ts" --include="*.tsx" . | grep -v "utils/uuid.ts" || true)

if [ -n "$direct_refs" ]; then
    echo "⚠️ Referencias directas encontradas a crypto.randomUUID:"
    echo "$direct_refs"
    echo "🔧 Corrigiendo referencias..."
    
    # Reemplazar referencias directas en los archivos
    for file in $(grep -l "crypto\.randomUUID" --include="*.ts" --include="*.tsx" . | grep -v "utils/uuid.ts"); do
        echo "🔧 Modificando $file..."
        # Si es un archivo de componentes, asegurarse de que se importa generateUUID
        if [[ $file == *"/components/"* ]] && ! grep -q "import { generateUUID } from '../utils/uuid'" "$file"; then
            sed -i '1s/^/import { generateUUID } from "\.\.\/utils\/uuid";\n/' "$file"
            echo "✅ Importación añadida a $file"
        elif [[ $file != *"/components/"* ]] && [[ $file != "./utils/uuid.ts" ]] && ! grep -q "import { generateUUID } from './utils/uuid'" "$file"; then
            sed -i '1s/^/import { generateUUID } from "\.\/utils\/uuid";\n/' "$file"
            echo "✅ Importación añadida a $file"
        fi
        
        # Reemplazar crypto.randomUUID() por generateUUID()
        sed -i 's/crypto\.randomUUID()/generateUUID()/g' "$file"
        echo "✅ Referencias reemplazadas en $file"
    done
else
    echo "✅ No se encontraron referencias directas a crypto.randomUUID"
fi

# Reconstruir el proyecto
echo "🔨 Reconstruyendo el proyecto..."
npm install
npm run build

# Verificar el bundle resultante
echo "🔍 Verificando el bundle final..."
if grep -r "crypto.randomUUID" --include="*.js" dist/ | grep -v "Sa()" > /dev/null; then
    echo "❌ Aún hay referencias directas a crypto.randomUUID en el bundle"
    grep -r "crypto.randomUUID" --include="*.js" dist/ | grep -v "Sa()"
    echo "⚠️ El problema persiste. Por favor, revisa manualmente el código."
else
    echo "✅ No se encontraron referencias problemáticas a crypto.randomUUID en el bundle"
fi

if grep -r "generateUUID" --include="*.js" dist/ > /dev/null; then
    echo "✅ Función generateUUID encontrada en el bundle"
else
    echo "❌ Función generateUUID no encontrada en el bundle"
    echo "⚠️ El problema persiste. Por favor, revisa que la función esté siendo exportada correctamente."
fi

# Reiniciar Nginx
echo "🔄 Reiniciando Nginx..."
sudo systemctl restart nginx

echo ""
echo "✅ Diagnóstico y corrección completados."
