import { useEffect, useRef, useState } from 'react'

type Pointer = {
    x: number
    y: number
}

type Center = {
    cx: number
    cy: number
}

type Look = {
    x: number
    y: number
}

const prefersReducedMotion = () =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

// 根据身体中心与指针算出眼珠位移（限制在 maxDistance 内）。
// 同一个身体的两只眼睛共用方向，看起来比"对眼"更自然。
function computeLook(center: Center | undefined, pointer: Pointer, maxDistance: number): Look {
    if (!center) return { x: 0, y: 0 }
    const deltaX = pointer.x - center.cx
    const deltaY = pointer.y - center.cy
    const distance = Math.min(Math.hypot(deltaX, deltaY), maxDistance)
    const angle = Math.atan2(deltaY, deltaX)
    return { x: Math.cos(angle) * distance, y: Math.sin(angle) * distance }
}

interface PupilProps {
    size?: number
    pupilColor?: string
    lookX?: number
    lookY?: number
}

function Pupil({ size = 12, pupilColor = 'black', lookX = 0, lookY = 0 }: PupilProps) {
    return (
        <div
            className="rounded-full"
            style={{
                width: `${size}px`,
                height: `${size}px`,
                backgroundColor: pupilColor,
                transform: `translate3d(${lookX}px, ${lookY}px, 0)`,
                transition: 'transform 80ms ease-out',
                willChange: 'transform',
            }}
        />
    )
}

interface EyeBallProps {
    size?: number
    pupilSize?: number
    eyeColor?: string
    pupilColor?: string
    isBlinking?: boolean
    lookX?: number
    lookY?: number
}

function EyeBall({
    size = 48,
    pupilSize = 16,
    eyeColor = 'white',
    pupilColor = 'black',
    isBlinking = false,
    lookX = 0,
    lookY = 0,
}: EyeBallProps) {
    return (
        <div
            className="rounded-full flex items-center justify-center"
            style={{
                width: `${size}px`,
                height: isBlinking ? '2px' : `${size}px`,
                backgroundColor: eyeColor,
                overflow: 'hidden',
                transition: 'height 150ms cubic-bezier(0.22, 1, 0.36, 1)',
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
                        transform: `translate3d(${lookX}px, ${lookY}px, 0)`,
                        transition: 'transform 80ms ease-out',
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

    // 缓存的几何中心，避免每帧 getBoundingClientRect 造成强制重排。
    const geomRef = useRef<{ lead?: Center; core?: Center; scout?: Center; judge?: Center }>({})

    useEffect(() => {
        const measure = () => {
            const read = (ref: { current: HTMLDivElement | null }): Center | undefined => {
                if (!ref.current) return undefined
                const r = ref.current.getBoundingClientRect()
                return { cx: r.left + r.width / 2, cy: r.top + r.height / 3 }
            }
            geomRef.current = {
                lead: read(leadRef),
                core: read(coreRef),
                scout: read(scoutRef),
                judge: read(judgeRef),
            }
        }

        const start = {
            x: window.innerWidth * 0.35,
            y: window.innerHeight * 0.5,
        }
        setPointer(start)

        // 首次在下一帧测量（等首次绘制后布局稳定）。
        const firstMeasure = window.requestAnimationFrame(measure)
        window.addEventListener('resize', measure)
        window.addEventListener('scroll', measure, { passive: true })

        if (prefersReducedMotion()) {
            return () => {
                window.cancelAnimationFrame(firstMeasure)
                window.removeEventListener('resize', measure)
                window.removeEventListener('scroll', measure)
            }
        }

        const current = { ...start }
        const target = { ...start }
        let frame = 0
        let lastMeasure = 0

        const handleMouseMove = (e: MouseEvent) => {
            target.x = e.clientX
            target.y = e.clientY
        }

        const tick = (now: number) => {
            // 节流测量（约每 400ms 一次 + resize），自动跟上小人换姿势后的位置，
            // 同时把每帧的强制重排彻底从热路径里移除。
            if (now - lastMeasure > 400) {
                measure()
                lastMeasure = now
            }

            current.x += (target.x - current.x) * 0.3
            current.y += (target.y - current.y) * 0.3

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
            window.cancelAnimationFrame(firstMeasure)
            window.cancelAnimationFrame(frame)
            window.removeEventListener('mousemove', handleMouseMove)
            window.removeEventListener('resize', measure)
            window.removeEventListener('scroll', measure)
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

    const calculatePosition = (center: Center | undefined) => {
        if (!center) return { faceX: 0, faceY: 0, bodySkew: 0 }
        const deltaX = pointer.x - center.cx
        const deltaY = pointer.y - center.cy
        return {
            faceX: Math.max(-15, Math.min(15, deltaX / 22)),
            faceY: Math.max(-10, Math.min(10, deltaY / 34)),
            bodySkew: Math.max(-6, Math.min(6, -deltaX / 145)),
        }
    }

    const geom = geomRef.current
    const leadPos = calculatePosition(geom.lead)
    const corePos = calculatePosition(geom.core)
    const judgePos = calculatePosition(geom.judge)
    const scoutPos = calculatePosition(geom.scout)

    const leadLook = computeLook(geom.lead, pointer, 5)
    const coreLook = computeLook(geom.core, pointer, 4)
    const scoutLook = computeLook(geom.scout, pointer, 5)
    const judgeLook = computeLook(geom.judge, pointer, 5)

    const isHidingPassword = passwordLength > 0 && !showPassword
    const isPeekingMode = passwordLength > 0 && showPassword

    // 各身体的"强制看"偏移（看密码 / 互相对视），nullish 时回落到跟随指针。
    const leadForceX = isPeekingMode ? (isLeadPeeking ? 4 : -4) : isLookingAtEachOther ? 3 : undefined
    const leadForceY = isPeekingMode ? (isLeadPeeking ? 5 : -4) : isLookingAtEachOther ? 4 : undefined
    const coreForceX = isPeekingMode ? -4 : isLookingAtEachOther ? 0 : undefined
    const coreForceY = isPeekingMode ? -4 : isLookingAtEachOther ? -4 : undefined
    const sideForceX = isPeekingMode ? -5 : undefined
    const sideForceY = isPeekingMode ? -4 : undefined

    const isFixedMode = isPeekingMode || isLookingAtEachOther || isTyping || isHidingPassword
    const faceTransition = isFixedMode ? 'transform 600ms cubic-bezier(0.22, 1, 0.36, 1)' : 'transform 80ms ease-out'
    const bodyTransition = isFixedMode ? 'transform 700ms cubic-bezier(0.22, 1, 0.36, 1), height 700ms cubic-bezier(0.22, 1, 0.36, 1)' : 'transform 120ms ease-out, height 700ms cubic-bezier(0.22, 1, 0.36, 1)'

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
                className="absolute bottom-0 mascot-float"
                style={{
                    left: '88px',
                    width: '168px',
                    height: isTyping || isHidingPassword ? '390px' : '355px',
                    background: 'linear-gradient(160deg, #8B5CF6 0%, #3B82F6 100%)',
                    borderRadius: '36px 48px 24px 28px',
                    border: '1px solid rgba(255, 255, 255, 0.18)',
                    boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.3), inset 0 -4px 12px rgba(0,0,0,0.2), 0 24px 52px rgba(37, 99, 235, 0.25)',
                    zIndex: 1,
                    animationDuration: '7s',
                    animationDelay: '0s',
                    transform: isPeekingMode
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
                        left: 0,
                        top: 0,
                        transform: `translate3d(${
                            isPeekingMode ? 24 : isLookingAtEachOther ? 58 : 48 + leadPos.faceX
                        }px, ${
                            isPeekingMode ? 46 : isLookingAtEachOther ? 74 : 52 + leadPos.faceY
                        }px, 0)`,
                        transition: faceTransition,
                    }}
                >
                    <EyeBall
                        size={18}
                        pupilSize={7}
                        eyeColor="white"
                        pupilColor="#2D2D2D"
                        isBlinking={isLeadBlinking}
                        lookX={leadForceX ?? leadLook.x}
                        lookY={leadForceY ?? leadLook.y}
                    />
                    <EyeBall
                        size={18}
                        pupilSize={7}
                        eyeColor="white"
                        pupilColor="#2D2D2D"
                        isBlinking={isLeadBlinking}
                        lookX={leadForceX ?? leadLook.x}
                        lookY={leadForceY ?? leadLook.y}
                    />
                </div>
            </div>

            <div
                ref={coreRef}
                className="absolute bottom-0 mascot-float"
                style={{
                    left: '232px',
                    width: '136px',
                    height: '292px',
                    background: 'linear-gradient(180deg, #1E293B 0%, #0F172A 100%)',
                    borderRadius: '30px 30px 18px 18px',
                    border: '1px solid rgba(148, 163, 184, 0.24)',
                    boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.15), inset 0 -4px 12px rgba(0,0,0,0.4), 0 20px 45px rgba(2,6,23,0.35)',
                    zIndex: 2,
                    animationDuration: '8s',
                    animationDelay: '-2s',
                    transform: isPeekingMode
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
                        left: 0,
                        top: 0,
                        transform: `translate3d(${
                            isPeekingMode ? 18 : isLookingAtEachOther ? 36 : 28 + corePos.faceX
                        }px, ${
                            isPeekingMode ? 42 : isLookingAtEachOther ? 24 : 46 + corePos.faceY
                        }px, 0)`,
                        transition: faceTransition,
                    }}
                >
                    <EyeBall
                        size={16}
                        pupilSize={6}
                        eyeColor="white"
                        pupilColor="#2D2D2D"
                        isBlinking={isCoreBlinking}
                        lookX={coreForceX ?? coreLook.x}
                        lookY={coreForceY ?? coreLook.y}
                    />
                    <EyeBall
                        size={16}
                        pupilSize={6}
                        eyeColor="white"
                        pupilColor="#2D2D2D"
                        isBlinking={isCoreBlinking}
                        lookX={coreForceX ?? coreLook.x}
                        lookY={coreForceY ?? coreLook.y}
                    />
                </div>
            </div>

            <div
                ref={scoutRef}
                className="absolute bottom-0 mascot-float"
                style={{
                    left: '0px',
                    width: '228px',
                    height: '178px',
                    zIndex: 3,
                    background: 'linear-gradient(145deg, #34D399 0%, #22D3EE 100%)',
                    borderRadius: '44px 86px 28px 26px',
                    border: '1px solid rgba(255,255,255,0.2)',
                    boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.4), inset 0 -4px 12px rgba(0,0,0,0.15), 0 18px 42px rgba(16,185,129,0.25)',
                    animationDuration: '6.5s',
                    animationDelay: '-1s',
                    transform: isPeekingMode
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
                        left: 0,
                        top: 0,
                        transform: `translate3d(${isPeekingMode ? 54 : 74 + (scoutPos.faceX || 0)}px, ${isPeekingMode ? 72 : 78 + (scoutPos.faceY || 0)}px, 0)`,
                        transition: faceTransition,
                    }}
                >
                    <Pupil size={12} pupilColor="#2D2D2D" lookX={sideForceX ?? scoutLook.x} lookY={sideForceY ?? scoutLook.y} />
                    <Pupil size={12} pupilColor="#2D2D2D" lookX={sideForceX ?? scoutLook.x} lookY={sideForceY ?? scoutLook.y} />
                </div>
            </div>

            <div
                ref={judgeRef}
                className="absolute bottom-0 mascot-float"
                style={{
                    left: '316px',
                    width: '154px',
                    height: '218px',
                    background: 'linear-gradient(180deg, #FDE047 0%, #F59E0B 100%)',
                    borderRadius: '32px 72px 26px 30px',
                    border: '1px solid rgba(255,255,255,0.28)',
                    boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.5), inset 0 -4px 12px rgba(0,0,0,0.15), 0 18px 42px rgba(245,158,11,0.25)',
                    zIndex: 4,
                    animationDuration: '7.5s',
                    animationDelay: '-3s',
                    transform: isPeekingMode
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
                        left: 0,
                        top: 0,
                        transform: `translate3d(${isPeekingMode ? 24 : 50 + (judgePos.faceX || 0)}px, ${isPeekingMode ? 40 : 44 + (judgePos.faceY || 0)}px, 0)`,
                        transition: faceTransition,
                    }}
                >
                    <Pupil size={12} pupilColor="#2D2D2D" lookX={sideForceX ?? judgeLook.x} lookY={sideForceY ?? judgeLook.y} />
                    <Pupil size={12} pupilColor="#2D2D2D" lookX={sideForceX ?? judgeLook.x} lookY={sideForceY ?? judgeLook.y} />
                </div>
                <div
                    className="absolute w-20 h-[4px] bg-[#2D2D2D] rounded-full"
                    style={{
                        left: 0,
                        top: 0,
                        transform: `translate3d(${isPeekingMode ? 16 : 38 + (judgePos.faceX || 0)}px, ${isPeekingMode ? 92 : 92 + (judgePos.faceY || 0)}px, 0)`,
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
