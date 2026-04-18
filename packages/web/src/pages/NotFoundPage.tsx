import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] animate-fade-in">
      {/* Skull SVG */}
      <svg
        className="w-24 h-24 mb-6 text-[color:var(--class-color)] opacity-60"
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M32 4C18.7 4 8 14.7 8 28c0 8.4 4.3 15.8 10.8 20.1V56a4 4 0 004 4h18.4a4 4 0 004-4v-7.9C51.7 43.8 56 36.4 56 28 56 14.7 45.3 4 32 4z"
          fill="currentColor"
          fillOpacity="0.15"
          stroke="currentColor"
          strokeWidth="2"
        />
        <circle cx="22" cy="26" r="5" fill="currentColor" fillOpacity="0.6" />
        <circle cx="42" cy="26" r="5" fill="currentColor" fillOpacity="0.6" />
        <ellipse cx="32" cy="38" rx="2.5" ry="3" fill="currentColor" fillOpacity="0.4" />
        <path
          d="M24 48v8M30 48v8M34 48v8M40 48v8"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.4"
        />
      </svg>

      {/* 404 */}
      <h1 className="text-8xl sm:text-9xl font-black bg-gradient-to-b from-[color:var(--class-color)] to-[color:var(--class-color)]/30 bg-clip-text text-transparent select-none leading-none">
        404
      </h1>

      {/* Message */}
      <p className="mt-4 text-lg font-semibold text-gray-300">
        Vous vous êtes perdu dans le Néant...
      </p>
      <p className="mt-1 text-sm text-gray-600 max-w-xs text-center">
        Ce donjon n'existe pas, ou a été déplacé par un portail instable.
      </p>

      {/* CTA */}
      <Link to="/" className="mt-8">
        <Button>Retour à l'accueil</Button>
      </Link>

      {/* Decorative glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-[color:var(--class-color)]/[0.04] blur-3xl" />
      </div>
    </div>
  )
}
