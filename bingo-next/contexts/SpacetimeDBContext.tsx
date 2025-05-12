"use client";

import React, { createContext, useContext, ReactNode } from 'react';
import useAuthenticatedSpacetimeDB, { SpacetimeDBHookState } from '@/hooks/useAuthenticatedSpacetimeDB';
import { DbConnection } from '@/module_bindings'; // Assuming this is where DbConnection is from

// Define the shape of the context data
interface SpacetimeDBContextType extends SpacetimeDBHookState {
    connRef: React.RefObject<DbConnection | null>;
    subscribeToQueries: (queries: string[]) => void;
}

// Create the context with a default undefined value
const SpacetimeDBContext = createContext<SpacetimeDBContextType | undefined>(undefined);

// Define props for the provider
interface SpacetimeDBProviderProps {
    children: ReactNode;
}

// Create the provider component
export const SpacetimeDBProvider: React.FC<SpacetimeDBProviderProps> = ({ children }) => {
    const dbHookValues = useAuthenticatedSpacetimeDB();
    
    // The value provided by the context will be the object returned by the hook
    const contextValue = {
        ...dbHookValues,
        // connRef is already part of dbHookValues
        // subscribeToQueries is also already part of dbHookValues
    };

    return (
        <SpacetimeDBContext.Provider value={contextValue}>
            {children}
        </SpacetimeDBContext.Provider>
    );
};

// Create a custom hook for easy context consumption
export const useSpacetimeDB = (): SpacetimeDBContextType => {
    const context = useContext(SpacetimeDBContext);
    if (context === undefined) {
        throw new Error('useSpacetimeDB must be used within a SpacetimeDBProvider');
    }
    return context;
}; 