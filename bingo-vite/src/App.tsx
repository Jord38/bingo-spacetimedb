"use client"

import { useState, useEffect } from "react"
import { SidebarProvider } from "./components/ui/sidebar"
import { AppSidebar } from "./components/app-sidebar"
import { SidebarInset, SidebarTrigger } from "./components/ui/sidebar"
import { Button } from "./components/ui/button"
import { BingoCard } from "./components/bingo-card"
import { Confetti } from "./components/confetti"
import {Chat} from "@/components/chat.tsx";

const bingoEvents = [
  "Jeanot falls off his chair",
  "Someone spills their drink",
  "Network connection drops",
  "Someone rage quits",
  "Unexpected visitor",
  "Oma belt",
  "Bo gaat vroeg slapen",
  "Ogremaxes",
  "Mentions going outside",
  "Random squeaks or wheezing laughter",
  "Sends or plays bad music",
  "Invited to or going to a party",
  "Laughs at own jokes",
  "Empty threats",
  "Rolling weed, smoking weed, discussing weed, recounting weed related tales",
  "Talks about murdering random people who are not present or relevant",
  "Complains about work",
  "Dity balls",
  "Complaining about friends",
  "FREE SPACE (Superiority complex)",
  "Ben and jerry's",
  "Mentioning leg day",
  "Complaining about malik",
  "Brother walks into house and causes mayhem",
  "Waffling",
  "Accepting a phone call and not muting himself",
  "Mentions going out with girls",
  "Photoshops himself",
  "Thinking a statement or insult is meant for him when it clearly is not",
  "Ordering food",
  "I loved her",
  "Swimming",
  "Jeanot gaat eerder naar huis",
  "Jeanot trekt zijn shirt uit",
  "Internet doet het niet",
  "Iemand kotst",
  "Bo vangt geen vis",
  "Jeanot crasht hard tijdens karten",
  "Boyd auto start niet meer",
  "Najib yapt tegen random mensen die niet naar hem luisteren",
  "We kunnen geen game spelen omdat altijd een iemand tegen is",
  "Vuur scheet",
  "Jord laat zijn ballen zien",
  "Iemand doet de stekkerdoos uit met voet",
  "FREE SPACE (Violated WC)",
  "Bier op de vloer",
  "Lek luchtbed",
  "Ass flash",
  "Boyd eet zijn bord niet op",
  "Wiet",
  "Iemand gaat blackout dronken",
  "Vernieling van openbare eigendommen",
  "Hengel in boom",
  "Iemand beschijt zich",
]

function App() {
  const [events, setEvents] = useState<string[]>([])
  const [selectedTiles, setSelectedTiles] = useState<boolean[]>([])
  const [hasBingo, setHasBingo] = useState(false)

  // Initialize the bingo card with random events
  useEffect(() => {
    // Shuffle and select 25 events (or fewer if not enough events)
    const shuffled = [...bingoEvents].sort(() => 0.5 - Math.random())
    const selected = shuffled.slice(0, 25)

    // If we have fewer than 25 events, fill the rest with placeholders
    while (selected.length < 25) {
      selected.push(`Event ${selected.length + 1}`)
    }

    setEvents(selected)
    setSelectedTiles(new Array(25).fill(false))
  }, [])

  // Check for bingo when tiles are selected
  useEffect(() => {
    if (selectedTiles.length === 0) return

    const checkBingo = () => {
      const size = 5

      // Check rows
      for (let i = 0; i < size; i++) {
        let rowBingo = true
        for (let j = 0; j < size; j++) {
          if (!selectedTiles[i * size + j]) {
            rowBingo = false
            break
          }
        }
        if (rowBingo) return true
      }

      // Check columns
      for (let i = 0; i < size; i++) {
        let colBingo = true
        for (let j = 0; j < size; j++) {
          if (!selectedTiles[j * size + i]) {
            colBingo = false
            break
          }
        }
        if (colBingo) return true
      }

      // Check diagonals
      let diag1 = true
      let diag2 = true
      for (let i = 0; i < size; i++) {
        if (!selectedTiles[i * size + i]) {
          diag1 = false
        }
        if (!selectedTiles[i * size + (size - 1 - i)]) {
          diag2 = false
        }
      }

      return diag1 || diag2
    }

    setHasBingo(checkBingo())
  }, [selectedTiles])

  const toggleTile = (index: number) => {
    const newSelectedTiles = [...selectedTiles]
    newSelectedTiles[index] = !newSelectedTiles[index]
    setSelectedTiles(newSelectedTiles)
  }

  const resetCard = () => {
    // Shuffle and select 25 events again
    const shuffled = [...bingoEvents].sort(() => 0.5 - Math.random())
    const selected = shuffled.slice(0, 25)

    // If we have fewer than 25 events, fill the rest with placeholders
    while (selected.length < 25) {
      selected.push(`Event ${selected.length + 1}`)
    }

    setEvents(selected)
    setSelectedTiles(new Array(25).fill(false))
    setHasBingo(false)
  }

  return (
      <SidebarProvider>
        <div className="flex h-screen">
          <AppSidebar />
          <SidebarInset>
            <div className="flex flex-col h-full">
              <header className="flex h-14 items-center gap-4 border-b bg-muted/40 px-6">
                <SidebarTrigger />
                <h1 className="text-xl font-semibold">Jb's Bingo</h1>
              </header>
              <main className="flex-1 grid grid-cols-1 lg:grid-cols-4 overflow-hidden">
                {/* Bingo Card Section */}
                <div className="col-span-1 lg:col-span-3 p-4 flex flex-col items-center overflow-auto">
                  {hasBingo && <Confetti />}

                  <div className="mb-6 flex justify-between w-full max-w-3xl">
                    <h2 className="text-2xl font-bold">{hasBingo ? "BINGO! 🎉" : "Mark events as they happen"}</h2>
                    <Button onClick={resetCard} variant="outline">
                      New Card
                    </Button>
                  </div>

                  <BingoCard events={events} selectedTiles={selectedTiles} onTileClick={toggleTile} />
                </div>

                {/* Chat Section */}
                <div className="col-span-1 border-l border-green-500/30 flex flex-col h-full overflow-hidden">
                  <Chat />
                </div>
              </main>
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
  )
}

export default App
