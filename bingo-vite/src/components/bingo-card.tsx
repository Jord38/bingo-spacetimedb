"use client"

import { cn } from "../lib/utils"

interface BingoCardProps {
    events: string[]
    selectedTiles: boolean[]
    onTileClick: (index: number) => void
}

export function BingoCard({ events, selectedTiles, onTileClick }: BingoCardProps) {
    return (
        <div className="grid grid-cols-5 gap-3 w-full max-w-4xl">
            {events.map((event, index) => (
                <button
                    key={index}
                    onClick={() => onTileClick(index)}
                    className={cn(
                        "aspect-square p-3 rounded-lg border text-center flex items-center justify-center transition-all duration-200",
                        "hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                        selectedTiles[index]
                            ? "bg-green-900/30 border-green-500 text-green-500 font-medium"
                            : "bg-card border-border hover:border-green-500/50",
                    )}
                >
                    <span className="text-sm sm:text-base">{event}</span>
                </button>
            ))}
        </div>
    )
}
