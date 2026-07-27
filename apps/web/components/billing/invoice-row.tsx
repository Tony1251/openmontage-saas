'use client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, ExternalLink } from 'lucide-react';
import type { Invoice } from '@/lib/types';

interface InvoiceRowProps {
  invoice: Invoice;
}

const statusLabels: Record<string, string> = {
  paid: 'Paid',
  open: 'Open',
  uncollectible: 'Uncollectible',
  void: 'Void',
};

const statusVariants: Record<string, 'success' | 'secondary' | 'destructive' | 'outline'> = {
  paid: 'success',
  open: 'secondary',
  uncollectible: 'destructive',
  void: 'outline',
};

export function InvoiceRow({ invoice }: InvoiceRowProps) {
  return (
    <tr className="border-b text-sm">
      <td className="py-3">{new Date(invoice.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
      <td className="py-3">${(invoice.amount / 100).toFixed(2)} {invoice.currency.toUpperCase()}</td>
      <td className="py-3">
        <Badge variant={statusVariants[invoice.status] || 'secondary'}>
          {statusLabels[invoice.status] || invoice.status}
        </Badge>
      </td>
      <td className="py-3 text-right">
        {invoice.pdf_url ? (
          <a href={invoice.pdf_url} target="_blank" rel="noreferrer">
            <Button variant="ghost" size="sm">
              <Download className="mr-1 h-3 w-3" />
              PDF
            </Button>
          </a>
        ) : (
          <Button variant="ghost" size="sm" disabled>
            <ExternalLink className="mr-1 h-3 w-3" />
            PDF
          </Button>
        )}
      </td>
    </tr>
  );
}
