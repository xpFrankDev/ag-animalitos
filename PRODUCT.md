# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

El usuario principal es el operador de una agencia o taquilla de animalitos en Venezuela. Registra ventas de tickets durante la jornada, principalmente desde escritorio. Gruperos y banqueros administran la red de agencias.

## Product Purpose

AG · Animalitos permite vender animalitos, gestionar sus tickets y controlar su operación. La plataforma también permite que gruperos y banqueros creen agencias, configuren sus parámetros y registren resultados.

## Positioning

Combina la venta operativa de animalitos con control de tickets, cupos y una jerarquía de gestión Agencia–Grupero–Banquero, en lugar de ser solo un formulario de venta aislado.

## Operating Context

La operación ocurre en Venezuela, durante una jornada de venta con sorteos y cierres horarios. El puesto de agencia necesita registrar combinaciones rápidamente y poder imprimir tickets también desde un dispositivo móvil.

## Capabilities and Constraints

- Venta de múltiples animales y sorteos por ticket.
- Control de cupos diarios, importes mínimos, cierre de sorteos y estados de tickets.
- Gestión futura de agencias y sus parámetros por gruperos y banqueros.
- Registro de resultados.
- La versión de escritorio es prioritaria; móvil debe conservar una operación e impresión de tickets sencillas.
- La interfaz soporta español e italiano y temas claro/oscuro.

## Brand Commitments

El producto se identifica como AG · Animalitos. Debe comunicar una herramienta operativa, clara y confiable para el entorno de taquillas venezolanas.

## Evidence on Hand

- Implementación React/Vite en `frontend/` y API NestJS/MariaDB en `backend/`.
- Flujo actual de acceso y venta de Agencia.
- Datos iniciales de animales, sorteos y horarios en `backend/src/semillas/sembrar.ts`.
- No se deben inventar resultados, premios, clientes, agencias ni métricas de negocio.

## Product Principles

- La venta y confirmación del ticket deben ser rápidas y verificables.
- Los controles operativos deben evitar exceder cupos o incluir sorteos cerrados.
- La jerarquía Agencia–Grupero–Banquero debe ser visible en las futuras áreas de gestión, sin entorpecer la venta diaria.
- Escritorio para densidad operativa; móvil para continuidad e impresión práctica.

## Accessibility & Inclusion

Los controles de venta deben seguir siendo operables con teclado y táctiles en móvil, con estados de selección y error perceptibles más allá del color.
