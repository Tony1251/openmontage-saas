const faqs = [
  {
    q: 'What video models does OpenMontage support?',
    a: 'Seedance, Kling, Runway, MiniMax, and more being added.',
  },
  {
    q: 'How long does rendering take?',
    a: '30 seconds to 5 minutes depending on model and resolution.',
  },
  {
    q: 'Can I cancel unused renders?',
    a: 'Yes, via POST /v1/renders/{id}/cancel.',
  },
  {
    q: 'How does billing work?',
    a: 'Prepaid credits per workspace. Enterprise plans have monthly invoicing.',
  },
  {
    q: 'Do you offer a free trial?',
    a: 'Free tier includes 10 renders per month. No credit card required.',
  },
  {
    q: 'Is there a self-hosted option?',
    a: 'Yes, contact sales for on-premise deployment.',
  },
];

export default function FAQ() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {faqs.map((faq) => (
        <details
          key={faq.q}
          className="group rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm transition-colors open:border-purple-500/30"
        >
          <summary className="flex cursor-pointer items-center justify-between text-sm font-medium text-foreground">
            {faq.q}
            <span className="ml-2 text-purple-400 transition-transform group-open:rotate-45">
              +
            </span>
          </summary>
          <p className="mt-3 text-sm text-muted-foreground">{faq.a}</p>
        </details>
      ))}
    </div>
  );
}
