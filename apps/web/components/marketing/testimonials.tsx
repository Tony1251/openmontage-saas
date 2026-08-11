import { Quote } from 'lucide-react';

const testimonials = [
  {
    quote: 'We cut our video production time by 90%.',
    name: 'Sarah Chen',
    title: 'Head of Content at Luma',
    gradient: 'from-pink-500 to-rose-500',
  },
  {
    quote: 'The API-first approach lets us generate thousands of video variations.',
    name: 'Marcus Rivera',
    title: 'CTO at VidScale',
    gradient: 'from-blue-500 to-cyan-500',
  },
  {
    quote: 'Cinematic quality without a cinema budget.',
    name: 'Aisha Patel',
    title: 'Founder of ClipFactory',
    gradient: 'from-amber-500 to-orange-500',
  },
];

export default function Testimonials() {
  return (
    <div className="grid gap-8 md:grid-cols-3">
      {testimonials.map((t) => (
        <div
          key={t.name}
          className="relative rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm"
        >
          <Quote className="mb-4 h-6 w-6 text-purple-400/50" />
          <p className="mb-6 text-lg italic leading-relaxed text-foreground/90">
            &ldquo;{t.quote}&rdquo;
          </p>
          <div className="flex items-center gap-3">
            <div
              className={`h-10 w-10 rounded-full bg-gradient-to-br ${t.gradient}`}
            />
            <div>
              <p className="text-sm font-semibold">{t.name}</p>
              <p className="text-xs text-muted-foreground">{t.title}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
