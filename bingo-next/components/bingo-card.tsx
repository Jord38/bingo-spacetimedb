import { cn } from "../lib/utils"
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useSpacetimeDB } from '@/contexts/SpacetimeDBContext';
import { useSession } from 'next-auth/react';
import {
    GameSession,
    PlayerBingoCard,
    BingoFieldDefinition,
    EventContext,
} from '@/module_bindings';
import {Confetti} from "@/components/confetti";

export function BingoCard() {
    const { connRef, connected, authenticatedWithBackend, subscribeToQueries } = useSpacetimeDB();
    const { data: session } = useSession();

    const [activeGameId, setActiveGameId] = useState<number | null>(null);
    const [allGameSessions, setAllGameSessions] = useState<GameSession[]>([]);
    const [playerCardDetails, setPlayerCardDetails] = useState<PlayerBingoCard | null>(null);
    const [bingoFields, setBingoFields] = useState<BingoFieldDefinition[]>([]);

    const steamId = useMemo(() => (session?.user as { steamId?: string })?.steamId, [session]);

    const loadInitialGameSessions = useCallback(() => {
        if (connRef.current?.db?.gameSessions) {
            const sessions = Array.from(connRef.current.db.gameSessions.iter()) as GameSession[];
            setAllGameSessions(sessions);
        }
    }, [connRef]);

    const refreshPlayerCard = useCallback(() => {
        if (connRef.current?.db?.playerBingoCards && steamId && activeGameId) {
            const cardId = `${steamId}_${activeGameId}`;
            console.log(`[refreshPlayerCard] Attempting to find card with ID: ${cardId}`);
            const card = connRef.current.db.playerBingoCards.cardId.find(cardId);
            setPlayerCardDetails(card || null);
            if (card) {
                console.log("[refreshPlayerCard] Player card found:", card);
            } else {
                console.log("[refreshPlayerCard] No player card found for active game.");
            }
        } else {
            setPlayerCardDetails(null);
        }
    }, [connRef, steamId, activeGameId]);

    const refreshBingoFields = useCallback(() => {
        if (connRef.current?.db?.bingoFieldDefinitions) {
            setBingoFields(Array.from(connRef.current.db.bingoFieldDefinitions.iter()) as BingoFieldDefinition[]);
        }
    }, [connRef]);

    useEffect(() => {
        if (connected && authenticatedWithBackend && connRef.current?.db) {
            subscribeToQueries([
                "SELECT * FROM GameSessions",
                "SELECT * FROM BingoFieldDefinitions",
                "SELECT * FROM PlayerBingoCards",
            ]);

            loadInitialGameSessions();
            refreshBingoFields();

            const gsHandle = connRef.current.db.gameSessions;
            const pbcHandle = connRef.current.db.playerBingoCards;
            const bfdHandle = connRef.current.db.bingoFieldDefinitions;

            const gsOnInsertCb = (_ctx: EventContext | undefined, session: GameSession) => {
                setAllGameSessions(prevSessions => {
                    const newSessions = prevSessions.filter(s => s.gameId !== session.gameId);
                    newSessions.push(session);
                    return newSessions;
                });
            };
            const gsOnUpdateCb = (_ctx: EventContext | undefined, newSession: GameSession, _oldSession: GameSession | undefined) => {
                setAllGameSessions(prevSessions => 
                    prevSessions.map(s => s.gameId === newSession.gameId ? newSession : s)
                );
            };
            const gsOnDeleteCb = (_ctx: EventContext | undefined, oldSession: GameSession) => {
                setAllGameSessions(prevSessions => prevSessions.filter(s => s.gameId !== oldSession.gameId));
            };

            if (gsHandle) {
                gsHandle.onInsert(gsOnInsertCb);
                gsHandle.onUpdate(gsOnUpdateCb);
                gsHandle.onDelete(gsOnDeleteCb);
            }
            if (pbcHandle) {
                pbcHandle.onInsert(refreshPlayerCard); pbcHandle.onUpdate(refreshPlayerCard); pbcHandle.onDelete(refreshPlayerCard);
            }
            if (bfdHandle) {
                bfdHandle.onInsert(refreshBingoFields); bfdHandle.onUpdate(refreshBingoFields); bfdHandle.onDelete(refreshBingoFields);
            }
            
            return () => {
                if (gsHandle) {
                    gsHandle.removeOnInsert(gsOnInsertCb);
                    gsHandle.removeOnUpdate(gsOnUpdateCb);
                    gsHandle.removeOnDelete(gsOnDeleteCb);
                }
                if (pbcHandle) {
                    pbcHandle.removeOnInsert(refreshPlayerCard); pbcHandle.removeOnUpdate(refreshPlayerCard); pbcHandle.removeOnDelete(refreshPlayerCard);
                }
                if (bfdHandle) {
                    bfdHandle.removeOnInsert(refreshBingoFields); bfdHandle.removeOnUpdate(refreshBingoFields); bfdHandle.removeOnDelete(refreshBingoFields);
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
    ]);

    useEffect(() => {
        const active = allGameSessions.find(s => s.isActive);
        const newActiveGameId = active ? active.gameId : null;
        if (newActiveGameId !== activeGameId) {
            setActiveGameId(newActiveGameId);
            console.log("[useEffect allGameSessions] Active game ID updated to:", newActiveGameId);
        }
    }, [allGameSessions, activeGameId]);

    useEffect(() => {
        if (connected && authenticatedWithBackend && steamId && activeGameId) {
            refreshPlayerCard();
        }
    }, [connected, authenticatedWithBackend, steamId, activeGameId, refreshPlayerCard]);

    useEffect(() => {
        if (
            connected &&
            authenticatedWithBackend &&
            connRef.current?.reducers &&
            steamId &&
            activeGameId !== null &&
            playerCardDetails === null
        ) {
            console.log(`[AutoCardRequest] Conditions met. Requesting card for game ${activeGameId}, user ${steamId}.`);
            try {
                connRef.current.reducers.requestNewBingoCard(activeGameId);
                console.log("[AutoCardRequest] requestNewBingoCard reducer called.");
            } catch (e) {
                console.error("[AutoCardRequest] Error calling requestNewBingoCard:", e);
            }
        }
    }, [connected, authenticatedWithBackend, connRef, steamId, activeGameId, playerCardDetails]);

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
            return fieldDef ? { 
                id: fieldDef.fieldId, 
                text: fieldDef.text, 
                isMarked: typeof fieldDef.isMarked === 'boolean' ? fieldDef.isMarked : false
            } : null;
        }).filter(Boolean) as { id: number; text: string; isMarked: boolean }[];
    }, [playerCardDetails, bingoFields]);

    if (!connected || !authenticatedWithBackend) {
        return <div className="flex justify-center items-center h-full"><p>Connecting to SpacetimeDB and authenticating...</p></div>;
    }

    return (playerCardDetails && cardFieldsToDisplay.length > 0 && (
        <>
                <div className="grid grid-cols-5 gap-3 w-full max-w-3xl 3xl:max-w-4xl">
                    {cardFieldsToDisplay.map(field => field && (
                        <button
                            key={field.id}
                            onClick={() => handleMarkField(field.id)}
                            className={cn(
                                "aspect-square p-2 sm:p-3 rounded-lg border text-center flex items-center justify-center transition-all duration-200 text-xs sm:text-sm md:text-base break-all",
                                "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 hover:cursor-pointer",
                                field.isMarked
                                    ? "bg-green-700/60 border-green-500 text-white font-medium shadow-inner"
                                    : "bg-card border-border hover:border-green-500/50 hover:bg-accent/50 shadow-sm hover:shadow-md",
                            )}
                        >
                            {field.text}
                        </button>
                    ))}
                </div>
        </>
            )
    );
}
