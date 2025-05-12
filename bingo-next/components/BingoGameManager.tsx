import React, { useEffect, useState, useCallback, useMemo } from 'react';
// import useAuthenticatedSpacetimeDB from '@/hooks/useAuthenticatedSpacetimeDB'; // Removed
import { useSpacetimeDB } from '@/contexts/SpacetimeDBContext'; // Added
import { useSession } from 'next-auth/react'; // For getting steamId
import {
  GameSession,
  PlayerBingoCard,
  BingoFieldDefinition,
  TestLog,
  EventContext,
} from '@/module_bindings'; // Main import for types

const BingoGameManager: React.FC = () => {
  // const { connRef, connected, authenticatedWithBackend, subscribeToQueries } = useAuthenticatedSpacetimeDB(); // Removed
  const { connRef, connected, authenticatedWithBackend, subscribeToQueries } = useSpacetimeDB(); // Changed to useSpacetimeDB
  const { data: session } = useSession();

  const [activeGameId, setActiveGameId] = useState<number | null>(null);
  const [allGameSessions, setAllGameSessions] = useState<GameSession[]>([]);
  const [playerCardDetails, setPlayerCardDetails] = useState<PlayerBingoCard | null>(null);
  const [bingoFields, setBingoFields] = useState<BingoFieldDefinition[]>([]);
  const [testLogs, setTestLogs] = useState<TestLog[]>([]);
  
  const steamId = useMemo(() => (session?.user as { steamId?: string })?.steamId, [session]);

  const loadInitialGameSessions = useCallback(() => {
    if (connRef.current?.db?.gameSessions) {
      const sessions = Array.from(connRef.current.db.gameSessions.iter()) as GameSession[];
      setAllGameSessions(sessions);
      const active = sessions.find(s => s.isActive);
      setActiveGameId(active ? active.gameId : null);
      console.log("Initial game sessions loaded:", sessions, "Active game ID:", active ? active.gameId : null);
    }
  }, [connRef]);

  const refreshPlayerCard = useCallback(() => {
    if (connRef.current?.db?.playerBingoCards && steamId && activeGameId) {
      const cardId = `${steamId}_${activeGameId}`;
      const card = connRef.current.db.playerBingoCards.cardId.find(cardId);
      setPlayerCardDetails(card || null);
    } else {
      setPlayerCardDetails(null);
    }
  }, [connRef, steamId, activeGameId]);
  
   const refreshBingoFields = useCallback(() => {
    if (connRef.current?.db?.bingoFieldDefinitions) {
      setBingoFields(Array.from(connRef.current.db.bingoFieldDefinitions.iter()) as BingoFieldDefinition[]);
    }
  }, [connRef]);

  const refreshTestLogs = useCallback(() => {
    console.log("Attempting to refresh test logs...");
    if (connRef.current?.db?.testLog) {
      console.log("connRef.current.db.testLog is available.");
      try {
        const logs = Array.from(connRef.current.db.testLog.iter()) as TestLog[];
        console.log("Fetched test logs:", logs);
        setTestLogs(logs);
      } catch (e) {
        console.error("[refreshTestLogs] Error during iteration or state update:", e);
      }
    } else {
      console.warn("connRef.current.db.testLog is NOT available. connRef.current.db:", connRef.current?.db);
    }
  }, [connRef]);

  useEffect(() => {
    if (connected && authenticatedWithBackend && connRef.current?.db) {
      subscribeToQueries([
        "SELECT * FROM GameSessions",
        "SELECT * FROM BingoFieldDefinitions",
        "SELECT * FROM PlayerBingoCards",
        "SELECT * FROM TestLogs"
      ]);

      console.log("Setting up table listeners. connRef.current.db:", connRef.current?.db);

      loadInitialGameSessions();
      refreshBingoFields();
      refreshTestLogs();

      const gsHandle = connRef.current.db.gameSessions;
      const pbcHandle = connRef.current.db.playerBingoCards;
      const bfdHandle = connRef.current.db.bingoFieldDefinitions;
      const tlHandle = connRef.current.db.testLog;

      // Define callbacks for gsHandle in a scope accessible to cleanup
      const gsOnInsertCb = (_ctx: EventContext | undefined, session: GameSession) => {
        console.log("%%%%% [gsHandle.onInsert] TRIGGERED! New GameSession data:", session, "%%%%%");
        setAllGameSessions(prevSessions => {
          if (prevSessions.some(s => s.gameId === session.gameId)) return prevSessions;
          return [...prevSessions, session];
        });
      };
      const gsOnUpdateCb = (_ctx: EventContext | undefined, newSession: GameSession, oldSession: GameSession | undefined) => {
        console.log("[gsHandle.onUpdate] GameSession updated. Old:", oldSession, "New:", newSession);
        setAllGameSessions(prevSessions => 
          prevSessions.map(s => s.gameId === newSession.gameId ? newSession : s)
        );
      };
      const gsOnDeleteCb = (_ctx: EventContext | undefined, oldSession: GameSession) => {
        console.log("[gsHandle.onDelete] GameSession deleted:", oldSession);
        setAllGameSessions(prevSessions => prevSessions.filter(s => s.gameId !== oldSession.gameId));
      };

      if (gsHandle) {
        console.log("Attaching listeners to gsHandle (gameSessions)");
        gsHandle.onInsert(gsOnInsertCb);
        gsHandle.onUpdate(gsOnUpdateCb);
        gsHandle.onDelete(gsOnDeleteCb);
      } else {
        console.error("gsHandle (gameSessions) is undefined. Cannot attach listeners.");
      }
      if (pbcHandle) {
        console.log("Attaching listeners to pbcHandle (playerBingoCards)");
        pbcHandle.onInsert(refreshPlayerCard); pbcHandle.onUpdate(refreshPlayerCard); pbcHandle.onDelete(refreshPlayerCard);
      } else {
        console.error("pbcHandle (playerBingoCards) is undefined. Cannot attach listeners.");
      }
      if (bfdHandle) {
        console.log("Attaching listeners to bfdHandle (bingoFieldDefinitions)");
        bfdHandle.onInsert(refreshBingoFields); bfdHandle.onUpdate(refreshBingoFields); bfdHandle.onDelete(refreshBingoFields);
      } else {
        console.error("bfdHandle (bingoFieldDefinitions) is undefined. Cannot attach listeners.");
      }

      // Define callback for tlHandle in a scope accessible to cleanup
      const tlOnInsertCb = (_ctx: EventContext | undefined, log: TestLog) => { 
        console.log("[tlHandle.onInsert] New TestLog inserted:", log);
        setTestLogs(prevLogs => [...prevLogs, log]);
      };

      if (tlHandle) {
        console.log("Attaching listeners to tlHandle (testLog)");
        tlHandle.onInsert(tlOnInsertCb);
      } else {
        console.error("tlHandle (testLog) is undefined. Cannot attach listeners.");
      }
      
      return () => {
        if (gsHandle) {
          console.log("Removing listeners from gsHandle (gameSessions)");
          gsHandle.removeOnInsert(gsOnInsertCb);
          gsHandle.removeOnUpdate(gsOnUpdateCb);
          gsHandle.removeOnDelete(gsOnDeleteCb);
        } else {
          console.warn("gsHandle (gameSessions) was undefined during cleanup. Cannot remove listeners.");
        }
        if (pbcHandle) {
          console.log("Removing listeners from pbcHandle (playerBingoCards)");
          pbcHandle.removeOnInsert(refreshPlayerCard); pbcHandle.removeOnUpdate(refreshPlayerCard); pbcHandle.removeOnDelete(refreshPlayerCard);
        } else {
          console.warn("pbcHandle (playerBingoCards) was undefined during cleanup. Cannot remove listeners.");
        }
        if (bfdHandle) {
          console.log("Removing listeners from bfdHandle (bingoFieldDefinitions)");
          bfdHandle.removeOnInsert(refreshBingoFields); bfdHandle.removeOnUpdate(refreshBingoFields); bfdHandle.removeOnDelete(refreshBingoFields);
        } else {
          console.warn("bfdHandle (bingoFieldDefinitions) was undefined during cleanup. Cannot remove listeners.");
        }
        if (tlHandle) {
          console.log("Removing listeners from tlHandle (testLog)");
          tlHandle.removeOnInsert(tlOnInsertCb);
        }
      };
    }
  }, [
    connected, 
    authenticatedWithBackend, 
    connRef, 
    subscribeToQueries, 
    loadInitialGameSessions,
    refreshPlayerCard, 
    refreshBingoFields,
    refreshTestLogs
  ]);

  useEffect(() => {
    if (connected && authenticatedWithBackend) {
        refreshPlayerCard();
        console.log("[useEffect allGameSessions] Updating active game ID based on current sessions:", allGameSessions);
        const active = allGameSessions.find(s => s.isActive);
        setActiveGameId(active ? active.gameId : null);
        if (active) {
          console.log("[useEffect allGameSessions] New active game ID set:", active.gameId);
        } else {
          console.log("[useEffect allGameSessions] No active game found.");
        }
    }
  }, [allGameSessions, connected, authenticatedWithBackend, refreshPlayerCard]);

  const handleCreateGame = () => {
    if (connRef.current?.reducers) {
      try {
        connRef.current.reducers.createGameSession("Default Bingo Game", undefined);
        console.log("CreateGameSession reducer called.");
      } catch (e) {
        console.error("Error calling CreateGameSession:", e);
      }
    }
  };

  const handleGetCard = () => {
    if (connRef.current?.reducers && activeGameId) {
      try {
        connRef.current.reducers.requestNewBingoCard(activeGameId);
        console.log("RequestNewBingoCard reducer called.");
      } catch (e) {
        console.error("Error calling RequestNewBingoCard:", e);
      }
    }
  };
  
  const handleMarkField = (fieldId: number) => {
    if (connRef.current?.reducers && activeGameId && playerCardDetails) {
        connRef.current.reducers.markField(activeGameId, fieldId);
        console.log(`MarkField called for game ${activeGameId}, field ${fieldId}`);
    }
  };
  
  const cardFieldsToDisplay = useMemo(() => {
    if (!playerCardDetails || !playerCardDetails.assignedFieldIds || bingoFields.length === 0) {
      return [];
    }
    return playerCardDetails.assignedFieldIds.map(id => {
      const fieldDef = bingoFields.find(bf => bf.fieldId === id);
      return fieldDef ? { id: fieldDef.fieldId, text: fieldDef.text, isMarked: fieldDef.isMarked } : null;
    }).filter(Boolean) as { id: number; text: string; isMarked: boolean }[];
  }, [playerCardDetails, bingoFields]);

  const handleAddTestLog = () => {
    if (connRef.current?.reducers) {
      const message = `Test log @ ${new Date().toLocaleTimeString()}`;
      try {
        connRef.current.reducers.addTestLogEntry(message);
        console.log(`AddTestLogEntry reducer called with message: "${message}"`);
      } catch (e) {
        console.error("Error calling AddTestLogEntry:", e);
      }
    }
  };

  console.log('BingoGameManager render:', {
    connRefCurrent: connRef.current,
    connected,
    authenticatedWithBackend,
    activeGameId,
    steamId
  });

  if (!connected || !authenticatedWithBackend) {
    console.log('Showing connecting/authenticating message...');
    return <p>Connecting to SpacetimeDB and authenticating...</p>;
  }

  const isButtonDisabled = !connRef.current;
  console.log('Create Game Button state:', {
    isDisabled: isButtonDisabled,
    activeGameIdPresent: !!activeGameId,
    connRefCurrentExists: !!connRef.current
  });

  return (
    <div style={{ padding: '20px' }}>
      <h1>Bingo Game</h1>
      {!activeGameId && <button onClick={handleCreateGame} disabled={isButtonDisabled}>Create Default Game</button>}
      {activeGameId && <p>Active Game ID: {activeGameId}</p>}

      <div style={{ margin: '20px 0' }}>
        <button onClick={handleAddTestLog} disabled={!connRef.current}>Add Test Log</button>
      </div>

      <div style={{ marginTop: '20px', marginBottom: '20px', padding: '10px', border: '1px solid lightblue' }}>
        <h3>Test Logs (from TestLogs table):</h3>
        {testLogs.length === 0 && <p>No test logs yet.</p>}
        <ul style={{ listStyleType: 'none', paddingLeft: 0 }}>
          {testLogs.map(log => (
            <li key={log.logId} style={{ marginBottom: '5px', padding: '5px', background: '#f0f8ff' }}>
              ID: {log.logId} - Message: "{log.message}" @ Timestamp: {log.timestamp?.toString()}
            </li>
          ))}
        </ul>
      </div>

      {activeGameId && !playerCardDetails && steamId && (
        <button onClick={handleGetCard} disabled={isButtonDisabled}>Get My Bingo Card for Game {activeGameId}</button>
      )}

      {playerCardDetails && (
        <div>
          <h3>Your Bingo Card (Game: {playerCardDetails.gameId}, Card: {playerCardDetails.cardId})</h3>
          {cardFieldsToDisplay.length < 25 && <p>Generating your card fields...</p>}
          {cardFieldsToDisplay.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px', maxWidth: '700px', margin: '20px 0' }}>
              {cardFieldsToDisplay.map(field => field && (
                <div 
                  key={field.id} 
                  onClick={() => !field.isMarked && handleMarkField(field.id)}
                  style={{
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    padding: '15px 10px',
                    textAlign: 'center',
                    backgroundColor: field.isMarked ? '#d4edda' : '#f8f9fa',
                    color: field.isMarked ? '#155724' : '#212529',
                    cursor: field.isMarked ? 'default' : 'pointer',
                    minHeight: '60px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    transition: 'background-color 0.3s ease'
                  }}
                >
                  {field.text}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {/* TODO: Admin UI to add BingoFieldDefinitions e.g. a simple input and button */}
    </div>
  );
};

export default BingoGameManager; 