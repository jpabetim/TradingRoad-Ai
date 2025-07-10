# 🌐 Sistema de Prompts Universal Multi-Activo

## 📋 Resumen de Cambios

Se ha actualizado completamente el sistema de prompts del Chat IA y Análisis IA para ser **UNIVERSAL** y funcionar con cualquier tipo de activo financiero.

## 🎯 Activos Soportados

### 🔸 **CRIPTOMONEDAS** 
- BTC, ETH, Altcoins
- Características: Sesiones 24/7, funding rates, correlación BTC, alta volatilidad
- Contexto específico: Dominancia BTC, alt season, eventos blockchain

### 🔸 **FOREX**
- EUR/USD, GBP/USD, USD/JPY, etc.
- Características: Sesiones específicas (Tokio/Londres/NY), eventos macro
- Contexto específico: DXY, yields, geopolítica, carry trades

### 🔸 **ÍNDICES**
- S&P500, Nasdaq, DAX, Nikkei, etc.
- Características: Horarios bursátiles, earnings seasons
- Contexto específico: Rotación sectorial, Fed policy, VIX

### 🔸 **MATERIAS PRIMAS**
- Oro (XAU), Petróleo (WTI/Brent), Plata, Cobre, etc.
- Características: Estacionalidad, inventarios, geopolítica
- Contexto específico: Correlación DXY, demanda China, COT data

### 🔸 **ACCIONES**
- Stocks individuales
- Características: Earnings, múltiplos, eventos corporativos
- Contexto específico: Sector performance, insider activity

## 🔧 Cambios Implementados

### 1. **Chat IA Prompt (CHAT_SYSTEM_PROMPT_TEMPLATE)**
- ✅ **Expertise Multi-Activo**: El AI ahora conoce las particularidades de cada clase de activo
- ✅ **Adaptación Contextual**: Ajusta el análisis según crypto/forex/índices/commodities/stocks
- ✅ **Gestión de Riesgo Específica**: Considera los riesgos únicos de cada mercado
- ✅ **Temporal Awareness**: Maneja horarios y sesiones específicos por activo

### 2. **Análisis IA Prompt (WYCKOFF_SMC_STRATEGY_PROMPT_CORE)**
- ✅ **Expertise Multi-Activo**: Sección dedicada a cada tipo de activo
- ✅ **Contexto Específico**: Instrucciones adaptadas por clase de activo
- ✅ **Análisis Contextual Universal**: Template que se adapta automáticamente

### 3. **Contexto de Mercado (INITIAL_MARKET_CONTEXT_FOR_PROMPT)**
- ✅ **Guías Específicas**: Contexto detallado para cada tipo de activo
- ✅ **Factores Únicos**: Considera funding rates (crypto), sesiones (forex), earnings (stocks), etc.
- ✅ **Correlaciones Relevantes**: Correlaciones específicas por mercado

## 🎮 Cómo Funciona

### **Detección Automática**
El sistema detecta automáticamente el tipo de activo basándose en:
- Símbolo (BTC/USDT = crypto, EUR/USD = forex, etc.)
- Exchange/fuente de datos
- Patrones de nomenclatura

### **Adaptación Contextual**
- **CRYPTO**: Considera correlación BTC, funding rates, sesiones 24/7
- **FOREX**: Enfoca en sesiones, eventos macro, correlaciones divisas
- **ÍNDICES**: Analiza horarios bursátiles, earnings, rotación sectorial
- **COMMODITIES**: Evalúa estacionalidad, inventarios, geopolítica
- **STOCKS**: Considera earnings, múltiplos, eventos corporativos

### **Análisis Específico**
Cada análisis incluye:
- ✅ Correlaciones relevantes para el activo
- ✅ Factores temporales específicos (sesiones, horarios)
- ✅ Sentiment y posicionamiento adaptado
- ✅ Gestión de riesgo específica del mercado

## 📝 Ejemplos de Uso

### **Chat con BTC/USDT**
- Considerará correlación con DXY, funding rates, dominancia BTC
- Analizará patrones 24/7, sin gaps de fin de semana
- Evaluará sentiment crypto específico

### **Chat con EUR/USD**
- Se enfocará en sesiones Tokio/Londres/NY
- Considerará eventos Fed/BCE, yields, geopolítica
- Analizará correlaciones con otros pares de divisas

### **Chat con S&P500**
- Considerará horarios pre/post market
- Evaluará rotación sectorial, earnings impact
- Analizará VIX, put/call ratios, Fed policy

## 🚀 Beneficios

1. **Universal**: Un solo sistema para todos los mercados
2. **Específico**: Análisis adaptado a cada tipo de activo
3. **Profesional**: Terminología y conceptos apropiados por mercado
4. **Completo**: Cubre todos los factores relevantes por activo
5. **Escalable**: Fácil agregar nuevos tipos de activos

## 🔄 Compatibilidad

- ✅ **Totalmente compatible** con la arquitectura existente
- ✅ **No requiere cambios** en el frontend
- ✅ **Funciona inmediatamente** con cualquier símbolo
- ✅ **Mantiene toda la funcionalidad** SMC/Wyckoff existente

## 📊 Resultado

TradinGuardIAn ahora es un **asistente de trading verdaderamente universal** que puede analizar y proporcionar insights específicos para:

- 🪙 **Criptomonedas** (BTC, ETH, Altcoins)
- 💱 **Forex** (EUR/USD, GBP/USD, etc.)
- 📈 **Índices** (S&P500, Nasdaq, DAX, etc.)
- 🥇 **Materias Primas** (Oro, Petróleo, Plata, etc.)
- 📊 **Acciones** (Stocks individuales)

Con análisis técnico SMC/Wyckoff adaptado específicamente a las características únicas de cada mercado.
