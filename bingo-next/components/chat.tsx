import React, { useEffect, useState, useMemo, useRef } from "react";
import { cn } from "../lib/utils";
import { useSession } from "next-auth/react";
import { useSpacetimeDB } from "@/contexts/SpacetimeDBContext";
import {
    Message,
    User,
    DbConnection,
    type EventContext,
    SystemMessage
} from "@/module_bindings";
import { Button } from "@/components/ui/button";

export type PrettyMessage = {
    type: 'user';
    id: string;
    senderSteamId: string;
    senderName: string;
    text: string;
    timestamp: Date;
    isSender: boolean;
}

export type SystemMessageItem = {
    type: 'system_db';
    id: string;
    text: string;
    timestamp: Date;
}

export type ChatItem = PrettyMessage | SystemMessageItem;

function useUserMessages(conn: DbConnection | null, connected: boolean, authenticatedWithBackend: boolean): Message[] {
    const [messages, setMessages] = useState<Message[]>([]);

    useEffect(() => {
        if (!conn || !connected || !authenticatedWithBackend) {
            setMessages([]);
            return;
        }

        const onInsert = (_ctx: EventContext, message: Message) => {
            setMessages(prev => [...prev, message].sort((a, b) => Number(a.sent) - Number(b.sent)));
        };
        conn.db.message.onInsert(onInsert);

        const onDelete = (_ctx: EventContext, message: Message) => {
            setMessages(prev =>
                prev.filter(
                    m => !(m.sender === message.sender && m.sent === message.sent && m.text === message.text)
                ).sort((a, b) => Number(a.sent) - Number(b.sent))
            );
        };
        conn.db.message.onDelete(onDelete);

        const initialMessages: Message[] = [];
        for (const msg of conn.db.message.iter()) {
            initialMessages.push(msg as Message);
        }
        setMessages(initialMessages.sort((a, b) => Number(a.sent) - Number(b.sent)));

        return () => {
            if (conn) {
                conn.db.message.removeOnInsert(onInsert);
                conn.db.message.removeOnDelete(onDelete);
            }
        };
    }, [conn, connected, authenticatedWithBackend]);

    return messages;
}

function useSystemMessages(conn: DbConnection | null, connected: boolean, authenticatedWithBackend: boolean): SystemMessage[] {
    const [systemMessages, setSystemMessages] = useState<SystemMessage[]>([]);

    useEffect(() => {
        if (!conn || !connected || !authenticatedWithBackend) {
            setSystemMessages([]);
            return;
        }

        const onInsert = (_ctx: EventContext, sysMsg: SystemMessage) => {
            setSystemMessages(prev => [...prev, sysMsg].sort((a, b) => Number(a.sent) - Number(b.sent)));
        };
        conn.db.systemMessage.onInsert(onInsert);

        const onDelete = (_ctx: EventContext, systemMessage: SystemMessage) => {
            setSystemMessages(prev =>
                prev.filter(
                    m => !(m.sent === systemMessage.sent && m.text === systemMessage.text)
                ).sort((a, b) => Number(a.sent) - Number(b.sent))
            );
        };
        conn.db.systemMessage.onDelete(onDelete);

        const initialMessages: SystemMessage[] = [];
        for (const msg of conn.db.message.iter()) {
            initialMessages.push(msg as SystemMessage);
        }
        setSystemMessages(initialMessages.sort((a, b) => Number(a.sent) - Number(b.sent)));

        return () => {
            if (conn) {
                conn.db.message.removeOnInsert(onInsert);
                conn.db.message.removeOnDelete(onDelete);
            }
        };
    }, [conn, connected, authenticatedWithBackend]);

    return systemMessages;
}

/*function useSystemMessagesFromDB(conn: DbConnection | null, connected: boolean, authenticatedWithBackend: boolean): DBSystemMessageItem[] {
    const [dbSystemMessages, setDbSystemMessages] = useState<DBSystemMessageItem[]>([]);

    useEffect(() => {
        if (!conn || !connected || !authenticatedWithBackend || !conn.db.system_message) {
            setDbSystemMessages([]);
            return;
        }

        const onInsert = (_ctx: EventContext, sysMsg: SystemMessageFromDB) => {
            setDbSystemMessages(prev => [...prev, {
                type: 'system_db',
                id: sysMsg.messageId.toString(),
                text: sysMsg.text,
                timestamp: sysMsg.timestamp.toDate(),
            }].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()));
        };
        conn.db.system_message.onInsert(onInsert);

        const initialSystemMessages: DBSystemMessageItem[] = [];
        for (const sysMsg of conn.db.system_message.iter()) {
            initialSystemMessages.push({
                type: 'system_db',
                id: sysMsg.messageId.toString(),
                text: sysMsg.text,
                timestamp: sysMsg.timestamp.toDate(),
            } as DBSystemMessageItem);
        }
        setDbSystemMessages(initialSystemMessages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()));

        return () => {
            if (conn && conn.db.system_message) {
                conn.db.system_message.removeOnInsert(onInsert);
            }
        };
    }, [conn, connected, authenticatedWithBackend]);

    return dbSystemMessages;
}*/

function useUsers(conn: DbConnection | null, connected: boolean, authenticatedWithBackend: boolean): Map<string, User> {
    const [users, setUsers] = useState<Map<string, User>>(new Map());

    useEffect(() => {
        if (!conn || !connected || !authenticatedWithBackend) {
            setUsers(new Map());
            return;
        }

        const onInsert = (_ctx: EventContext, user: User) => {
            setUsers(prev => new Map(prev.set(user.steamId, user)));
        };
        conn.db.user.onInsert(onInsert);

        const onUpdate = (_ctx: EventContext, _oldUser: User, newUser: User) => {
            setUsers(prev => new Map(prev.set(newUser.steamId, newUser)));
        };
        conn.db.user.onUpdate(onUpdate);

        const onDelete = (_ctx: EventContext, user: User) => {
            setUsers(prev => {
                const next = new Map(prev);
                next.delete(user.steamId);
                return next;
            });
        };
        conn.db.user.onDelete(onDelete);
        
        const initialUserMap = new Map<string, User>();
        for (const u of conn.db.user.iter()) {
            initialUserMap.set(u.steamId, u as User);
        }
        setUsers(initialUserMap);

        return () => {
            if (conn) {
                conn.db.user.removeOnInsert(onInsert);
                conn.db.user.removeOnUpdate(onUpdate);
                conn.db.user.removeOnDelete(onDelete);
            }
        };
    }, [conn, connected, authenticatedWithBackend]);

    return users;
}

export function Chat() {
    const { data: session } = useSession();
    const currentUserSteamId = (session?.user as { steamId?: string })?.steamId;

    const { connRef, connected, authenticatedWithBackend, error: dbError, subscribeToQueries } = useSpacetimeDB();
    const conn = connRef.current;

    const [newName, setNewName] = useState("");
    const [settingName, setSettingName] = useState(false);
    const [newMessage, setNewMessage] = useState("");

    useEffect(() => {
        if (conn && connected && authenticatedWithBackend) {
            console.log("Chat: Subscribing to SpacetimeDB queries (message, user, system_message).");
            subscribeToQueries([
                'SELECT * FROM message', 
                'SELECT * FROM user',
                'SELECT * FROM system_message'
            ]);
        }
    }, [conn, connected, authenticatedWithBackend, subscribeToQueries]);

    const userChatMessages = useUserMessages(conn, connected, authenticatedWithBackend);
    const allUsers = useUsers(conn, connected, authenticatedWithBackend);
    const systemMessages = useSystemMessages(conn, connected, authenticatedWithBackend);

    const messageListRef = useRef<HTMLDivElement>(null);

    const currentUserName = useMemo(() => {
        if (!currentUserSteamId) return "Guest";
        return allUsers.get(currentUserSteamId)?.name || currentUserSteamId.substring(0, 8) || "User";
    }, [currentUserSteamId, allUsers]);

    const prettyUserMessages: PrettyMessage[] = useMemo(() => {
        return userChatMessages
            .map((message, index) => {
                const senderUser = allUsers.get(message.sender);
                const senderName = senderUser?.name || message.sender.substring(0, 8) || "Unknown User";
                return {
                    type: 'user',
                    id: `${message.sender}-${message.sent.toString()}-${index}`,
                    senderSteamId: message.sender,
                    senderName: senderName,
                    text: message.text,
                    timestamp: message.sent.toDate(),
                    isSender: message.sender === currentUserSteamId,
                };
            });
    }, [userChatMessages, allUsers, currentUserSteamId]);

    const prettySystemMessages: SystemMessageItem[] = useMemo(() => {
        return systemMessages
            .map((message, index) => {
                return {
                    type: 'system_db',
                    id: `${message.sent.toString()}-${index}`,
                    text: message.text,
                    timestamp: message.sent.toDate()
                };
            });
    }, [systemMessages, allUsers, currentUserSteamId]);

    useEffect(() => {
        if (!conn || !connected || !authenticatedWithBackend || !conn.db.user) return;

        const handleUserOnlineChange = (user: User, onlineStatus: "connected" | "disconnected") => {
            /*const name = user.name || user.steamId?.substring(0, 8) || "A user";
            conn.reducers.sendSystemMessage(`${name} has ${onlineStatus}.`);*/
        };

        const onUserInsert = (_ctx: EventContext, user: User) => {
            /*if (user.online && user.steamId !== currentUserSteamId) {
                 handleUserOnlineChange(user, "connected");
            }*/
        };

        const onUserUpdate = (_ctx: EventContext, oldUser: User, newUser: User) => {
            /*if (oldUser.online !== newUser.online) {
                 handleUserOnlineChange(newUser, newUser.online ? "connected" : "disconnected");
            }
            if (oldUser.name !== newUser.name) {
                const oldDisplayName = oldUser.name || oldUser.steamId?.substring(0, 8) || "User";
                const newDisplayName = newUser.name || newUser.steamId?.substring(0, 8) || "User";
                if (oldUser.name && newUser.name) {
                    conn.reducers.sendSystemMessage(`${oldDisplayName} changed their name to ${newDisplayName}.`);
                } else if (!oldUser.name && newUser.name) {
                    conn.reducers.sendSystemMessage(`${newDisplayName} (Steam Name) set as name.`);
                }
            }*/
        };

        conn.db.user.onInsert(onUserInsert);
        conn.db.user.onUpdate(onUserUpdate);

        return () => {
            if (conn && conn.db.user) {
                conn.db.user.removeOnInsert(onUserInsert);
                conn.db.user.removeOnUpdate(onUserUpdate);
            }
        };
    }, [conn, connected, authenticatedWithBackend, currentUserSteamId]);

    const displayedChatItems: ChatItem[] = useMemo(() => {
        const combined: ChatItem[] = [
            ...prettyUserMessages,
            ...prettySystemMessages
        ];
        return combined.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    }, [prettyUserMessages, prettySystemMessages]);

    useEffect(() => {
        if (messageListRef.current) {
            messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
        }
    }, [displayedChatItems]);

    if (dbError) {
        return <div className="App p-4"><h1 className="text-red-500">SpacetimeDB Error:</h1><p>{dbError}</p></div>;
    }
    
    if (!connected || !authenticatedWithBackend) {
        return <div className="App p-4"><h1>Connecting to Chat & Authenticating...</h1><p>Please wait.</p></div>;
    }

    const onSubmitNewName = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!conn || !newName.trim()) return;
        setSettingName(false);
        try {
            conn.reducers.setName(newName);
        } catch (err: any) {
            console.error("Error calling setName reducer:", err);
        }
    };

    const onMessageSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!conn || !newMessage.trim()) return;
        try {
            conn.reducers.sendMessage(newMessage);
            setNewMessage("");
        } catch (err: any) {
            console.error("Error calling sendMessage reducer:", err);
        }
    };

    return (
        <div className="chat-container h-full grid grid-rows-[auto_1fr_auto] bg-background text-foreground gap-0">
            <div className="profile border-b border-border p-4 flex items-center gap-4">
                <h2 className="text-lg font-semibold mr-auto">Profile</h2>
                {!settingName ? (
                    <>
                        <p className="text-sm">{currentUserName}</p>
                        <Button
                            onClick={() => {
                                setSettingName(true);
                                setNewName(allUsers.get(currentUserSteamId!)?.name || currentUserSteamId?.substring(0,8) || "");
                            }}
                            className="bg-primary text-primary-foreground hover:bg-primary/90 px-3 py-1.5 rounded-md text-sm font-medium"
                            disabled={!conn}
                        >
                            Edit Name
                        </Button>
                    </>
                ) : (
                    <form onSubmit={onSubmitNewName} className="flex items-center gap-2 flex-grow max-w-xs">
                        <input
                            type="text"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            className="flex-grow w-full bg-input border border-border rounded-md px-3 py-1.5 text-sm"
                            placeholder="Enter new name"
                        />
                        <Button
                            type="submit"
                            className="bg-primary text-primary-foreground hover:bg-primary/90 px-3 py-1.5 rounded-md text-sm font-medium"
                            disabled={!conn}
                        >
                            Submit
                        </Button>
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setSettingName(false)}
                            disabled={!conn}
                        >
                            Cancel
                        </Button>
                    </form>
                )}
            </div>

            <div className="chat-content overflow-y-auto min-h-0" ref={messageListRef}>
                <div className="message-list p-4 flex flex-col gap-4" role="log">
                    <h2 className="text-lg font-semibold sr-only">Messages</h2>
                    {displayedChatItems.length < 1 && <p className="text-muted-foreground">No messages yet. Be the first to chat!</p>}
                    <div className="space-y-2">
                        {displayedChatItems.map((item) => {
                            if (item.type === 'user') {
                                return (
                                    <div
                                        key={item.id}
                                        className={cn(
                                            "p-3 rounded-lg max-w-[80%] break-words",
                                            item.isSender
                                                ? "bg-primary/20 border border-primary/30 ml-auto text-right"
                                                : "bg-muted border border-border text-left"
                                        )}
                                    >
                                        <p className={cn("font-semibold text-sm", item.isSender ? "text-primary" : "text-muted-foreground")}>
                                            {item.senderName}
                                        </p>
                                        <p className="mt-1 whitespace-pre-wrap">{item.text}</p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {item.timestamp.toLocaleString()} 
                                        </p>
                                    </div>
                                );
                            } else if (item.type === 'system_db') {
                                return (
                                    <div key={item.id} className="text-center my-1 py-1">
                                        <p className="text-xs text-muted-foreground italic px-2 py-0.5 bg-background border border-border rounded-md inline-block">
                                            {item.text}
                                        </p>
                                    </div>
                                );
                            }
                            return null;
                        })}
                    </div>
                </div>
            </div>

            <div className="new-message-form border-t border-border p-4">
                <form onSubmit={onMessageSubmit} className="mx-auto max-w-2xl w-full flex flex-col gap-2">
                    <label htmlFor="newMessageTextarea" className="text-sm font-medium">New Message as {currentUserName}</label>
                    <textarea
                        id="newMessageTextarea"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        className="w-full min-h-[80px] bg-input border border-border rounded-md p-3 font-mono resize-y text-sm"
                        placeholder={`Type your message...`}
                        rows={3}
                        aria-label={`Chat input as ${currentUserName}`}
                    ></textarea>
                    <Button
                        type="submit"
                        disabled={!conn || !newMessage.trim() || !connected || !authenticatedWithBackend}
                        className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 px-4 py-2 rounded-md font-medium"
                    >
                        Send
                    </Button>
                </form>
            </div>
        </div>
    );
}
