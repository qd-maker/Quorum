import { useEffect, useRef, useState } from 'react'

type Pointer = {
    x: number
    y: number
}

interface PupilProps {
    pointer: Pointer
    size?: number
    maxDistance?: number
    pupilColor?: string
    forceLookX?: number
    forceLookY?: number
}

const bodyTransition = 'transform 900ms cubic-bezier(0.22, 1, 0.36, 1), height 900ms cubic-bezier(0.22, 1, 0.36, 1)'
const faceTransition = 'left 720ms cubic-bezier(0.22, 1, 0.36, 1), top 720ms cubic-bezier(0.22, 1, 0.36, 1)'
const eyeTransition = 'transform 180ms cubic-bezier(0.22, 1, 0.36, 1)'

function Pupil({
    pointer,
    size = 12,
    maxDistance = 5,
    pupilColor = 'black',
    forceLookX,
    forceLookY,
}: PupilProps) {
    const pupilRef = useRef<HTMLDivElement>(null)

    const calculatePupilPosition = () => {
        if (!pupilRef.current) return { x: 0, y: 0 }

        if (forceLookX !== undefined && forceLookY !== undefined) {
            return { x: forceLookX, y: forceLookY }
        }

        const pupil = pupilRef.current.getBoundingClientRect()
        const pupilCenterX = pupil.left + pupil.width / 2
        const pupilCenterY = pupil.top + pupil.height / 2
        const deltaX = pointer.x - pupilCenterX
        const deltaY = pointer.y - pupilCenterY
        const distance = Math.min(Math.sqrt(deltaX ** 2 + deltaY ** 2), maxDistance)
        const angle = Math.atan2(deltaY, deltaX)

        return {
            x: Math.cos(angle) * distance,
            y: Math.sin(angle) * distance,
        }
    }

    const pupilPosition = calculatePupilPosition()

    return (
        <div
            ref={pupilRef}
            className="rounded-full"
            style={{
                width: `${size}px`,
                height: `${size}px`,
                backgroundColor: pupilColor,
                transform: `translate3d(${pupilPosition.x}px, ${pupilPosition.y}px, 0)`,
                transition: eyeTransition,
                willChange: 'transform',
            }}
        />
    )
}

interface EyeBallProps {
    pointer: Pointer
    size?: number
    pupilSize?: number
    maxDistance?: number
    eyeColor?: string
    pupilColor?: string
    isBlinking?: boolean
    forceLookX?: number
    forceLookY?: number
}

function EyeBall({
    pointer,
    size = 48,
    pupilSize = 16,
    maxDistance = 10,
    eyeColor = 'white',
    pupilColor = 'black',
    isBlinking = false,
    forceLookX,
    forceLookY,
}: EyeBallProps) {
    const eyeRef = useRef<HTMLDivElement>(null)

    const calculatePupilPosition = () => {
        if (!eyeRef.current) return { x: 0, y: 0 }

        if (forceLookX !== undefined && forceLookY !== undefined) {
            return { x: forceLookX, y: forceLookY }
        }

        const eye = eyeRef.current.getBoundingClientRect()
        const eyeCenterX = eye.left + eye.width / 2
        const eyeCenterY = eye.top + eye.height / 2
        const deltaX = pointer.x - eyeCenterX
        const deltaY = pointer.y - eyeCenterY
        const distance = Math.min(Math.sqrt(deltaX ** 2 + deltaY ** 2), maxDistance)
        const angle = Math.atan2(deltaY, deltaX)

        return {
            x: Math.cos(angle) * distance,
            y: Math.sin(angle) * distance,
        }
    }

    const pupilPosition = calculatePupilPosition()

    return (
        <div
            ref={eyeRef}
            className="rounded-full flex items-center justify-center"
            style={{
                width: `${size}px`,
                height: isBlinking ? '2px' : `${size}px`,
                backgroundColor: eyeColor,
                overflow: 'hidden',
                transition: 'height 160ms ease-out, width 160ms ease-out',
                willChange: 'height',
            }}
        >
            {!isBlinking && (
                <div
                    className="rounded-full"
                    style={{
                        width: `${pupilSize}px`,
                        height: `${pupilSize}px`,
                        backgroundColor: pupilColor,
                        transform: `translate3d(${pupilPosition.x}px, ${pupilPosition.y}px, 0)`,
                        transition: eyeTransition,
                        willChange: 'transform',
                    }}
                />
            )}
        </div>
    )
}

interface AuthMascotsProps {
    isTyping?: boolean
    showPassword?: boolean
    passwordLength?: number
}

export default function AuthMascots({
    isTyping = false,
    showPassword = false,
    passwordLength = 0,
}: AuthMascotsProps) {
    const [pointer, setPointer] = useState<Pointer>({ x: 0, y: 0 })
    const [isLeadBlinking, setIsLeadBlinking] = useState(false)
    const [isCoreBlinking, setIsCoreBlinking] = useState(false)
    const [isLookingAtEachOther, setIsLookingAtEachOther] = useState(false)
    const [isLeadPeeking, setIsLeadPeeking] = useState(false)
    const leadRef = useRef<HTMLDivElement>(null)
    const coreRef = useRef<HTMLDivElement>(null)
    const judgeRef = useRef<HTMLDivElement>(null)
    const scoutRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const start = {
            x: window.innerWidth * 0.35,
            y: window.innerHeight * 0.5,
        }
        const current = { ...start }
        const target = { ...start }
        let frame = 0

        setPointer(start)

        const handleMouseMove = (e: MouseEvent) => {
            target.x = e.clientX
            target.y = e.clientY
        }

        const tick = () => {
            current.x += (target.x - current.x) * 0.14
            current.y += (target.y - current.y) * 0.14

            setPointer(prev => {
                if (Math.abs(prev.x - current.x) < 0.08 && Math.abs(prev.y - current.y) < 0.08) {
                    return prev
                }
                return { x: current.x, y: current.y }
            })

            frame = window.requestAnimationFrame(tick)
        }

        window.addEventListener('mousemove', handleMouseMove, { passive: true })
        frame = window.requestAnimationFrame(tick)

        return () => {
            window.removeEventListener('mousemove', handleMouseMove)
            window.cancelAnimationFrame(frame)
        }
    }, [])

    useEffect(() => {
        let blinkTimer = 0
        let openTimer = 0

        const scheduleBlink = () => {
            blinkTimer = window.setTimeout(() => {
                setIsLeadBlinking(true)
                openTimer = window.setTimeout(() => {
                    setIsLeadBlinking(false)
                    scheduleBlink()
                }, 135)
            }, Math.random() * 4200 + 2800)
        }

        scheduleBlink()
        return () => {
            window.clearTimeout(blinkTimer)
            window.clearTimeout(openTimer)
        }
    }, [])

    useEffect(() => {
        let blinkTimer = 0
        let openTimer = 0

        const scheduleBlink = () => {
            blinkTimer = window.setTimeout(() => {
                setIsCoreBlinking(true)
                openTimer = window.setTimeout(() => {
                    setIsCoreBlinking(false)
                    scheduleBlink()
                }, 125)
            }, Math.random() * 4300 + 3300)
        }

        scheduleBlink()
        return () => {
            window.clearTimeout(blinkTimer)
            window.clearTimeout(openTimer)
        }
    }, [])

    useEffect(() => {
        if (isTyping) {
            setIsLookingAtEachOther(true)
            const timer = window.setTimeout(() => {
                setIsLookingAtEachOther(false)
            }, 900)
            return () => window.clearTimeout(timer)
        }

        setIsLookingAtEachOther(false)
    }, [isTyping])

    useEffect(() => {
        if (passwordLength > 0 && showPassword) {
            const peekTimer = window.setTimeout(() => {
                setIsLeadPeeking(true)
                window.setTimeout(() => {
                    setIsLeadPeeking(false)
                }, 900)
            }, Math.random() * 3200 + 1800)

            return () => window.clearTimeout(peekTimer)
        }

        setIsLeadPeeking(false)
    }, [passwordLength, showPassword, isLeadPeeking])

    const calculatePosition = (ref: { current: HTMLDivElement | null }) => {
        if (!ref.current) return { faceX: 0, faceY: 0, bodySkew: 0 }

        const rect = ref.current.getBoundingClientRect()
        const centerX = rect.left + rect.width / 2
        const centerY = rect.top + rect.height / 3
        const deltaX = pointer.x - centerX
        const deltaY = pointer.y - centerY

        return {
            faceX: Math.max(-15, Math.min(15, deltaX / 22)),
            faceY: Math.max(-10, Math.min(10, deltaY / 34)),
            bodySkew: Math.max(-6, Math.min(6, -deltaX / 145)),
        }
    }

    const leadPos = calculatePosition(leadRef)
    const corePos = calculatePosition(coreRef)
    const judgePos = calculatePosition(judgeRef)
    const scoutPos = calculatePosition(scoutRef)
    const isHidingPassword = passwordLength > 0 && !showPassword

    return (
        <div className="relative" style={{ width: '550px', height: '400px' }}>
            <div
                className="absolute bottom-0 left-0 h-px w-[475px]"
                style={{
                    background: 'linear-gradient(90deg, transparent, rgba(15, 23, 42, 0.22), transparent)',
                }}
            />
            <div
                className="absolute left-[124px] top-[210px] h-[112px] w-[290px] rounded-full opacity-40"
                style={{
                    background: 'radial-gradient(circle, rgba(226,232,240,0.7), transparent 68%)',
                    filter: 'blur(18px)',
                }}
            />
            <div
                ref={leadRef}
                className="absolute bottom-0"
                style={{
                    left: '88px',
                    width: '168px',
                    height: isTyping || isHidingPassword ? '390px' : '355px',
                    background: 'linear-gradient(160deg, #7C3AED 0%, #2563EB 100%)',
                    borderRadius: '36px 48px 24px 28px',
                    border: '1px solid rgba(255, 255, 255, 0.18)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25), 0 24px 52px rgba(37, 99, 235, 0.16)',
                    zIndex: 1,
                    transform: passwordLength > 0 && showPassword
                        ? 'skewX(0deg) rotate(-1deg) translate3d(0, 0, 0)'
                        : isTyping || isHidingPassword
                            ? `skewX(${(leadPos.bodySkew || 0) - 10}deg) rotate(-3deg) translate3d(38px, 0, 0)`
                            : `skewX(${leadPos.bodySkew || 0}deg) rotate(-1deg) translate3d(0, 0, 0)`,
                    transformOrigin: 'bottom center',
                    transition: bodyTransition,
                    willChange: 'transform, height',
                }}
            >
                <div
                    className="absolute left-5 right-5 top-[82px] h-px"
                    style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)' }}
                />
                <div className="absolute bottom-8 left-7 flex gap-2">
                    <SignalDot />
                    <SignalDot delay="120ms" />
                    <SignalDot delay="240ms" />
                </div>
                <div
                    className="absolute flex gap-8"
                    style={{
                        left: passwordLength > 0 && showPassword
                            ? '24px'
                            : isLookingAtEachOther
                                ? '58px'
                                : `${48 + leadPos.faceX}px`,
                        top: passwordLength > 0 && showPassword
                            ? '46px'
                            : isLookingAtEachOther
                                ? '74px'
                                : `${52 + leadPos.faceY}px`,
                        transition: faceTransition,
                    }}
                >
                    <EyeBall
                        pointer={pointer}
                        size={18}
                        pupilSize={7}
                        maxDistance={5}
                        eyeColor="white"
                        pupilColor="#2D2D2D"
                        isBlinking={isLeadBlinking}
                        forceLookX={passwordLength > 0 && showPassword ? (isLeadPeeking ? 4 : -4) : isLookingAtEachOther ? 3 : undefined}
                        forceLookY={passwordLength > 0 && showPassword ? (isLeadPeeking ? 5 : -4) : isLookingAtEachOther ? 4 : undefined}
                    />
                    <EyeBall
                        pointer={pointer}
                        size={18}
                        pupilSize={7}
                        maxDistance={5}
                        eyeColor="white"
                        pupilColor="#2D2D2D"
                        isBlinking={isLeadBlinking}
                        forceLookX={passwordLength > 0 && showPassword ? (isLeadPeeking ? 4 : -4) : isLookingAtEachOther ? 3 : undefined}
                        forceLookY={passwordLength > 0 && showPassword ? (isLeadPeeking ? 5 : -4) : isLookingAtEachOther ? 4 : undefined}
                    />
                </div>
            </div>

            <div
                ref={coreRef}
                className="absolute bottom-0"
                style={{
                    left: '232px',
                    width: '136px',
                    height: '292px',
                    background: 'linear-gradient(180deg, #121826 0%, #1F2937 100%)',
                    borderRadius: '30px 30px 18px 18px',
                    border: '1px solid rgba(148, 163, 184, 0.24)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 20px 45px rgba(2,6,23,0.22)',
                    zIndex: 2,
                    transform: passwordLength > 0 && showPassword
                        ? 'skewX(0deg) rotate(1deg) translate3d(0, 0, 0)'
                        : isLookingAtEachOther
                            ? `skewX(${(corePos.bodySkew || 0) * 1.25 + 9}deg) rotate(1deg) translate3d(22px, 0, 0)`
                            : isTyping || isHidingPassword
                                ? `skewX(${(corePos.bodySkew || 0) * 1.25}deg) rotate(1deg) translate3d(0, 0, 0)`
                                : `skewX(${corePos.bodySkew || 0}deg) rotate(1deg) translate3d(0, 0, 0)`,
                    transformOrigin: 'bottom center',
                    transition: bodyTransition,
                    willChange: 'transform',
                }}
            >
                <div
                    className="absolute bottom-8 left-5 right-5 grid grid-cols-3 gap-2"
                    aria-hidden="true"
                >
                    {Array.from({ length: 6 }).map((_, index) => (
                        <span
                            key={index}
                            className="h-1 rounded-full bg-slate-400/45"
                        />
                    ))}
                </div>
                <div
                    className="absolute flex gap-6"
                    style={{
                        left: passwordLength > 0 && showPassword
                            ? '18px'
                            : isLookingAtEachOther
                                ? '36px'
                                : `${28 + corePos.faceX}px`,
                        top: passwordLength > 0 && showPassword
                            ? '42px'
                            : isLookingAtEachOther
                                ? '24px'
                                : `${46 + corePos.faceY}px`,
                        transition: faceTransition,
                    }}
                >
                    <EyeBall
                        pointer={pointer}
                        size={16}
                        pupilSize={6}
                        maxDistance={4}
                        eyeColor="white"
                        pupilColor="#2D2D2D"
                        isBlinking={isCoreBlinking}
                        forceLookX={passwordLength > 0 && showPassword ? -4 : isLookingAtEachOther ? 0 : undefined}
                        forceLookY={passwordLength > 0 && showPassword ? -4 : isLookingAtEachOther ? -4 : undefined}
                    />
                    <EyeBall
                        pointer={pointer}
                        size={16}
                        pupilSize={6}
                        maxDistance={4}
                        eyeColor="white"
                        pupilColor="#2D2D2D"
                        isBlinking={isCoreBlinking}
                        forceLookX={passwordLength > 0 && showPassword ? -4 : isLookingAtEachOther ? 0 : undefined}
                        forceLookY={passwordLength > 0 && showPassword ? -4 : isLookingAtEachOther ? -4 : undefined}
                    />
                </div>
            </div>

            <div
                ref={scoutRef}
                className="absolute bottom-0"
                style={{
                    left: '0px',
                    width: '228px',
                    height: '178px',
                    zIndex: 3,
                    background: 'linear-gradient(145deg, #10B981 0%, #22D3EE 100%)',
                    borderRadius: '44px 86px 28px 26px',
                    border: '1px solid rgba(255,255,255,0.2)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.24), 0 18px 42px rgba(16,185,129,0.14)',
                    transform: passwordLength > 0 && showPassword
                        ? 'skewX(0deg) rotate(0deg) translate3d(0, 0, 0)'
                        : `skewX(${scoutPos.bodySkew || 0}deg) rotate(-1deg) translate3d(0, 0, 0)`,
                    transformOrigin: 'bottom center',
                    transition: bodyTransition,
                    willChange: 'transform',
                }}
            >
                <div
                    className="absolute bottom-6 right-8 h-10 w-10 rounded-full border border-white/35"
                    aria-hidden="true"
                />
                <div
                    className="absolute bottom-[42px] right-[53px] h-px w-16 bg-white/35"
                    aria-hidden="true"
                />
                <div
                    className="absolute flex gap-8"
                    style={{
                        left: passwordLength > 0 && showPassword ? '54px' : `${74 + (scoutPos.faceX || 0)}px`,
                        top: passwordLength > 0 && showPassword ? '72px' : `${78 + (scoutPos.faceY || 0)}px`,
                        transition: faceTransition,
                    }}
                >
                    <Pupil pointer={pointer} size={12} maxDistance={5} pupilColor="#2D2D2D" forceLookX={passwordLength > 0 && showPassword ? -5 : undefined} forceLookY={passwordLength > 0 && showPassword ? -4 : undefined} />
                    <Pupil pointer={pointer} size={12} maxDistance={5} pupilColor="#2D2D2D" forceLookX={passwordLength > 0 && showPassword ? -5 : undefined} forceLookY={passwordLength > 0 && showPassword ? -4 : undefined} />
                </div>
            </div>

            <div
                ref={judgeRef}
                className="absolute bottom-0"
                style={{
                    left: '316px',
                    width: '154px',
                    height: '218px',
                    background: 'linear-gradient(180deg, #FACC15 0%, #F59E0B 100%)',
                    borderRadius: '32px 72px 26px 30px',
                    border: '1px solid rgba(255,255,255,0.28)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35), 0 18px 42px rgba(245,158,11,0.16)',
                    zIndex: 4,
                    transform: passwordLength > 0 && showPassword
                        ? 'skewX(0deg) rotate(0deg) translate3d(0, 0, 0)'
                        : `skewX(${judgePos.bodySkew || 0}deg) rotate(2deg) translate3d(0, 0, 0)`,
                    transformOrigin: 'bottom center',
                    transition: bodyTransition,
                    willChange: 'transform',
                }}
            >
                <div
                    className="absolute flex gap-6"
                    style={{
                        left: passwordLength > 0 && showPassword ? '24px' : `${50 + (judgePos.faceX || 0)}px`,
                        top: passwordLength > 0 && showPassword ? '40px' : `${44 + (judgePos.faceY || 0)}px`,
                        transition: faceTransition,
                    }}
                >
                    <Pupil pointer={pointer} size={12} maxDistance={5} pupilColor="#2D2D2D" forceLookX={passwordLength > 0 && showPassword ? -5 : undefined} forceLookY={passwordLength > 0 && showPassword ? -4 : undefined} />
                    <Pupil pointer={pointer} size={12} maxDistance={5} pupilColor="#2D2D2D" forceLookX={passwordLength > 0 && showPassword ? -5 : undefined} forceLookY={passwordLength > 0 && showPassword ? -4 : undefined} />
                </div>
                <div
                    className="absolute w-20 h-[4px] bg-[#2D2D2D] rounded-full"
                    style={{
                        left: passwordLength > 0 && showPassword ? '16px' : `${38 + (judgePos.faceX || 0)}px`,
                        top: passwordLength > 0 && showPassword ? '92px' : `${92 + (judgePos.faceY || 0)}px`,
                        transition: faceTransition,
                    }}
                />
            </div>
        </div>
    )
}

function SignalDot({ delay = '0ms' }: { delay?: string }) {
    return (
        <span
            className="h-1.5 w-1.5 rounded-full bg-white/65"
            style={{
                animation: 'typing 1.8s ease-in-out infinite',
                animationDelay: delay,
            }}
        />
    )
}
