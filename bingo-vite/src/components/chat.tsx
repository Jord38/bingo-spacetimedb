import React, {useEffect, useState} from "react"
import { cn } from "../lib/utils"
import {DbConnection, type ErrorContext, type EventContext, Message, User} from "@/module_bindings";
import {Identity, type Timestamp} from '@clockworklabs/spacetimedb-sdk';

export type PrettyMessage = {
    senderName: string;
    text: string;
    sent: Timestamp;
}

function useMessages(conn: DbConnection | null): Message[] {
    const [messages, setMessages] = useState<Message[]>([]);

    useEffect(() => {
        if (!conn) return;
        const onInsert = (_ctx: EventContext, message: Message) => {
            setMessages(prev => [...prev, message]);
        };
        conn.db.message.onInsert(onInsert);

        const onDelete = (_ctx: EventContext, message: Message) => {
            setMessages(prev =>
                prev.filter(
                    m =>
                        m.text !== message.text &&
                        m.sent !== message.sent &&
                        m.sender !== message.sender
                )
            );
        };
        conn.db.message.onDelete(onDelete);

        return () => {
            conn.db.message.removeOnInsert(onInsert);
            conn.db.message.removeOnDelete(onDelete);
        };
    }, [conn]);

    return messages;
}

function useUsers(conn: DbConnection | null): Map<string, User> {
    const [users, setUsers] = useState<Map<string, User>>(new Map());

    useEffect(() => {
        if (!conn) return;
        const onInsert = (_ctx: EventContext, user: User) => {
            setUsers(prev => new Map(prev.set(user.identity.toHexString(), user)));
        };
        conn.db.user.onInsert(onInsert);

        const onUpdate = (_ctx: EventContext, oldUser: User, newUser: User) => {
            setUsers(prev => {
                prev.delete(oldUser.identity.toHexString());
                return new Map(prev.set(newUser.identity.toHexString(), newUser));
            });
        };
        conn.db.user.onUpdate(onUpdate);

        const onDelete = (_ctx: EventContext, user: User) => {
            setUsers(prev => {
                prev.delete(user.identity.toHexString());
                return new Map(prev);
            });
        };
        conn.db.user.onDelete(onDelete);

        return () => {
            conn.db.user.removeOnInsert(onInsert);
            conn.db.user.removeOnUpdate(onUpdate);
            conn.db.user.removeOnDelete(onDelete);
        };
    }, [conn]);

    return users;
}

export function Chat() {
    const [newName, setNewName] = useState("")
    const [settingName, setSettingName] = useState(false)
    const [systemMessage, setSystemMessage] = useState("")
    const [newMessage, setNewMessage] = useState("")

    const [connected, setConnected] = useState<boolean>(false);
    const [identity, setIdentity] = useState<Identity | null>(null);
    const [conn, setConn] = useState<DbConnection | null>(null);

    useEffect(() => {
        const subscribeToQueries = (conn: DbConnection, queries: string[]) => {
            let count = 0;
            for (const query of queries) {
                conn
                    ?.subscriptionBuilder()
                    .onApplied(() => {
                        count++;
                        if (count === queries.length) {
                            console.log('SDK client cache initialized.');
                        }
                    })
                    .subscribe(query);
            }
        };

        const onConnect = (
            conn: DbConnection,
            identity: Identity,
            token: string
        ) => {
            setIdentity(identity);
            setConnected(true);
            localStorage.setItem('auth_token', token);
            console.log(
                'Connected to SpacetimeDB with identity:',
                identity.toHexString()
            );
            conn.reducers.onSendMessage(() => {
                console.log('Message sent.');
            });

            subscribeToQueries(conn, ['SELECT * FROM message', 'SELECT * FROM user']);
        };

        const onDisconnect = () => {
            console.log('Disconnected from SpacetimeDB');
            setConnected(false);
        };

        const onConnectError = (_ctx: ErrorContext, err: Error) => {
            console.log('Error connecting to SpacetimeDB:', err);
        };

        setConn(
            DbConnection.builder()
                .withUri('ws://localhost:3000')
                .withModuleName('bingo-spacetimedb')
                .withToken(localStorage.getItem('auth_token') || '')
                .onConnect(onConnect)
                .onDisconnect(onDisconnect)
                .onConnectError(onConnectError)
                .build()
        );
    }, []);

    useEffect(() => {
        if (!conn) return;
        conn.db.user.onInsert((_ctx, user) => {
            if (user.online) {
                const name = user.name || user.identity.toHexString().substring(0, 8);
                setSystemMessage(prev => prev + `\n${name} has connected.`);
            }
        });
        conn.db.user.onUpdate((_ctx, oldUser, newUser) => {
            const name =
                newUser.name || newUser.identity.toHexString().substring(0, 8);
            if (oldUser.online === false && newUser.online === true) {
                setSystemMessage(prev => prev + `\n${name} has connected.`);
            } else if (oldUser.online === true && newUser.online === false) {
                setSystemMessage(prev => prev + `\n${name} has disconnected.`);
            }
        });
    }, [conn]);

    const messages = useMessages(conn);
    const users = useUsers(conn);

    const prettyMessages: PrettyMessage[] = messages
        .sort((a, b) => (a.sent > b.sent ? 1 : -1))
        .map(message => ({
            senderName:
                users.get(message.sender.toHexString())?.name ||
                message.sender.toHexString().substring(0, 8),
            text: message.text,
            sent: message.sent,
        }));

    const name =
        users.get(identity?.toHexString())?.name ||
        identity?.toHexString().substring(0, 8) ||
        'unknown';

    if (!conn || !connected || !identity) {
        return (
            <div className="App">
                <h1>Connecting...</h1>
            </div>
        );
    }

    const onSubmitNewName = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setSettingName(false);
        conn.reducers.setName(newName);
    };

    const onMessageSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setNewMessage("");
        conn.reducers.sendMessage(newMessage);
    };

    return (
        <div className="chat-container h-full flex flex-col">
            <div className="profile border-b border-green-500/30 p-4 flex items-center gap-4">
                <h2 className="text-lg font-semibold mr-auto">Profile</h2>
                {!settingName ? (
                    <>
                        <p>{name}</p>
                        <button
                            onClick={() => {
                                setSettingName(true)
                                setNewName(name)
                            }}
                            className="bg-green-600 text-green-950 hover:bg-green-500 px-3 py-1.5 rounded-md text-sm font-medium"
                        >
                            Edit Name
                        </button>
                    </>
                ) : (
                    <form onSubmit={onSubmitNewName} className="flex items-center gap-2 flex-grow max-w-xs">
                        <input
                            type="text"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            className="flex-grow bg-green-950/30 border border-green-500/30 rounded-md px-3 py-1.5"
                        />
                        <button
                            type="submit"
                            className="bg-green-600 text-green-950 hover:bg-green-500 px-3 py-1.5 rounded-md text-sm font-medium"
                        >
                            Submit
                        </button>
                    </form>
                )}
            </div>

            <div className="chat-content flex-grow grid grid-cols-3 overflow-hidden">
                <div className="message col-span-2 overflow-y-auto p-4 flex flex-col gap-4">
                    <h2 className="text-lg font-semibold">Messages</h2>
                    {prettyMessages.length < 1 && <p className="text-muted-foreground">No messages</p>}
                    <div className="space-y-4">
                        {prettyMessages.map((message, key) => (
                            <div
                                key={key}
                                className={cn(
                                    "p-3 rounded-lg max-w-[80%]",
                                    message.senderName === name
                                        ? "bg-green-900/20 border border-green-500/30 ml-auto"
                                        : "bg-muted border border-border"
                                )}
                            >
                                <p className="font-semibold text-sm">{message.senderName}</p>
                                <p className="mt-1">{message.text}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {message.sent.toDate().toLocaleString()}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="system col-span-1 overflow-y-auto p-4 border-l border-green-500/30">
                    <h2 className="text-lg font-semibold">System</h2>
                    <div className="mt-4">
                        <p className="font-mono text-sm whitespace-pre-wrap">{systemMessage}</p>
                    </div>
                </div>
            </div>

            <div className="new-message border-t border-green-500/30 p-4">
                <form onSubmit={onMessageSubmit} className="mx-auto max-w-2xl w-full flex flex-col gap-2">
                    <h3 className="text-sm font-medium">New Message</h3>
                    <textarea
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        className="w-full min-h-[80px] bg-green-950/30 border border-green-500/30 rounded-md p-3 font-mono resize-y"
                    ></textarea>
                    <button
                        type="submit"
                        className="bg-green-600 text-green-950 hover:bg-green-500 px-4 py-2 rounded-md font-medium"
                    >
                        Send
                    </button>
                </form>
            </div>
        </div>
    )
}
