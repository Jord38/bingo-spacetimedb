"use client"

import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
// import useAuthenticatedSpacetimeDB from '@/hooks/useAuthenticatedSpacetimeDB'; // Removed direct import
import { useSpacetimeDB } from '@/contexts/SpacetimeDBContext'; // Added context hook import
import { BingoFieldDefinition, GameSession } from '@/module_bindings';

const AdminPage: React.FC = () => {
    // const { connRef, connected, authenticatedWithBackend, subscribeToQueries } = useAuthenticatedSpacetimeDB(); // Removed direct hook call
    const { connRef, connected, authenticatedWithBackend, subscribeToQueries } = useSpacetimeDB(); // Use context hook

    const [newFieldText, setNewFieldText] = useState('');
    const [existingFields, setExistingFields] = useState<BingoFieldDefinition[]>([]);
    
    const [newGameName, setNewGameName] = useState('Default Game'); // State for new game name
    const [allGameSessions, setAllGameSessions] = useState<GameSession[]>([]); // State for game sessions

    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const refreshBingoFields = useCallback(() => {
        if (connRef.current?.db?.bingoFieldDefinitions) {
            setExistingFields(Array.from(connRef.current.db.bingoFieldDefinitions.iter()) as BingoFieldDefinition[]);
        }
    }, [connRef]);

    const refreshGameSessions = useCallback(() => { // Callback to refresh game sessions
        if (connRef.current?.db?.gameSessions) {
            setAllGameSessions(Array.from(connRef.current.db.gameSessions.iter()) as GameSession[]);
        }
    }, [connRef]);

    useEffect(() => {
        let bfdHandle: any;
        let gsHandle: any; // Handle for game sessions
        if (connected && authenticatedWithBackend && connRef.current?.db) {
            subscribeToQueries([
                "SELECT * FROM BingoFieldDefinitions",
                "SELECT * FROM GameSessions" // Subscribe to GameSessions
            ]);
            refreshBingoFields(); 
            refreshGameSessions(); // Initial load for game sessions

            bfdHandle = connRef.current.db.bingoFieldDefinitions;
            if (bfdHandle) {
                bfdHandle.onInsert(refreshBingoFields);
                bfdHandle.onUpdate(refreshBingoFields);
                bfdHandle.onDelete(refreshBingoFields);
            }

            gsHandle = connRef.current.db.gameSessions; // Setup listeners for GameSessions
            if (gsHandle) {
                gsHandle.onInsert(refreshGameSessions);
                gsHandle.onUpdate(refreshGameSessions);
                gsHandle.onDelete(refreshGameSessions);
            }
        }
        return () => {
            if (bfdHandle) {
                bfdHandle.removeOnInsert(refreshBingoFields);
                bfdHandle.removeOnUpdate(refreshBingoFields);
                bfdHandle.removeOnDelete(refreshBingoFields);
            }
            if (gsHandle) { // Cleanup for game session listeners
                gsHandle.removeOnInsert(refreshGameSessions);
                gsHandle.removeOnUpdate(refreshGameSessions);
                gsHandle.removeOnDelete(refreshGameSessions);
            }
        };
    }, [connected, authenticatedWithBackend, connRef, subscribeToQueries, refreshBingoFields, refreshGameSessions]);

    const handleAddField = () => {
        if (!connRef.current?.reducers) {
            setError("Not connected to backend.");
            return;
        }
        if (!newFieldText.trim()) {
            setError("Field text cannot be empty.");
            return;
        }

        try {
            connRef.current.reducers.addBingoFieldDefinition(newFieldText.trim());
            setSuccessMessage(`Successfully added field: "${newFieldText.trim()}"`);
            setNewFieldText('');
            setError(null);
        } catch (e: any) {
            console.error("Error calling AddBingoFieldDefinition:", e);
            setError(`Failed to add field: ${e.message}`);
            setSuccessMessage(null);
        }
    };

    const handleCreateGameSession = () => { // Function to create a game session
        if (!connRef.current?.reducers) {
            setError("Not connected to backend for creating game.");
            return;
        }
        if (!newGameName.trim()) {
            setError("Game name cannot be empty.");
            return;
        }
        try {
            // Assuming createGameSession takes (gameName: string, fieldIds: ulong[] | undefined)
            // For now, not passing specific field_ids, backend might use all/random
            connRef.current.reducers.createGameSession(newGameName.trim(), undefined);
            setSuccessMessage(`Successfully called to create game: "${newGameName.trim()}"`);
            setNewGameName('Default Game'); // Reset or clear
            setError(null);
        } catch (e: any) {
            console.error("Error calling CreateGameSession:", e);
            setError(`Failed to create game: ${e.message}`);
            setSuccessMessage(null);
        }
    };

    if (!connected || !authenticatedWithBackend) {
        return (
            <div style={{ padding: '20px' }}>
                <p>Connecting and authenticating...</p>
            </div>
        );
    }

    return (
        <>
            <Head>
                <title>Bingo Admin</title>
            </Head>
            <div style={{ padding: '20px' }}>
                <h1>Admin Panel</h1>
                {error && <p style={{ color: 'red' }}>Error: {error}</p>}
                {successMessage && <p style={{ color: 'green' }}>{successMessage}</p>}

                <div style={{ marginBottom: '30px', paddingBottom: '20px', borderBottom: '1px solid #eee' }}>
                    <h2>Game Sessions</h2>
                    <div style={{ marginBottom: '10px'}}>
                        <input
                            type="text"
                            value={newGameName}
                            onChange={(e) => setNewGameName(e.target.value)}
                            placeholder="Enter new game name"
                            style={{ marginRight: '10px', padding: '8px', minWidth: '250px', color: 'black' }}
                        />
                        <button onClick={handleCreateGameSession} style={{ padding: '8px 15px' }}>Create New Game</button>
                    </div>
                    <h3>Existing Game Sessions ({allGameSessions.length})</h3>
                    {allGameSessions.length === 0 ? (
                        <p>No game sessions found.</p>
                    ) : (
                        <ul style={{ listStyleType: 'none', paddingLeft: '0' }}>
                            {allGameSessions.sort((a,b) => b.gameId - a.gameId).map(session => (
                                <li key={session.gameId} style={{ marginBottom: '5px', padding: '5px', background: session.isActive ? '#e6ffed' : '#f0f0f0' }}>
                                    ID: {session.gameId} - Name: {session.gameName} - Active: {session.isActive ? 'Yes' : 'No'}
                                    {/* TODO: Add buttons to activate/deactivate games if needed */}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div style={{ marginBottom: '20px' }}>
                    <h2>Bingo Field Definitions</h2>
                    <input
                        type="text"
                        value={newFieldText}
                        onChange={(e) => setNewFieldText(e.target.value)}
                        placeholder="Enter bingo field text"
                        style={{ marginRight: '10px', padding: '8px', minWidth: '300px', color: 'black' }}
                    />
                    <button onClick={handleAddField} style={{ padding: '8px 15px' }}>Add Field</button>
                </div>

                <div>
                    <h3>Existing Fields ({existingFields.length})</h3>
                    {existingFields.length === 0 ? (
                        <p>No bingo fields defined yet.</p>
                    ) : (
                        <ul style={{ listStyleType: 'decimal', paddingLeft: '20px' }}>
                            {existingFields.map(field => (
                                <li key={field.fieldId}>
                                    {field.text} (ID: {field.fieldId}, Marked: {field.isMarked ? 'Yes' : 'No'})
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </>
    );
};

export default AdminPage;