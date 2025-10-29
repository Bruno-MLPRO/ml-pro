// Funções de formatação centralizadas

import React from 'react';

/**
 * Formata um valor numérico como moeda brasileira (BRL)
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

/**
 * Formata um número com separador de milhares
 */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR').format(value);
}

/**
 * Formata um valor como percentual
 */
export function formatPercentage(value: number, decimals: number = 2): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Formata uma data para o padrão brasileiro
 */
export function formatDate(date: string | Date, format: 'short' | 'long' = 'short'): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (format === 'long') {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    }).format(dateObj);
  }
  
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(dateObj);
}

/**
 * Formata uma data com hora
 */
export function formatDateTime(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(dateObj);
}

/**
 * Formata uma descrição de texto, convertendo listas em HTML
 */
export function formatDescription(description: string): React.ReactNode {
  const lines = description.split('\n').map(line => line.trim()).filter(line => line);
  const hasListItems = lines.some(line => line.startsWith('-'));
  
  if (hasListItems) {
    return (
      <ul className="text-xs text-foreground-secondary space-y-1 mt-2 list-disc list-inside">
        {lines.map((line, index) => {
          if (line.startsWith('-')) {
            return (
              <li key={index} className="ml-3">
                {line.substring(1).trim()}
              </li>
            );
          }
          return <p key={index} className="mt-1">{line}</p>;
        })}
      </ul>
    );
  }
  
  return <p className="text-xs text-foreground-secondary">{description}</p>;
}

