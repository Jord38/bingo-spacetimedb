"use client"

import { useEffect, useState } from "react"
import ReactConfetti from "react-confetti"

export function Confetti() {
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
    const [isActive, setIsActive] = useState(true)

    useEffect(() => {
        // Set dimensions
        setDimensions({
            width: window.innerWidth,
            height: window.innerHeight,
        })

        // Add resize listener
        const handleResize = () => {
            setDimensions({
                width: window.innerWidth,
                height: window.innerHeight,
            })
        }

        window.addEventListener("resize", handleResize)

        // Auto-disable confetti after 5 seconds
        const timer = setTimeout(() => {
            setIsActive(false)
        }, 5000)

        return () => {
            window.removeEventListener("resize", handleResize)
            clearTimeout(timer)
        }
    }, [])

    if (!isActive) return null

    return (
        <ReactConfetti
            width={dimensions.width}
            height={dimensions.height}
            recycle={false}
            numberOfPieces={500}
            gravity={0.2}
        />
    )
}
