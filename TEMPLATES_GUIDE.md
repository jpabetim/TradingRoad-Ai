# 🎯 Sistema de Gestión de Plantillas

El sistema de plantillas de TradeRoad-AiStudio te permite guardar, cargar y gestionar diferentes configuraciones de tu gráfico de trading. 

## 🚀 Características Principales

### 📋 ¿Qué se guarda en una plantilla?
- **Medias Móviles**: Todas las configuraciones (tipo, período, color, visibilidad)
- **Configuración Visual**: Tema, color de fondo del gráfico, altura del panel de volumen
- **W-Signals**: Color, opacidad y visibilidad
- **Análisis IA**: Estado de visibilidad de los dibujos
- **Temporalidades Favoritas**: Tu lista personalizada de timeframes
- **Configuración por Defecto**: Símbolo, exchange y temporalidad preferidos

### 🔧 Cómo usar el sistema

#### Acceder al Gestor de Plantillas
1. Busca el botón verde con icono de plantilla en la barra superior
2. El indicador numérico muestra cuántas plantillas tienes guardadas
3. Si hay una plantilla activa, verás un ✓ amarillo

#### Guardar una nueva plantilla
1. Configura tu gráfico como desees (medias móviles, colores, etc.)
2. Abre el Gestor de Plantillas
3. Haz clic en "💾 Guardar Nueva Plantilla"
4. Ingresa un nombre descriptivo y una descripción opcional
5. Haz clic en "Guardar"

#### Cargar una plantilla
1. Abre el Gestor de Plantillas
2. Encuentra la plantilla que quieres usar
3. Haz clic en "Cargar"
4. Toda la configuración se aplicará automáticamente

#### Establecer plantilla por defecto
1. Haz clic en el botón ⭐ junto a cualquier plantilla
2. Esta plantilla se cargará automáticamente al iniciar la aplicación

#### Eliminar plantillas
1. Haz clic en el botón 🗑️ junto a la plantilla que quieres eliminar
2. ⚠️ Esta acción no se puede deshacer

## 💡 Casos de Uso Prácticos

### 📈 Trading por Estilos
- **Scalping**: Plantilla con EMA rápidas (5, 12, 20) y W-Signals muy visibles
- **Swing Trading**: Plantilla con MA lentas (50, 100, 200) y configuración diaria
- **Análisis Multi-temporalidad**: Plantilla para análisis HTF con favoritos en 4H, 1D, 1W

### 🎨 Configuraciones Visuales
- **Modo Nocturno**: Tema oscuro con colores suaves para sesiones largas
- **Modo Presentación**: Colores vivos y contrastes altos para compartir análisis
- **Modo Minimalista**: Sin W-Signals, solo precio y estructura básica

### 📊 Por Instrumentos
- **Crypto**: Configuración optimizada para Bitcoin y altcoins
- **Forex**: Setup específico para pares de divisas
- **Índices**: Configuración para análisis de S&P, Nasdaq, etc.

## 🔄 Funcionamiento Automático

### Auto-guardado
- Cuando tienes una plantilla activa, los cambios se guardan automáticamente
- El timestamp de "Última modificación" se actualiza en tiempo real

### Plantilla por Defecto
- Al primer uso, se crea automáticamente una "Configuración Básica"
- Puedes establecer cualquier plantilla como predeterminada

### Persistencia
- Las plantillas se guardan en localStorage de tu navegador
- Sobreviven a reinicios del navegador y actualizaciones de la aplicación

## 🎯 Mejores Prácticas

1. **Nombres Descriptivos**: Usa nombres que identifiquen claramente el propósito
   - ✅ "Scalping BTC - EMAs Rápidas"
   - ❌ "Plantilla 1"

2. **Agrupa por Propósito**: Organiza tus plantillas lógicamente
   - Trading → Scalping, Swing, Position
   - Análisis → Técnico, Fundamental, Multi-TF
   - Visual → Oscuro, Claro, Presentación

3. **Mantén un Conjunto Básico**: 3-5 plantillas cubren la mayoría de casos de uso

4. **Actualiza Regularmente**: Si tu estilo evoluciona, actualiza las plantillas

## 🔍 Indicadores Visuales

- **Contador**: Número total de plantillas guardadas
- **✓ Amarillo**: Indica que hay una plantilla activa
- **"Por Defecto"**: Tag verde en la plantilla que se carga al iniciar
- **Fechas**: Muestra cuándo se creó y modificó cada plantilla

## 🛟 Resolución de Problemas

### No se guardan las plantillas
- Verifica que el navegador permita localStorage
- Comprueba que no estés en modo incógnito

### La plantilla no carga completamente
- Algunas configuraciones pueden requerir reinicio del gráfico
- Cambia de símbolo y vuelve para refrescar

### Pérdida de plantillas
- Las plantillas se almacenan localmente en tu navegador
- Hacer backup: exporta/anota las configuraciones importantes

---

¡Disfruta personalizando tu experiencia de trading con el sistema de plantillas! 🚀📊
